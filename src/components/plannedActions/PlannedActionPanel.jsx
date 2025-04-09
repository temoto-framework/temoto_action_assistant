import React, { useEffect, useState } from "react";
import "./PlannedActionPanel.css";
import io from "socket.io-client";

// Helper function to get the server URL dynamically
const getServerUrl = () => {
  return `http://${window.location.hostname}:4000`;
};

// Initialize the Socket.IO connection with dynamic server URL
const socket = io(getServerUrl());

/**
 * ActionItem component displays a single action.
 * It shows the action's title, state, and toggles input parameters display.
 *
 * @param {object} nodeData - Contains details for the action.
 */
const ActionItem = ({ nodeData }) => {
  const [showParams, setShowParams] = useState(false);

  // Toggle the display of input parameters.
  const toggleParams = () => {
    setShowParams((prev) => !prev);
  };

  return (
    <div className="planned-action-item">
      {/* Display the action's state/subline */}
      <div className="status-action-item">{nodeData.subline}</div>

      {/* Action header displaying the title */}
      <div className="planned-action-item-header">
        <div className="action-title">{nodeData.title}</div>
      </div>

      {/* Toggle for showing/hiding input parameters */}
      <div className="parameter-toggle" onClick={toggleParams}>
        {showParams ? "Hide input parameters" : "Show input parameters"}
      </div>

      {/* Conditionally render the parameters */}
      {showParams && (
        <div className="parameters-container">
          {nodeData.input_parameters ? (
            <ul>
              {Object.entries(nodeData.input_parameters).map(([key, value]) => (
                <li key={key}>
                  <strong>{key}:</strong>{" "}
                  {typeof value === "object" ? JSON.stringify(value) : value}
                </li>
              ))}
            </ul>
          ) : (
            <p>No input parameters</p>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * PlannedActionPanel component listens for the "umrf_feedback_data" socket event,
 * extracts actions from each actor's graph, and displays them.
 * It includes a drop-down menu to filter actions by actor, defaulting to "None".
 */
const PlannedActionPanel = () => {
  // State to hold all collected actions.
  const [actions, setActions] = useState([]);
  // State to hold the currently selected actor filter (default is "None")
  const [selectedActor, setSelectedActor] = useState("None");

  useEffect(() => {
    console.log(
      "[PlannedActionPanel] Component mounted. Listening for 'umrf_feedback_data'..."
    );

    // Listen for the 'umrf_feedback_data' event from the backend.
    socket.on("umrf_feedback_data", (data) => {
      console.log("[PlannedActionPanel] Received 'umrf_feedback_data':", data);
      let collectedActions = [];

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

        // If the parsed graph contains an "actions" array, process it.
        if (parsedGraph && Array.isArray(parsedGraph.actions)) {
          // Add the actor info to each action.
          const actionsWithActor = parsedGraph.actions.map((action) => ({
            ...action,
            actor, // tag action with actor name
          }));
          collectedActions = collectedActions.concat(actionsWithActor);
        }
      }

      // Update the state with all collected actions.
      setActions(collectedActions);
    });

    // Cleanup the socket listener when the component unmounts.
    return () => {
      console.log("[PlannedActionPanel] Cleaning up socket listeners...");
      socket.off("umrf_feedback_data");
    };
  }, []);

  // Compute a list of unique actors from the actions.
  const uniqueActors = Array.from(new Set(actions.map((action) => action.actor)));

  // Transform each action into the structure expected by ActionItem.
  const transformedActions = actions.map((action, index) => ({
    title: action.name || `Action ${index + 1}`,
    subline: action.state || "",
    instance_id: action.instance_id || index,
    type: action.type || "",
    input_parameters: action.input_parameters || {},
    output_parameters: action.output_parameters || {},
    actor: action.actor || "Unknown",
  }));

  // Filter actions based on the selected actor.
  // If "None" is selected, no actions are displayed.
  const filteredActions =
    selectedActor === "None"
      ? []
      : transformedActions.filter((action) => action.actor === selectedActor);

  return (
    <div className="planned-action-sub-panel">
      {/* Drop-down filter */}
      <div className="actor-filter">
        <label htmlFor="actor-select">Select Actor : </label>
        <select
          id="actor-select"
          value={selectedActor}
          onChange={(e) => setSelectedActor(e.target.value)}
        >
          <option value="None">None</option>
          {uniqueActors.map((actor) => (
            <option key={actor} value={actor}>
              {actor}
            </option>
          ))}
        </select>
      </div>

      {/* Actions list */}
      <div className="planned-action-sub-container">
        {filteredActions.length === 0 ? (
          <div className="planned-action-item">
            <p>No actions planned</p>
          </div>
        ) : (
          filteredActions.map((nodeData, index) => (
            <ActionItem key={nodeData.instance_id || index} nodeData={nodeData} />
          ))
        )}
      </div>
    </div>
  );
};

export default PlannedActionPanel;