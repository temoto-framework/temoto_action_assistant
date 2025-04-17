import rclpy
from rclpy.node import Node
import threading

import json
import time

from temoto_msgs.srv import UmrfGraphGet
from temoto_msgs.msg import UmrfGraphStart, UmrfGraphStop, UmrfGraphFeedback


# Global variables
ros_action_node = None
ros_action_node_ready = threading.Event()

def wait_until_initialized(timeout=10):
	"""Wait until the ros_action_node is initialized or timeout occurs"""
	return ros_action_node_ready.wait(timeout=timeout)

class ActionNode(Node):
	"""ROS Node for action-related functionality"""
	def __init__(self, graph_feedback_callback):
		super().__init__('action_designer_runtime')
		self.graph_feedback_cb_parent = graph_feedback_callback

		self.umrf_graph_start_pub = self.create_publisher(UmrfGraphStart, 'umrf_graph_start', 10)
		self.umrf_graph_stop_pub = self.create_publisher(UmrfGraphStop, 'umrf_graph_stop', 10)
		self.umrf_graph_feedback_sub = self.create_subscription(UmrfGraphFeedback, 'umrf_graph_feedback', self.umrf_graph_feedback_cb, 10)
		self.client_graph_get = self.create_client(UmrfGraphGet, 'umrf_graph_get')

		while not self.client_graph_get.wait_for_service(timeout_sec=1.0):
			self.get_logger().info('waiting for the umrf_graph_get server')

		self.get_logger().info('umrf_graph_get server is up')

	def get_graphs(self):

		req = UmrfGraphGet.Request()
		res = self.client_graph_get.call(req)
		return res.umrf_jsons, res.graph_jsons_indexed, res.graph_jsons_running

	def start_graph(self, graph_name):

		msg = UmrfGraphStart()
		msg.umrf_graph_name = graph_name
		msg.name_match_required = False
		msg.targets = ['David']

		self.umrf_graph_start_pub.publish(msg)

	def stop_graph(self, graph_name):

		msg = UmrfGraphStop()
		msg.umrf_graph_name = graph_name
		msg.targets = ['David']

		self.umrf_graph_stop_pub.publish(msg)

	def umrf_graph_feedback_cb(self, msg):
		self.graph_feedback_cb_parent(msg.actor, msg.history)
		

def run_ros_action_interface(graph_feedback_callback):
	global ros_action_node
	try:
		print("Starting ROS action node initialization...")
		if not rclpy.ok():
			rclpy.init()
		ros_action_node = ActionNode(graph_feedback_callback)
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

def run_ros_action_thread(graph_feedback_callback):
	"""Start the ROS action interface in a separate thread"""
	global ros_action_node
	ros_action_node = None
	ros_action_node_ready.clear()
	
	thread = threading.Thread(
		target=run_ros_action_interface, 
		args=(graph_feedback_callback,),
		daemon=True
	)
	thread.start()
	
	# Return the thread for advanced control if needed
	return thread