import rclpy
from rclpy.node import Node

import json
import threading
from rclpy.node import Node
from std_msgs.msg import String
from sensor_msgs.msg import CompressedImage

from temoto_msgs.msg import UmrfGraphStart, UmrfGraphStop, UmrfGraphFeedback
from std_msgs.msg import String
from sensor_msgs.msg import CompressedImage

import time

node = None
node_ready = threading.Event()

def wait_until_initialized(timeout=10):
    """Wait until the node is initialized or timeout occurs"""
    return node_ready.wait(timeout=timeout)

class ChatNode(Node):
    """ROS Node for chat-related functionality"""
    def __init__(self, graph_feedback_cb_parent=None, chat_feedback_callback=None, display_feed_cb_parent=None):
        super().__init__('temoto_assistant_chat_node')
        self.graph_feedback_cb_parent = graph_feedback_cb_parent
        self.chat_feedback_callback = chat_feedback_callback
        self.display_feed_cb_parent = display_feed_cb_parent
        
        # HRI CHAT INTERFACE TOPICS
        self.chat_interface_input_pub = self.create_publisher(
            String, 'chat_interface_input', 10)
        self.chat_interface_feedback_sub = self.create_subscription(
            String, 'chat_interface_feedback', self.handle_chat_interface_feedback, 10)
        
        # Action Engine Topics
        self.umrf_graph_start_pub = self.create_publisher(UmrfGraphStart, 'umrf_graph_start', 10)
        self.umrf_graph_stop_pub = self.create_publisher(UmrfGraphStop, 'umrf_graph_stop', 10)
        self.umrf_graph_feedback_sub = self.create_subscription(
            UmrfGraphFeedback, 'umrf_graph_feedback', self.umrf_graph_feedback_cb, 10)

            
        # Track actors with pending requests that need responses
        self.actors_awaiting_response = set()
        
        # Display feed subscriptions
        self.display_feed_subscriptions = {}
        
        self.get_logger().info('Chat node initialized')

    ### PLANNED PANEL METHODS
    def umrf_graph_feedback_cb(self, msg):
        if self.graph_feedback_cb_parent:
            self.get_logger().info(f"[-----> DEBUG] msg.history: {msg.history}")
            self.graph_feedback_cb_parent(msg.actor, msg.history)

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


def run_ros_chat_interface(graph_feedback_callback, chat_feedback_callback, display_feed_callback):
    rclpy.init()
    node = ChatNode(graph_feedback_callback, chat_feedback_callback, display_feed_callback)
    try:
        rclpy.spin(node)
        node.destroy_node()
        rclpy.shutdown()
    except rclpy.executors.ExternalShutdownException:
        node.get_logger().info("External shutdown signal received, stopping ROS2 node.")

def run_ros_chat_thread(graph_feedback_callback, chat_feedback_callback, display_feed_callback):
    thread = threading.Thread(target=run_ros_chat_interface, args=(graph_feedback_callback, chat_feedback_callback, display_feed_callback))
    thread.start()
