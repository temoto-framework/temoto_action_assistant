from flask import request, jsonify, Response
import json
import datetime
import threading
import re
import traceback

def setup_action_socket(app, socketio, action_enabled):
    """Setup all Flask routes and SocketIO handlers for the action interface"""
    
    """Setup ROS nodes and threads for the action interface"""
    if action_enabled:
        try:
            # Import from local module
            from ActionInterface import action_ros
            
            # Start the ROS thread
            action_ros.run_ros_action_thread()
            
            # Wait for node to initialize with timeout
            if action_ros.wait_until_initialized(timeout=10.0):
                ri_action_node = action_ros.ros_action_node
                print("ROS action node initialized successfully")
            else:
                print("Warning: Timed out waiting for ROS action node to initialize")
            
            return ri_action_node
        except Exception as e:
            print(f"Error initializing action node: {e}")
            import traceback
            traceback.print_exc()
            return None
    else:
        return None