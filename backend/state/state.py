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

