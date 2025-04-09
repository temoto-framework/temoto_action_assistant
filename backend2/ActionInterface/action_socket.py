from flask import request, jsonify

# Global graph data store
graphs = {}

def setup_action_socket(app, socketio, initial_graphs):
    """Setup all Flask routes and SocketIO handlers for the action interface"""
    global graphs
    
    # Initialize graphs with provided data
    graphs.update(initial_graphs)
    
    @app.route('/api/graphs/<key>', methods=['GET'])
    def get_graph(key):
        value = graphs.get(key)
        if value:
            return jsonify(value)
        else:
            return jsonify({"error": "Data not found"}), 404

    @app.route('/api/graphs/<key>', methods=['PUT'])
    def set_graph(key):
        if key in graphs:
            new_data = request.get_json()
            graphs[key] = new_data
            print(f'Updated graph: {key}')
            return jsonify({"message": "Graph updated successfully"}), 200
        else:
            return jsonify({"error": "Graph not found"}), 404

    @app.route('/api/graphs/exec/<key>', methods=['PUT'])
    def exec_graph(key):
        if key in graphs:
            from ActionInterface.action_ros import get_action_node
            action_node = get_action_node()
            
            if action_node:
                if "graph_state" not in graphs[key] or graphs[key]["graph_state"] != "RUNNING":
                    action_node.start_graph(key)
                    print(f'Running graph "{key}"')
                elif graphs[key]["graph_state"] == "RUNNING":
                    action_node.stop_graph(key)
                    print(f'Stopping graph "{key}"')

                return jsonify({"message": "Graph action executed"}), 200
            else:
                return jsonify({"error": "Runtime not available"}), 400
        else:
            return jsonify({"error": "Graph not found"}), 404
            
    # Function for updating graphs
    def update_graphs_list(updated_graphs):
        graphs.update(updated_graphs)
        socketio.emit('graphs', list(graphs.values()))
        
    # Make update_graphs_list accessible
    app.update_graphs_list = update_graphs_list
    
    return True

def get_graphs():
    """Return the current graphs dictionary"""
    return graphs

def update_graphs(new_graphs):
    """Update the graphs dictionary with new graphs"""
    global graphs
    graphs.update(new_graphs)
    return True