import rclpy
from rclpy.node import Node
import json
import threading
import time

from temoto_msgs.srv import UmrfGraphGet
from temoto_msgs.msg import UmrfGraphStart, UmrfGraphStop, UmrfGraphFeedback

node = None

def wait_until_initialized():
	while node is None:
		time.sleep(1)

def get_graphs():
	if node is None:
		return None

	return node.get_graphs()

class RosInterface(Node):
	"""A ROS2 Node that prints to the console periodically."""

	def __init__(self, graph_feedback_cb_parent):
		super().__init__('action_designer_runtime')
		self.graph_feedback_cb_parent = graph_feedback_cb_parent

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

def run_ros_interface(graph_feedback_callback):

	global node

	rclpy.init()
	node = RosInterface(graph_feedback_callback)

	try:
		rclpy.spin(node)
		node.destroy_node()
		rclpy.shutdown()

	except rclpy.executors.ExternalShutdownException:

		# TODO: implement a proper clean-up by capturing the SIGINT
		node.get_logger().info("External shutdown signal received, stopping ROS2 node.")

def run_ros_interface_thread(graph_feedback_callback):

	thread = threading.Thread(target=run_ros_interface, args=(graph_feedback_callback,))
	thread.start()
