import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import "./PlannedActionPanel.css";

// Helper function to get the server URL dynamically
const getServerUrl = () => {
  return `http://${window.location.hostname}:4000`;
};

// Initialize the Socket.IO connection with dynamic server URL
const socket = io(getServerUrl());

/**
 * ActionItem component displays a single action with simplified parameter display
 */
const ActionItem = ({ nodeData, graphState }) => {
  const [showParameters, setShowParameters] = useState(false);
  
  // Extract the action name (first key in the object)
  const actionName = Object.keys(nodeData)[0] || "Unknown Action";
  
  // Get action data
  const actionData = nodeData[actionName] || {};
  
  // Extract state information (default to "UNINITIALIZED" if not specified)
  const stateKey = "state" in actionData ? "state" : "state" in nodeData ? "state" : null;
  const actionState = stateKey ? (stateKey in actionData ? actionData[stateKey] : nodeData[stateKey]) : "UNINITIALIZED";
  
  // Check if this action is in ERROR state and if graph is running
  const isError = actionState && actionState.toUpperCase() === "ERROR";
  const isGraphRunning = graphState && graphState.toUpperCase() === "RUNNING";
  
  // Determine the CSS class based on the state
  const getStatusClass = (state) => {
    if (!state) return "";
    
    switch (state.toUpperCase()) {
      case "FINISHED":
        return "status-finished";
      case "RUNNING":
        return "status-running";
      case "STOPPED":
        return "status-stopped";
      case "HANDLING":
        return "status-handling";
      case "ERROR":
        return "status-error";
      default:
        return "";
    }
  };

  // Find leaf parameters and organize them
  const organizeParameters = (data) => {
    const result = {
      input_parameters: {},
      output_parameters: {}
    };
    
    // Check if we have input or output parameters
    if (!data || typeof data !== 'object') return result;
    
    // Process all parameters
    Object.entries(data).forEach(([key, value]) => {
      // Skip the state parameter
      if (key === 'state') return;
      
      // Check if this is an input or output parameter group
      if (key === 'input_parameters' || key === 'output_parameters') {
        if (value && typeof value === 'object') {
          // Get all leaf parameters from this group
          extractLeafParams(value, result[key], '');
        }
      }
    });
    
    return result;
  };
  
  // Extract leaf parameters (with actual values)
  const extractLeafParams = (obj, result, prefix) => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.entries(obj).forEach(([key, value]) => {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      
      // If this is a value node with pvf_type and pvf_value
      if (value && typeof value === 'object' && 'pvf_type' in value && 'pvf_value' in value) {
        result[newPrefix] = value.pvf_value;
      }
      // If it's another object, continue recursion
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        extractLeafParams(value, result, newPrefix);
      }
      // If it's a primitive value
      else if (value !== undefined) {
        result[newPrefix] = value;
      }
    });
  };
  
  // Render organized parameters by group
  const renderParameters = (data) => {
    const organizedParams = organizeParameters(data);
    
    return (
      <div className="param-sections">
        {/* Input Parameters Section */}
        <div className="param-section">
          <div className="param-section-header">input_parameters</div>
          {Object.keys(organizedParams.input_parameters).length > 0 ? (
            <div className="param-items">
              {Object.entries(organizedParams.input_parameters).map(([name, value], index) => (
                <div key={index} className="param-item">
                  <div className="param-item-name">
                    <span className="param-bullet">•</span>
                    {name}
                    <span className="param-separator">:</span>
                  </div>
                  <div className="param-item-value">
                    {value === null || value === undefined ? 
                      <span className="null-value">null</span> : 
                      String(value)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="param-empty">None</div>
          )}
        </div>
        
        {/* Output Parameters Section */}
        <div className="param-section">
          <div className="param-section-header">output_parameters</div>
          {Object.keys(organizedParams.output_parameters).length > 0 ? (
            <div className="param-items">
              {Object.entries(organizedParams.output_parameters).map(([name, value], index) => (
                <div key={index} className="param-item">
                  <div className="param-item-name">
                    <span className="param-bullet">•</span>
                    {name}
                    <span className="param-separator">:</span>
                  </div>
                  <div className="param-item-value">
                    {value === null || value === undefined ? 
                      <span className="null-value">null</span> : 
                      String(value)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="param-empty">None</div>
          )}
        </div>
      </div>
    );
  };
  
  // Determine if we need to apply the graph-running class
  const graphRunningClass = isError && isGraphRunning ? 'graph-running' : '';
  
  return (
    <div className={`action-item ${getStatusClass(actionState)} ${graphRunningClass}`}>
      <div className="action-header">
        <div className="action-title">{actionName}</div>
        <div className="action-status">
          {isError && isGraphRunning && (
            <div className="status-thinking">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
          {actionState || "UNINITIALIZED"}
        </div>
      </div>
      
      <button 
        className="action-toggle" 
        onClick={() => setShowParameters(!showParameters)}
      >
        {showParameters ? "Hide parameters" : "Show parameters"}
      </button>
      
      {showParameters && (
        <div className="action-parameters">
          {renderParameters(actionData)}
        </div>
      )}
    </div>
  );
};

/**
 * PlannedActionPanel component
 */
const PlannedActionPanel = () => {
  // State to hold all actions by actor
  const [actions, setActions] = useState({});
  // State to hold the graph state by actor
  const [graphStates, setGraphStates] = useState({});
  // State to hold the currently selected actor
  const [selectedActor, setSelectedActor] = useState(null);

  useEffect(() => {
    console.log(
      "[PlannedActionPanel] Component mounted. Listening for 'umrf_planned_data'..."
    );

    // Listen for the 'umrf_planned_data' event from the backend.
    socket.on("umrf_planned_data", (data) => {
      console.log("[PlannedActionPanel] Received 'umrf_planned_data':", data);
      
      let actorActions = {};
      let actorGraphStates = {};

      // Loop over each actor's graph.
      for (const actor in data) {
        let graphData = data[actor];

        // If graphData is an array, take the last (latest) element.
        if (Array.isArray(graphData)) {
          graphData = graphData[graphData.length - 1];
        }

        let parsedGraph;
        try {
          // If the graph is a string, parse it as JSON.
          parsedGraph =
            typeof graphData === "string" ? JSON.parse(graphData) : graphData;
        } catch (err) {
          console.error(`Error parsing graph for actor ${actor}:`, err);
          continue;
        }

        // Store the actions array and graph state for this actor
        if (parsedGraph) {
          if (Array.isArray(parsedGraph.actions)) {
            actorActions[actor] = parsedGraph.actions;
          }
          
          // Store the graph state
          actorGraphStates[actor] = parsedGraph.graph_state || "UNKNOWN";
        }
      }

      // Update the state with the actor-to-actions mapping and graph states
      setActions(actorActions);
      setGraphStates(actorGraphStates);
    });

    // Request a refresh when the component mounts
    fetch('/chat_interface_page_refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then(data => {
      console.log("[PlannedActionPanel] Page refresh response:", data);
    })
    .catch(error => {
      console.error("[PlannedActionPanel] Error refreshing page:", error);
    });

    // Cleanup the socket listener when the component unmounts.
    return () => {
      console.log("[PlannedActionPanel] Cleaning up socket listeners...");
      socket.off("umrf_planned_data");
    };
  }, []);

  // Get the list of actors
  const actors = Object.keys(actions);
  
  // If no actor is selected and there are actors, select the first one
  useEffect(() => {
    if (!selectedActor && actors.length > 0) {
      setSelectedActor(actors[0]);
    }
  }, [actors, selectedActor]);

  // Get status color class for graph state
  const getGraphStateClass = (state) => {
    if (!state) return "";
    
    switch (state.toUpperCase()) {
      case "RUNNING":
        return "status-running";
      case "PAUSED":
        return "status-handling";
      case "STOPPED":
        return "status-stopped";
      case "FINISHED":
        return "status-finished";
      case "ERROR":
        return "status-error";
      default:
        return "";
    }
  };

  return (
    <div className="action-panel">
      <div className="panel-header">
      {/* Actor selector as dropdown - always show even if no actors */}
      <div className="actor-selector">
        <select
          value={selectedActor || ""}
          onChange={(e) => setSelectedActor(e.target.value)}
          className="actor-dropdown"
        >
          {actors.length === 0 ? (
            <option value="" disabled>No Actions Feedback Available</option>
          ) : (
            <>
              <option value="" disabled>Select Actor</option>
              {actors.map((actor) => (
                <option key={actor} value={actor}>
                  {actor} {graphStates[actor] ? `(${graphStates[actor]})` : ''}
                </option>
              ))}
            </>
          )}
        </select>
      </div>
      </div>

      {/* Main content area */}
      <div className="panel-content">
        {actors.length > 0 && selectedActor ? (
          <>
            {/* Actions list for selected actor */}
            <div className="actions-list">
              {!actions[selectedActor] || actions[selectedActor].length === 0 ? (
                <div className="empty-state">
                  <p>No actions planned for {selectedActor}</p>
                </div>
              ) : (
                actions[selectedActor].map((action, index) => (
                  <ActionItem 
                    key={index} 
                    nodeData={action} 
                    graphState={graphStates[selectedActor]}
                  />
                ))
              )}
            </div>
            
            {/* Graph state at the bottom */}
            {graphStates[selectedActor] && (
              <div className={`graph-state ${getGraphStateClass(graphStates[selectedActor])}`}>
                Graph State: {graphStates[selectedActor]}
              </div>
            )}
          </>
        ) : (
          <div className="actions-list">
            <div className="empty-state">
              <p>No planned actions available.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlannedActionPanel;