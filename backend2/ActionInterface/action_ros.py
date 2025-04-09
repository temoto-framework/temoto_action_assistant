import json
import threading
from rclpy.node import Node

from temoto_msgs.srv import UmrfGraphGet
from temoto_msgs.msg import UmrfGraphStart, UmrfGraphStop, UmrfGraphFeedback

# Global action node reference
_action_node = None

def get_action_node():
    """Return the global action node instance"""
    return _action_node

class ActionNode(Node):
    """ROS Node for action/graph-related functionality"""
    def __init__(self, ros_events_callback):
        super().__init__('webapp_action_node')
        self.ros_events_callback = ros_events_callback
        
        # Set up publishers, subscribers, and clients for action interface
        self.umrf_graph_start_pub = self.create_publisher(
            UmrfGraphStart, 'umrf_graph_start', 10)
        self.umrf_graph_stop_pub = self.create_publisher(
            UmrfGraphStop, 'umrf_graph_stop', 10)
        self.umrf_graph_feedback_sub = self.create_subscription(
            UmrfGraphFeedback, 'umrf_graph_feedback', self.umrf_graph_feedback_cb, 10)
        self.client_graph_get = self.create_client(UmrfGraphGet, 'umrf_graph_get')
        
        # Wait for the service to be available
        while not self.client_graph_get.wait_for_service(timeout_sec=1.0):
            self.get_logger().info('waiting for the umrf_graph_get server')
        self.get_logger().info('umrf_graph_get server is up')

    def get_graphs(self):
        """Get graphs from ROS service"""
        req = UmrfGraphGet.Request()
        res = self.client_graph_get.call(req)
        return res.graph_jsons_indexed, res.graph_jsons_running

    def start_graph(self, graph_name):
        """Start a graph"""
        msg = UmrfGraphStart()
        msg.umrf_graph_name = graph_name
        msg.name_match_required = False
        msg.targets = ['David']  # TODO: Make this configurable
        self.umrf_graph_start_pub.publish(msg)

    def stop_graph(self, graph_name):
        """Stop a graph"""
        msg = UmrfGraphStop()
        msg.umrf_graph_name = graph_name
        msg.targets = ['David']  # TODO: Make this configurable
        self.umrf_graph_stop_pub.publish(msg)

    def umrf_graph_feedback_cb(self, msg):
        """Callback for graph feedback messages"""
        self.get_logger().info(f"[-----> DEBUG] msg.history: {msg.history}")
        # Pass the feedback to the callback
        self.ros_events_callback('graph_feedback', msg.actor, msg.history)

def initialize_action_node(ros_events_callback):
    """Initialize the action ROS node and return it"""
    global _action_node
    
    # Create a new ActionNode instance
    _action_node = ActionNode(ros_events_callback)
    
    return _action_node

def handle_graph_feedback(actor, graphs_in):
    """
    Handle graph feedback from ROS.
    Updates the graphs dictionary and emits the updated list.
    """
    # Import here to avoid circular dependencies
    from app import socketio
    from ActionInterface.action_socket import get_graphs, update_graphs
    
    updated_graphs = {}
    for g in graphs_in:
        g_json = json.loads(g)
        updated_graphs[g_json["graph_name"]] = g_json
    
    # Update the graphs dictionary
    update_graphs(updated_graphs)
    
    # Emit the updated graphs list
    graphs_list = list(get_graphs().values())
    socketio.emit('graphs', graphs_list)
    
    # Also store the graph data for the ChatInterface's planned actions
    # Import here to avoid circular imports
    from ChatInterface.chat_socket import store_umrf_feedback_data
    store_umrf_feedback_data(actor, graphs_in)

def handle_ros_events(event_type, *args):
    """
    Central handler for ROS events.
    Dispatches events to appropriate handlers.
    """
    if event_type == 'graph_feedback':
        actor, history = args
        handle_graph_feedback(actor, history)
    # Add other event types as needed

def setup_action_ros(socketio, node, graphs_dict):
    """Set up the action ROS functionality"""
    global _action_node
    
    # Store the node reference globally
    _action_node = node
    
    # No additional setup needed as the node was already initialized
    return True