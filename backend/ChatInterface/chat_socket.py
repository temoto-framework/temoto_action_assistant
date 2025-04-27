from flask import request, jsonify, Response
import json
import datetime
import threading
import re

def setup_chat_socket(app, socketio, chat_enabled):
    """Setup all Flask routes and SocketIO handlers for the chat interface"""

    chat_log = {}
    request_response_tracking = {}
    umrf_planned_data = {}
    ri_chat_node = None  # Initialize at function scope
    
    def get_current_timestamp():
        """Return current UTC time in ISO format."""
        return datetime.datetime.utcnow().isoformat() + "Z"

    ### PLANNED ACTIONS

    def graph_planned_callback(actor, graph):
        """Callback function to handle graph feedback from ROS."""
        try:
            # Debug logging to track data flow
            print(f"[DEBUG] graph_planned_callback received data for actor: {actor}")
            print(f"[DEBUG] graph data type: {type(graph)}")
            
            # Ensure we're working with a dictionary
            if isinstance(graph, str):
                try:
                    graph = json.loads(graph)
                    print("[DEBUG] Successfully parsed graph string to JSON")
                except json.JSONDecodeError as e:
                    print(f"[ERROR] Failed to parse graph string: {str(e)}")
            
            # Store the graph data
            umrf_store_planned_data(actor, graph)
            
        except Exception as e:
            print(f"[ERROR] Error in graph_planned_callback: {str(e)}")
            

    def umrf_store_planned_data(actor, graph):
        """Store UMRF feedback data and emit to clients."""
        try:
            print(f"[DEBUG] Storing graph data for actor: {actor}")
            
            graph_stored = {}

            if "actions" in graph:
                graph_stored["actions"] = graph["actions"]
            else:
                graph_stored["actions"] = umrf_planned_data.get(actor, {}).get("actions", [])
            
            if "graph_state" in graph:
                graph_stored["graph_state"] = graph["graph_state"]
            else:
                graph_stored["graph_state"] = umrf_planned_data.get(actor, {}).get("graph_state", "UNKNOWN")

            # Store the data
            umrf_planned_data[actor] = graph_stored
                        
            # Emit the updated data to all clients
            socketio.emit('umrf_planned_data', umrf_planned_data)
            
        except Exception as e:
            print(f"[ERROR] Error in umrf_store_planned_data: {str(e)}")

    ### CHAT 

    @app.route('/send_message', methods=['POST'])
    def http_send_message():
        data = request.get_json()

        actor_list = data.get("actor")
        current_time = get_current_timestamp()
        user = "user"
        message = data.get("message")
        message_type = data.get("type", "request")  # Default to "request" if not provided

        # Append the incoming message to each actor's log.
        for actor in actor_list:
            if actor not in chat_log:
                chat_log[actor] = []  # Initialize if not already present.
            chat_log[actor].append([current_time, user, message, message_type])

        # Check if ri_chat_node is available and the message is not empty.
        if ri_chat_node is not None and message:
            try:
                ros_message = json.dumps({
                    "targets": actor_list, 
                    "message": message,
                    "type": message_type
                })
                
                ri_chat_node.send_chat_message(ros_message)

                # Log a feedback message if debug mode is enabled
                if app.config.get('DEBUG_MODE', False):
                    current_time = get_current_timestamp()
                    feedback_user = "debug"
                    feedback_message = "Message sent"
                    for actor in actor_list:
                        chat_log[actor].append([current_time, feedback_user, feedback_message, "info"])
                
                socketio.emit('chat_log', chat_log)
                return jsonify({"debug": "Message sent"}), 200
            except Exception as e:
                print(f"Error sending message to ROS: {e}")
                # Log an error message if sending failed.
                current_time = get_current_timestamp()
                error_user = "error"
                error_message = f"Error sending message: {str(e)}"
                for actor in actor_list:
                    chat_log[actor].append([current_time, error_user, error_message, "error"])
                
                socketio.emit('chat_log', chat_log)
                return jsonify({"error": f"Error: {str(e)}"}), 500
        else:
            # Log an error message if sending failed.
            current_time = get_current_timestamp()
            error_user = "error"
            error_message = "ROS node not available or empty message"
            for actor in actor_list:
                chat_log[actor].append([current_time, error_user, error_message, "error"])

            socketio.emit('chat_log', chat_log)
            return jsonify({"error": "Unable to send message"}), 400

    @app.route('/add_new_actor', methods=['POST'])
    def add_new_actor_to_log():
        data = request.get_json()
        actor_name = data.get("actor_name")

        if not actor_name:
            return jsonify({"error": "Missing actor_name"}), 400

        if actor_name in chat_log:
            return jsonify({"error": "Actor already exists"}), 400

        chat_log[actor_name] = []
        
        # Log a feedback message.
        current_time = get_current_timestamp()
        feedback_user = "debug"
        feedback_message = f"{actor_name} initialised"
        chat_log[actor_name].append([current_time, feedback_user, feedback_message, "info"])

        socketio.emit('chat_log', chat_log)
        return jsonify({"message": f"Actor {actor_name} added to chat log."}), 200

    @app.route('/chat_interface_page_refresh', methods=['POST'])
    def chat_interface_page_refresh():
        socketio.emit('chat_log', chat_log)
        socketio.emit('umrf_planned_data', umrf_planned_data)
        socketio.emit('debug_mode', app.config.get('DEBUG_MODE', False))
        return jsonify({"message": "Chat interface refreshed", "chat_log": chat_log}), 200
    

    # DISPLAY

    image_lock = threading.Lock()
    display_images = {}  # Format: {"target1": {"name1": image_data, "name2": image_data, ...}, "target2": {...}}
    active_subscriptions = set()
    display_subscriptions = {}  # Format: {"client_id": [{"target": "target1", "name": "name1"}, ...]}
    discovered_feeds = {}

    @app.route('/display_panel_page_refresh', methods=['POST'])
    def display_panel_page_refresh():
        """Send saved display subscriptions and discovered feeds to the client on page refresh"""
        client_id = request.json.get('client_id')
        
        if not client_id:
            return jsonify({"error": "Missing client_id"}), 400
        
        print(f"Display panel refresh request from client {client_id}")
        
        # Send discovered feeds to the client
        targets_list = [{"id": t, "name": t} for t in discovered_feeds.keys()]
        socketio.emit('display_available_targets', targets_list)
        socketio.emit('display_available_feeds', discovered_feeds)
        
        # If we have subscriptions for this client, emit them
        if client_id in display_subscriptions:
            print(f"Found {len(display_subscriptions[client_id])} saved subscriptions for client {client_id}")
            socketio.emit('display_saved_subscriptions', display_subscriptions[client_id])
            
            # Re-subscribe to all topics for this client if runtime is enabled
            if chat_enabled and ri_chat_node:
                for subscription in display_subscriptions[client_id]:
                    target = subscription['target']
                    name = subscription['name']
                    topic = f"/webapp/display_feed/{target}/{name}"
                    
                    if topic not in active_subscriptions:
                        active_subscriptions.add(topic)
                        ri_chat_node.display_subscribe_to_topic(topic, target, name)
                        print(f"Re-subscribed to {topic} for client {client_id}")
        else:
            print(f"No saved subscriptions found for client {client_id}")
        
        return jsonify({"message": "Display panel refreshed"}), 200


    @socketio.on('display_get_feeds')
    def handle_get_feeds():
        """Handle request for available image feeds"""
        # Always return discovered feeds, even if runtime is disabled
        targets_list = [{"id": t, "name": t} for t in discovered_feeds.keys()]
        socketio.emit('display_available_targets', targets_list)
        socketio.emit('display_available_feeds', discovered_feeds)
        
        # If runtime is disabled, return here
        if not chat_enabled or not ri_chat_node:
            return
        
        try:
            # Get all available topics
            available_topics = ri_chat_node.get_available_topics()
            
            # Pattern to match display feed topics
            pattern = r"/webapp/display_feed/([^/]+)/([^/]+)"
            
            # Find the display feed topics and add to discovered_feeds
            for topic in available_topics:
                match = re.match(pattern, topic)
                if match:
                    target = match.group(1)
                    name = match.group(2)
                    
                    # Initialize target in discovered_feeds if not exists
                    if target not in discovered_feeds:
                        discovered_feeds[target] = []
                    
                    # Add name to discovered_feeds if not present
                    if name not in discovered_feeds[target]:
                        discovered_feeds[target].append(name)
                        print(f"Added new feed: {target}/{name}")
            
            # Re-emit with potentially updated feed list
            targets_list = [{"id": t, "name": t} for t in discovered_feeds.keys()]
            socketio.emit('display_available_targets', targets_list)
            socketio.emit('display_available_feeds', discovered_feeds)
            
        except Exception as e:
            print(f"Error in handle_get_feeds: {str(e)}")

    @socketio.on('display_subscribe_to_image')
    def handle_subscribe_to_image(data):
        """Subscribe to a specific image feed"""
        if not chat_enabled or not ri_chat_node:
            print("ERROR: Runtime not enabled for subscription")
            return
        
        target = data.get('target')
        name = data.get('name')
        client_id = data.get('client_id')
        
        if not target or not name:
            print("ERROR: Missing target or name in subscription request")
            return
        
        print(f"DEBUG: Received subscription request for {target}/{name}")
        
        # Store subscription for this client if client_id provided
        if client_id:
            if client_id not in display_subscriptions:
                display_subscriptions[client_id] = []
            
            # Check if subscription already exists for this client
            subscription_exists = False
            for subscription in display_subscriptions[client_id]:
                if subscription['target'] == target and subscription['name'] == name:
                    subscription_exists = True
                    break
            
            # Add subscription if it doesn't exist
            if not subscription_exists:
                display_subscriptions[client_id].append({
                    'target': target,
                    'name': name
                })
                print(f"Added subscription {target}/{name} for client {client_id}")
        
        topic = f"/webapp/display_feed/{target}/{name}"
        if topic not in active_subscriptions:
            active_subscriptions.add(topic)
            print(f"DEBUG: Subscribing to {topic}")
            ri_chat_node.display_subscribe_to_topic(topic, target, name)
            print(f"DEBUG: Subscription sent to ROS node")
        else:
            print(f"DEBUG: Already subscribed to {topic}")

    @socketio.on('display_unsubscribe_from_image')
    def handle_unsubscribe_from_image(data):
        """Unsubscribe from a specific image feed"""
        if not chat_enabled or not ri_chat_node:
            return
        
        target = data.get('target')
        name = data.get('name')
        client_id = data.get('client_id')
        
        if not target or not name:
            return
        
        # Remove from saved subscriptions if client_id is provided
        if client_id and client_id in display_subscriptions:
            display_subscriptions[client_id] = [
                sub for sub in display_subscriptions[client_id] 
                if not (sub['target'] == target and sub['name'] == name)
            ]
            print(f"Removed subscription {target}/{name} for client {client_id}")
        
        # Only unsubscribe if no other clients need this feed
        should_unsubscribe = True
        for client, subscriptions in display_subscriptions.items():
            if client != client_id:  # Check other clients
                for sub in subscriptions:
                    if sub['target'] == target and sub['name'] == name:
                        should_unsubscribe = False
                        break
                if not should_unsubscribe:
                    break
        
        if should_unsubscribe:
            topic = f"/webapp/display_feed/{target}/{name}"
            if topic in active_subscriptions:
                active_subscriptions.remove(topic)
                ri_chat_node.display_unsubscribe_from_topic(topic)
                print(f"Unsubscribed from {topic}")
        else:
            print(f"Not unsubscribing from {target}/{name} as other clients are still subscribed")
            
    @app.route('/api/images/<target>/<name>', methods=['GET'])
    def get_image(target, name):
        """Serve images for the display panel"""
        
        print(f"DEBUG: GET request for {target}/{name}")
        print(f"DEBUG: Full display_images structure: {list(display_images.keys())}")
        
        try:
            with image_lock:
                if target in display_images:
                    print(f"DEBUG: Images for {target}: {list(display_images[target].keys())}")
                    
                    if name in display_images[target]:
                        image_data = display_images[target][name]
                        
                        # Convert array to bytes if needed
                        if hasattr(image_data, 'tobytes'):
                            image_data = image_data.tobytes()
                        elif not isinstance(image_data, bytes):
                            # Try to convert to bytes if it's not already bytes
                            try:
                                image_data = bytes(image_data)
                            except Exception as e:
                                print(f"ERROR: Failed to convert image data to bytes: {e}")
                                # Return error response
                                return Response(
                                    "Error: Image data format not supported", 
                                    status=500,
                                    headers={
                                        'Content-Type': 'text/plain',
                                        'Access-Control-Allow-Origin': '*'
                                    }
                                )
                        
                        content_length = len(image_data) if image_data else 0
                        print(f"DEBUG: Found image, size={content_length} bytes, type={type(image_data)}")
                        
                        # Verify image data starts with JPEG header
                        if content_length > 2 and image_data[:2] == b'\xff\xd8':
                            print("DEBUG: Data appears to be valid JPEG (starts with JPEG header)")
                        else:
                            print("DEBUG: Data may not be valid JPEG")
                            if content_length > 10:
                                print(f"DEBUG: First 10 bytes: {image_data[:10]}")
                        
                        # Make sure image_data is bytes
                        if not isinstance(image_data, bytes):
                            print(f"ERROR: Image data is not bytes: {type(image_data)}")
                            return Response(
                                "Error: Image data is not in bytes format", 
                                status=500,
                                headers={
                                    'Content-Type': 'text/plain',
                                    'Access-Control-Allow-Origin': '*'
                                }
                            )
                        
                        resp = Response(
                            image_data, 
                            mimetype='image/jpeg',
                            headers={
                                'Content-Type': 'image/jpeg',
                                'Access-Control-Allow-Origin': '*',
                                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                                'Content-Length': str(content_length)
                            }
                        )
                        print("DEBUG: Response created, returning")
                        return resp
                    else:
                        print(f"DEBUG: Name {name} not found in target {target}")
            
            print(f"DEBUG: Image {target}/{name} not found")
            return Response(
                "Image not found", 
                status=404,
                headers={
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*'
                }
            )
        except Exception as e:
            print(f"ERROR in get_image: {str(e)}")
            return Response(
                f"Server error: {str(e)}", 
                status=500,
                headers={
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*'
                }
            )

    # Define callbacks that can be used by chat_ros.py
    def chat_feedback_callback(message):
        """
        Callback function to handle chat messages from ROS.
        It parses the message, updates the chat_log, and emits the full log.
        """
        if app.config.get('DEBUG_MODE', False):
            print(f"[DEBUG] In chat_feedback_callback with message: {message}")
        
        try:
            data = json.loads(message)

            actor_list = data.get("targets", [])
            current_time = get_current_timestamp()
            msg = data.get("message", "")
            msg_type = data.get("type", "")
            
            if app.config.get('DEBUG_MODE', False):
                print(f"[DEBUG] Received message with type: {msg_type} for targets: {actor_list}")
            
            if not actor_list:
                print("[WARNING] Received message with no targets, skipping")
                return
                
            for actor in actor_list:
                # Use the actor's identifier as the user.
                user = str(actor)
                if actor not in chat_log:
                    chat_log[actor] = []
                chat_log[actor].append([current_time, user, msg, msg_type])
            
            try:
                socketio.emit('chat_log', chat_log)
                if app.config.get('DEBUG_MODE', False):
                    print("[DEBUG] Emitted chat_log event")
            except Exception as e:
                print(f"[ERROR] Failed to emit chat_log event: {e}")
            
        except json.JSONDecodeError as e:
            print(f"[ERROR] Failed to parse JSON message: {message}, error: {e}")
        except Exception as e:
            print(f"[ERROR] Unexpected error in chat_feedback_callback: {e}")
    
    def display_feed_callback(target, name, image_data):
        """Callback to handle image data from ROS"""
        
        print(f"Received image data for {target}/{name}, size: {len(image_data) if image_data else 0} bytes")
        
        # Ensure we have valid data
        if not image_data or len(image_data) < 10:
            print(f"WARNING: Invalid or empty image data received for {target}/{name}")
            return
        
        # Add this - ensure this feed is in our discovered feeds
        if target not in discovered_feeds:
            discovered_feeds[target] = []
        if name not in discovered_feeds[target]:
            discovered_feeds[target].append(name)
            print(f"Added new feed from callback: {target}/{name}")
            
            # Notify clients about new available feeds
            targets_list = [{"id": t, "name": t} for t in discovered_feeds.keys()]
            socketio.emit('display_available_targets', targets_list)
            socketio.emit('display_available_feeds', discovered_feeds)
        
        with image_lock:
            # Initialize target dict if needed
            if target not in display_images:
                display_images[target] = {}
            
            # Store the image data
            display_images[target][name] = image_data
            print(f"Stored image for {target}/{name} in display_images, size: {len(image_data)} bytes")
            # Debug print the entire structure
            print(f"Current display_images keys: {list(display_images.keys())}")
            if target in display_images:
                print(f"Current {target} image keys: {list(display_images[target].keys())}")
        
        # Notify clients that the image was updated
        socketio.emit('image_updated', {"target": target, "name": name})
        print(f"Emitted image_updated for {target}/{name}")        

    if chat_enabled:
        try:
            # Import from local module
            from ChatInterface import chat_ros
            
            # Start the ROS thread
            chat_ros.run_ros_chat_thread(graph_planned_callback, chat_feedback_callback, display_feed_callback)
            
            # Wait for node to initialize with timeout
            if chat_ros.wait_until_initialized(timeout=10.0):
                ri_chat_node = chat_ros.ros_chat_node
                print("ROS chat node initialized successfully")
            else:
                print("Warning: Timed out waiting for ROS chat node to initialize")
            
            return ri_chat_node
        except Exception as e:
            print(f"Error initializing chat node: {e}")
            return None
    else:
        return None