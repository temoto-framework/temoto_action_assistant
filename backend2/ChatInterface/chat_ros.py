import rclpy
from rclpy.node import Node

import json
import threading
import time
from std_msgs.msg import String
from sensor_msgs.msg import CompressedImage

from temoto_msgs.msg import UmrfGraphStart, UmrfGraphStop, UmrfGraphFeedback, UmrfGraphModify, UmrfGraphPause, UmrfGraphResume

# Global variables
ros_chat_node = None
ros_chat_node_ready = threading.Event()

def wait_until_initialized(timeout=10):
    """Wait until the ros_chat_node is initialized or timeout occurs"""
    return ros_chat_node_ready.wait(timeout=timeout)

class ChatNode(Node):
    """ROS Node for chat-related functionality"""
    def __init__(self, graph_planned_parent=None, chat_feedback_callback=None, display_feed_cb_parent=None):
        super().__init__('temoto_assistant_chat_node')
        self.graph_planned_parent = graph_planned_parent
        self.chat_feedback_callback = chat_feedback_callback
        self.display_feed_cb_parent = display_feed_cb_parent
        
        # HRI CHAT INTERFACE TOPICS
        self.chat_interface_input_pub = self.create_publisher(
            String, 'chat_interface_input', 10)
        self.chat_interface_feedback_sub = self.create_subscription(
            String, 'chat_interface_feedback', self.handle_chat_interface_feedback, 10)
        
        # Action Engine Topics
        self.umrf_graph_feedback_sub = self.create_subscription(UmrfGraphFeedback, 'umrf_graph_feedback', self.umrf_graph_feedback_chat, 10)
        self.umrf_graph_start_sub = self.create_subscription(UmrfGraphStart, 'umrf_graph_start', self.umrf_graph_start_chat, 10)
        self.umrf_graph_stop_sub = self.create_subscription(UmrfGraphStop, 'umrf_graph_stop', self.umrf_graph_stop_chat, 10)
        self.umrf_graph_modify_sub = self.create_subscription(UmrfGraphModify, 'umrf_graph_modify', self.umrf_graph_modify_chat, 10)
        self.umrf_graph_pause_sub = self.create_subscription(UmrfGraphPause, 'umrf_graph_pause', self.umrf_graph_pause_chat, 10)
        self.umrf_graph_resume_sub = self.create_subscription(UmrfGraphResume, 'umrf_graph_resume', self.umrf_graph_resume_chat, 10)
            
        # Track actors with pending requests that need responses
        self.actors_awaiting_response = set()
        
        # Display feed subscriptions
        self.display_feed_subscriptions = {}
        
        self.get_logger().info('Chat node initialized')

    ### PLANNED PANEL METHODS

    def umrf_graph_feedback_chat(self, msg):
        if self.graph_planned_parent:
            self.get_logger().info(f"[umrf_graph_feedback -----> DEBUG] msg.history: {msg.history}")
            # Initialize empty graph
            graph = {"actions": []}
            
            # Process first graph in history if available
            if msg.history and len(msg.history) > 0:
                try:
                    # Parse the JSON string from the first item in history array
                    data = msg.history[0]
                    graph_json = json.loads(data)
                    
                    # Extract actions
                    if "actions" in graph_json and isinstance(graph_json["actions"], list):
                        for action in graph_json["actions"]:
                            # Create action entry with name as key and copy input/output parameters
                            action_entry = {
                                action["name"]: {
                                    "input_parameters": action.get("input_parameters", {}),
                                    "output_parameters": action.get("output_parameters", {}),
                                    "state": action.get("state", "UNKNOWN")
                                }
                            }
                            # Add to graph
                            graph["actions"].append(action_entry)
                            
                    # Also include graph metadata
                    graph["graph_state"] = graph_json.get("graph_state", "RUNNING")
                    
                except Exception as e:
                    self.get_logger().error(f"Error processing graph: {str(e)}")
                    
            # Call parent display function
            self.graph_planned_parent(msg.actor, graph)
            
    def umrf_graph_start_chat(self, msg):
        if self.graph_planned_parent:
            self.get_logger().info(f"[umrf_graph_start-----> DEBUG] graph: {msg.umrf_graph_json}")
            self.get_logger().info(f"[umrf_graph_start-----> DEBUG] targets: {msg.targets}")
            
            # Debug log more message properties
            try:
                self.get_logger().info(f"[umrf_graph_start-----> DEBUG] msg type: {type(msg)}")
                self.get_logger().info(f"[umrf_graph_start-----> DEBUG] msg attributes: {dir(msg)}")
            except Exception as e:
                self.get_logger().info(f"[umrf_graph_start-----> DEBUG] Error getting msg attributes: {e}")

            if not msg.umrf_graph_json:
                self.get_logger().info("Empty UMRF graph JSON received")
                
                # Even with empty JSON, create a basic graph structure
                graph = {
                    "actions": [], 
                    "graph_state": "INITIALIZED"
                }
                
                # Publish the empty graph for each target
                for target in msg.targets:
                    self.graph_planned_parent(target, graph)
                    self.get_logger().info(f"Published empty graph for target: {target}")
                
                return
            
            try:
                # Initialize graph structure
                graph = {"actions": []}
                
                # Parse the graph JSON
                graph_json = json.loads(msg.umrf_graph_json)
                self.get_logger().info(f"[umrf_graph_start-----> DEBUG] Parsed JSON: {graph_json}")
                
                # Extract actions
                if "actions" in graph_json and isinstance(graph_json["actions"], list):
                    start_action = True
                    for action in graph_json["actions"]:
                        # Check if action has a name
                        if "name" not in action:
                            self.get_logger().warning("Action missing 'name' field, skipping")
                            continue
                            
                        # Create action entry with name as key and copy input/output parameters
                        action_entry = {
                            action["name"]: {
                                "input_parameters": action.get("input_parameters", {}),
                                "output_parameters": action.get("output_parameters", {})
                            }
                        }

                        # Set state inside the action's object, not at the action_entry level
                        if start_action:
                            action_entry[action["name"]]["state"] = "RUNNING"
                            start_action = False
                        else:
                            action_entry[action["name"]]["state"] = "UNINITIALIZED"

                        # Add to graph
                        graph["actions"].append(action_entry)
                        
                    # Include graph metadata
                    graph["graph_state"] = graph_json.get("graph_state", "RUNNING")
                    
                # Debug log the final graph structure
                self.get_logger().info(f"[umrf_graph_start-----> DEBUG] Final graph structure: {json.dumps(graph)}")
                    
            except Exception as e:
                self.get_logger().error(f"Error processing graph JSON: {str(e)}")
                
                # Create an error graph
                graph = {"actions": [], "graph_state": "ERROR"}
            
            # Publish for each target with error handling
            try:
                if hasattr(msg, 'targets') and msg.targets:
                    for target in msg.targets:
                        self.graph_planned_parent(target, graph)
                        self.get_logger().info(f"Published graph for target: {target}")
                else:
                    self.get_logger().warning("No targets specified in the message")
            except Exception as e:
                self.get_logger().error(f"Error publishing graph: {str(e)}")

    def umrf_graph_stop_chat(self, msg):
        if self.graph_planned_parent:
            for target in msg.targets:
                self.get_logger().info(f"[umrf_graph_stop-----> DEBUG] target: {target}")

                # Delete the graph from the display
                graph = {
                    "actions": [],
                    "graph_state": "STOPPED"
                }

                self.graph_planned_parent(target, graph)
    
    def umrf_graph_modify_chat(self, msg):
        if self.graph_planned_parent:
            self.get_logger().info(f"[umrf_graph_modify-----> DEBUG] graph: {msg.modified_graph}")

            if not msg.modified_graph:
                self.get_logger().info("Empty UMRF graph JSON received")
                return
            
            try:
                # Initialize empty graph
                graph = {"actions": []}
                
                # Parse the graph JSON
                graph_json = json.loads(msg.modified_graph)
                
                # Determine which actions have been passed
                if msg.continue_from:
                    continue_from = msg.continue_from
                    continue_from_passed = False
                else:
                    continue_from_passed = True
                
                # Extract actions
                if "actions" in graph_json and isinstance(graph_json["actions"], list):
                    for action in graph_json["actions"]:
                        # Handle potential KeyError for "name"
                        if "name" not in action:
                            self.get_logger().warning("Action missing 'name' field, skipping")
                            continue
                            
                        # Create action entry with name as key and copy input/output parameters
                        action_entry = {
                            action["name"]: {
                                "input_parameters": action.get("input_parameters", {}),
                                "output_parameters": action.get("output_parameters", {})
                            }
                        }
                        
                        # Set appropriate state
                        if continue_from_passed:
                            action_entry[action["name"]]["state"] = "FINISHED"
                        else:
                            # Generate action ID for comparison
                            action_id = f"{action['name']}_{action.get('id', '')}"
                            
                            if continue_from == action_id:
                                action_entry[action["name"]]["state"] = "RUNNING"
                                continue_from_passed = True
                            else:
                                action_entry[action["name"]]["state"] = "UNINITIALIZED"

                        # Add to graph
                        graph["actions"].append(action_entry)
                        
                    # Include graph metadata
                    graph["graph_state"] = graph_json.get("graph_state", "RUNNING")
                
                # Debug log the graph structure
                self.get_logger().info(f"Generated graph structure: {json.dumps(graph)}")
                    
            except Exception as e:
                self.get_logger().error(f"Error in umrf_graph_modify_chat: {str(e)}")
                
                # Create empty graph on error
                graph = {"actions": [], "graph_state": "ERROR"}
            
            # Publish for each target
            try:
                for target in msg.targets:
                    self.graph_planned_parent(target, graph)
                    self.get_logger().info(f"Published graph for target: {target}")
            except Exception as e:
                self.get_logger().error(f"Error publishing graph: {str(e)}")

    def umrf_graph_pause_chat(self, msg):
        if self.graph_planned_parent:
            for target in msg.targets:
                self.get_logger().info(f"[umrf_graph_paused-----> DEBUG] target: {target}")

                # State the graph as paused
                graph = {
                    "graph_state": "PAUSED"
                }

                self.graph_planned_parent(target, graph)

    def umrf_graph_resume_chat(self, msg):
        if self.graph_planned_parent:
            for target in msg.targets:
                self.get_logger().info(f"[umrf_graph_paused-----> DEBUG] target: {target}")

                # State the graph as paused
                graph = {
                    "graph_state": "RUNNING"
                }

                self.graph_planned_parent(target, graph)

    ##### CHAT PANEL METHODS
    def send_chat_message(self, msg_str):
        self.get_logger().info(f"[DEBUG] handle_chat_input: Received chat input: {msg_str}")
        
        # Parse the message
        try:
            msg_data = json.loads(msg_str)
            targets = msg_data.get("targets", [])
            message = msg_data.get("message", "")
            
            # Check if any targets are awaiting a response
            # If they are, set the type to "response", otherwise use "request"
            awaiting_response = any(target in self.actors_awaiting_response for target in targets)
            
            if awaiting_response:
                # Set message type to "response" for actors awaiting a response
                msg_data["type"] = "response"
                # Remove the actors from the awaiting_response set
                for target in targets:
                    if target in self.actors_awaiting_response:
                        self.actors_awaiting_response.remove(target)
            else:
                # Set message type to "request" by default
                msg_data["type"] = "request"
                
            # Convert back to JSON string
            updated_msg_str = json.dumps(msg_data)
            
            # Publish the message
            response_msg = String()
            response_msg.data = updated_msg_str
            self.chat_interface_input_pub.publish(response_msg)
            
            self.get_logger().info(f"[DEBUG] Published message with type: {msg_data['type']}")
            
        except json.JSONDecodeError:
            self.get_logger().error(f"[ERROR] Failed to parse JSON message: {msg_str}")
            # Fallback to publishing the original message
            response_msg = String()
            response_msg.data = msg_str
            self.chat_interface_input_pub.publish(response_msg)

    def handle_chat_interface_feedback(self, msg):
        self.get_logger().info(f"[DEBUG] handle_chat_interface_feedback: Received chat input: {msg}")
        data = msg.data
        
        try:
            # Parse the feedback message
            feedback_data = json.loads(data)
            message_type = feedback_data.get("type", "")
            targets = feedback_data.get("targets", [])
            
            # If the message type is "request", add the targets to the awaiting_response set
            if message_type == "request":
                for target in targets:
                    self.actors_awaiting_response.add(target)
                self.get_logger().info(f"[DEBUG] Added targets to awaiting_response: {targets}")
            
            # If the message type is "info" or "error", remove the targets from the awaiting_response set
            elif message_type in ["info", "error"]:
                for target in targets:
                    if target in self.actors_awaiting_response:
                        self.actors_awaiting_response.remove(target)
                self.get_logger().info(f"[DEBUG] Removed targets from awaiting_response due to {message_type}: {targets}")
                
        except json.JSONDecodeError:
            self.get_logger().error(f"[ERROR] Failed to parse JSON feedback message: {data}")
        
        # Forward the received chat message to the Flask/Socket.IO callback
        if self.chat_feedback_callback:
            self.chat_feedback_callback(data)

    ##### DISPLAY PANEL METHODS
    def get_available_topics(self):
        """Get a list of all available topics in the ROS system"""
        topics_and_types = self.get_topic_names_and_types()
        return [topic for topic, _ in topics_and_types]

    def image_message_callback(self, msg, target, name):
        """Callback for image messages"""
        if self.display_feed_cb_parent:
            self.display_feed_cb_parent(target, name, msg.data)

    def display_subscribe_to_topic(self, topic, target, name):
        """Subscribe to a specific display feed topic"""
        if topic in self.display_feed_subscriptions:
            return
        
        self.get_logger().info(f"Subscribing to topic: {topic}")
        
        subscription = self.create_subscription(
            CompressedImage,
            topic,
            lambda msg: self.image_message_callback(msg, target, name),
            10
        )
        
        self.display_feed_subscriptions[topic] = subscription

    def display_unsubscribe_from_topic(self, topic):
        """Unsubscribe from a specific display feed topic"""
        if topic in self.display_feed_subscriptions:
            self.destroy_subscription(self.display_feed_subscriptions[topic])
            del self.display_feed_subscriptions[topic]


def run_ros_chat_interface(graph_planned_callback, chat_feedback_callback, display_feed_callback):
    global ros_chat_node
    try:
        print("Starting ROS chat node initialization...")
        if not rclpy.ok():
            rclpy.init()
        ros_chat_node = ChatNode(graph_planned_callback, chat_feedback_callback, display_feed_callback)
        print("ROS chat node created, setting ready event...")
        ros_chat_node_ready.set()
        print("Starting ROS spin...")
        rclpy.spin(ros_chat_node)
    except Exception as e:
        print(f"Error in ROS chat interface: {e}")
    finally:
        if ros_chat_node:
            ros_chat_node.destroy_node()
        rclpy.shutdown()

def run_ros_chat_thread(graph_planned_callback, chat_feedback_callback, display_feed_callback):
    """Start the ROS chat interface in a separate thread"""
    global ros_chat_node
    ros_chat_node = None
    ros_chat_node_ready.clear()
    
    thread = threading.Thread(
        target=run_ros_chat_interface, 
        args=(graph_planned_callback, chat_feedback_callback, display_feed_callback),
        daemon=True
    )
    thread.start()
    
    # Return the thread for advanced control if needed
    return thread