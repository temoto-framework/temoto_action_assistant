from flask import Flask, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
import argparse
import os
import json
import datetime
import time
import threading
import socket 

# Import modules from organized folders                                                 
from ChatInterface.chat_socket import setup_chat_socket
from ActionInterface.action_socket import setup_action_socket

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")

# Global variables
runtime_enabled = False
debug_mode = False
graphs = {}

# Runtime Status
chat_node = None
action_node = None

@app.route('/debug_status', methods=['GET'])
def get_debug_status():
    return jsonify({"debug_enabled": debug_mode}), 200

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    socketio.emit('runtime_enabled', runtime_enabled)
    socketio.emit('debug_mode', debug_mode)
    socketio.emit('graphs', list(graphs.values()))
    socketio.emit('chat_enabled', chat_enabled)
    socketio.emit('action_enabled', action_enabled)

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

def load_graphs(graphs_dir):
    """Load graph JSON files from directory"""
    graphs = {}
    try:
        for filename in os.listdir(graphs_dir):
            if filename.endswith('.json'):
                with open(os.path.join(graphs_dir, filename), 'r') as file:
                    graph = json.load(file)
                    graphs[graph["graph_name"]] = graph
    except FileNotFoundError:
        print(f"Warning: Directory {graphs_dir} not found. Continuing with empty graphs.")
    except Exception as e:
        print(f"Error loading graphs: {e}")
    return graphs

def get_local_ip():
    """Get the local IP address of the machine"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        hostname = socket.gethostname()
        return socket.gethostbyname(hostname)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--runtime', action='store_true', help='Enable run-time task monitoring.')

    # Specific runtime declarations
    parser.add_argument('--chat', action='store_true', help='When run-time enabled, explicitly run chat interface.')
    parser.add_argument('--action', action='store_true', help='When run-time enabled, explicitly run action interface.')

    # Debug
    parser.add_argument('--debug', action='store_true', help='Enable debug messages in the chat interface.')
    app.config['DEBUG_MODE'] = debug_mode

    args, unknown = parser.parse_known_args()

    # Check if run-time is enabled
    runtime_enabled = args.runtime
    debug_mode = args.debug

    # Check if specific runtimes are requested
    chat_enabled = args.chat
    action_enabled = args.action

    # Print configuration
    if debug_mode:
        print(" * Debug mode enabled")

    print(f" * Runtime mode: {'enabled' if runtime_enabled else 'disabled'}")
    print(f" * Chat interface: {'enabled' if chat_enabled else 'disabled'}")
    print(f" * Action interface: {'enabled' if action_enabled else 'disabled'}")

    # Define empty global graphs container
    graphs = {}

    if runtime_enabled:
        import rclpy

        # Initialize ROS
        try:
            if not rclpy.ok():
                rclpy.init()

            # Check for targeted runtimes
            targeted_runtime = chat_enabled or action_enabled
            
            # If no specific component is enabled, enable all by default with runtime flag
            if not targeted_runtime:
                chat_enabled = True
                action_enabled = True
            
            # Initialize ROS nodes with dedicated module callbacks
            print(" * Initializing Socket connections and ROS nodes...")
            
            chat_node = setup_chat_socket(app, socketio, chat_enabled)
            if chat_enabled and chat_node is None:
                print(" ! Warning: Chat node failed to initialize")
                
            action_node = setup_action_socket(app, socketio, action_enabled)
            if action_enabled and action_node is None:
                print(" ! Warning: Action node failed to initialize")
                
            print(" * ROS interface active")
        except Exception as e:
            print(f" ! Error initializing ROS: {e}")
            import traceback
            traceback.print_exc()

    else:
        # Load example graphs if no runtime
        graphs = load_graphs("example_graphs")
        print(f" * Loaded {len(graphs)} example graphs")
    
    ip = get_local_ip()
    print("\n" + "=" * 50)
    print(f"Server running on: http://{ip}:4000")
    print(f"Connect other devices using this address")
    print("=" * 50 + "\n")
    
    # Run the Flask app
    socketio.run(app, host='0.0.0.0', port=4000)