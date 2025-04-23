from flask import Flask, request, jsonify, Response
from flask_socketio import SocketIO
from flask_cors import CORS
from package_generator.scripts.generate_package import generate_package, save_graph
import json
import datetime
import threading
import re
import traceback
import argparse
import os
import time
import subprocess

graphs = {}

def load_graphs(graphs_dir):
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

def get_graphs():
    return graphs

def setup_action_socket(app, socketio, runtime_enabled):
    """Setup all Flask routes and SocketIO handlers for the action interface"""
    
    actions = {}
    ri_action_node = None # TODO: ideally the ros node should not be exposed like that

    @app.route('/api/graphs/<key>', methods=['GET'])
    def get_graph(key):
        print(f'key: {key}')
        print(f'graphs: {graphs}')
        value = graphs.get(key)
        print(f'value: {value}')
        if value:
            return jsonify(value)
        else:
            return jsonify({"error": "Data not found"}), 404

    @app.route('/api/graphs/<key>', methods=['PUT'])
    def set_graph(key):
        if key in graphs:
            new_data = request.get_json()
            print(f'new_data: {new_data}')

            graphs[key] = new_data
        
            # Save the updated graph
            output_path = 'package_generator/saved_graphs'
            os.makedirs(output_path, exist_ok=True)
            save_graph(new_data, output_path)
        
            print (f'Updated graph: {key}')
            print (f'Updated graphs: {graphs[key]}')
            return jsonify({"message": "Graph updated successfully"}), 200
        else:
            return jsonify({"error": "Graph not found"}), 404

    @app.route('/api/graphs/exec/<key>', methods=['PUT'])
    def exec_graph(key):
        if key in graphs:
            if "graph_state" not in graphs[key] or graphs[key]["graph_state"] != "RUNNING":
                ri_action_node.start_graph(key)
                print (f'Running graph "{key}"')

            elif graphs[key]["graph_state"] == "RUNNING":
                ri_action_node.stop_graph(key)
                print (f'Stopping graph "{key}"')

            return jsonify({"message": "Started graph"}), 200
        else:
            return jsonify({"error": "Graph not found"}), 404

    def save_graph(graph_data, output_path): 
        ''' Save the graph data to the output path ''' 
        graph_name = graph_data["graph_name"] 
        print (f'Saving graph to: {os.path.join(output_path, f"{graph_name}.umrf.graph.json")}')

        os.makedirs(output_path, exist_ok=True)
        with open(os.path.join(output_path, f"{graph_name}.umrf.graph.json"), "w") as f:
            json.dump(graph_data, f, indent=4)
    
        return output_path

    @app.route('/api/graphs', methods=['POST'])
    def create_graph():
        try:
            graph_data = request.json
            graph_data['gui_attributes']['status'] = 'saved'

            print (f'Creating graph: {graph_data}')

            output_path = 'package_generator/saved_graphs'
            os.makedirs(output_path, exist_ok=True)

            graph_path = save_graph(graph_data, output_path)

            print (f'Graph saved to: {graph_path}')

            graph_name = graph_data['graph_name']
            graphs[graph_name] = graph_data

            graphs_list = list(graphs.values())
            socketio.emit('graphs', graphs_list)
        
            return jsonify({'message': f'Graph {graph_name} created successfully'}), 200
        except Exception as e:
            print (f'Error creating graph: {e}')
            return jsonify({'error': str(e)}), 400

    @app.route('/api/generate-action', methods=['POST']) 
    def generate_action():
        global actions
        try:
            action_data = request.json
            action_name = action_data['name']

            umrf_json_path = 'package_generator/saved_actions/'+f'{action_name}.umrf.json'
            templates_path = 'package_generator/templates'
            output_path = 'package_generator/generated_actions'
            framework = 'ROS2'

            print(f'umrf_json_path: {umrf_json_path}')
            print(f'templates_path: {templates_path}')
            print(f'output_path: {output_path}')
            print(f'framework: {framework}')

            os.makedirs('package_generator/saved_actions', exist_ok=True)
            with open('package_generator/saved_actions/'+f'{action_name}.umrf.json', 'w') as f:
                json.dump(action_data, f, indent=4)
        
            os.makedirs(output_path, exist_ok=True)

            # Directly call generate_package and get the package path
            package_path = generate_package(
                umrf_json_path=umrf_json_path, 
                templates_path=templates_path, 
                output_path=output_path, 
                framework=framework
            )

            action_data['status'] = 'package'
            print(f'Generating action: {action_data}')

            actions[action_name] = action_data
        
            actions_list = list(actions.values())
            socketio.emit('actions', actions_list)
    
            return jsonify({
                'message': f'Action {action_name} created successfully', 
            }), 200
        except Exception as e:
            print(f'Error generating action: {e}')
            return jsonify({'error': str(e)}), 400
    
    def load_actions(actions_dir):
        actions = {}
        for filename in os.listdir(actions_dir):
            if filename.endswith('.json'):
                with open(os.path.join(actions_dir, filename), 'r') as file:
                    action = json.load(file)
                    actions[action["name"]] = action
        return actions

    # Potential duplication with Julian's
    def graph_feedback_callback(actor, graphs_in): 
        global actions

        for g in graphs_in:
            g_json = json.loads(g)
            graphs[g_json["graph_name"]] = g_json

        graphs_list = list(graphs.values())
        socketio.emit('graphs', graphs_list)

    """Setup ROS nodes and threads for the action interface"""
    if runtime_enabled:
        try:
            # Import from local module
            from ActionInterface import action_ros
            
            # Start the ROS thread
            action_ros.run_ros_action_thread(graph_feedback_callback)
            
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