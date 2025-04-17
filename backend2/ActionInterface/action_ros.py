import rclpy
from rclpy.node import Node
import threading


# Global variables
ros_action_node = None
ros_action_node_ready = threading.Event()

def wait_until_initialized(timeout=10):
    """Wait until the ros_action_node is initialized or timeout occurs"""
    return ros_action_node_ready.wait(timeout=timeout)

class ActionNode(Node):
    """ROS Node for action-related functionality"""
    def __init__(self):
        super().__init__('temoto_assistant_action_node')
    

        self.get_logger().info('Action node initialized')
        

def run_ros_action_interface():
    global ros_action_node
    try:
        print("Starting ROS action node initialization...")
        if not rclpy.ok():
            rclpy.init()
        ros_action_node = ActionNode()
        print("ROS action node created, setting ready event...")
        ros_action_node_ready.set()
        print("Starting ROS spin...")
        rclpy.spin(ros_action_node)
    except Exception as e:
        print(f"Error in ROS action interface: {e}")
    finally:
        if ros_action_node:
            ros_action_node.destroy_node()
        rclpy.shutdown()

def run_ros_action_thread():
    """Start the ROS action interface in a separate thread"""
    global ros_action_node
    ros_action_node = None
    ros_action_node_ready.clear()
    
    thread = threading.Thread(
        target=run_ros_action_interface, 
        args=(),
        daemon=True
    )
    thread.start()
    
    # Return the thread for advanced control if needed
    return thread