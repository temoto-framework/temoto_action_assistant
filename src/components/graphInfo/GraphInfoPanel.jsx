import React, { useState, useEffect } from 'react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import './GraphInfoPanel.css';

// Register the JSON language
SyntaxHighlighter.registerLanguage('json', json);

// Updated Predefined Parameters with detailed compound types
const PREDEFINED_PARAMETERS = [
  { 
    name: 'direction', 
    type: 'string' 
  },
  { 
    name: 'distance', 
    type: 'compound',
    fields: [
      { name: 'amount', type: 'number' },
      { name: 'unit', type: 'string' }
    ]
  },
  { 
    name: 'pose', 
    type: 'compound',
    fields: [
      { 
        name: 'orientation', 
        type: 'compound',
        fields: [
          { name: 'pitch', type: 'number' },
          { name: 'roll', type: 'number' },
          { name: 'yaw', type: 'number' }
        ]
      },
      { 
        name: 'position', 
        type: 'compound',
        fields: [
          { name: 'x', type: 'number' },
          { name: 'y', type: 'number' },
          { name: 'z', type: 'number' }
        ]
      }
    ]
  },
  { 
    name: 'position', 
    type: 'compound',
    fields: [
      { name: 'x', type: 'number' },
      { name: 'y', type: 'number' },
      { name: 'z', type: 'number' }
    ]
  },
  { 
    name: 'verb', 
    type: 'string' 
  }
];

// Condition types and possible outcomes for edge conditions
const CONDITION_TYPES = ['on_true', 'on_false', 'on_error'];
const CONDITION_OUTCOMES = ['run', 'bypass', 'ignore', 'stop'];

// Add a new component for editing edge conditions
const EdgeConditionEditor = ({ edgeData, onConditionsUpdated }) => {
  const [conditions, setConditions] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (edgeData && edgeData.conditions) {
      // Parse conditions from the format "on_true -> run" to structured data
      const parsedConditions = edgeData.conditions.map(condStr => {
        const [condType, outcome] = condStr.split(' -> ');
        return { condType, outcome };
      });
      setConditions(parsedConditions);
      setHasChanges(false);
    }
  }, [edgeData]);

  const handleConditionChange = (index, value) => {
    const updatedConditions = [...conditions];
    updatedConditions[index] = {
      ...updatedConditions[index],
      outcome: value
    };
    setConditions(updatedConditions);
    setHasChanges(true);
  };

  const handleSaveConditions = () => {
    // Convert back to the string format expected by the backend
    const formattedConditions = conditions.map(cond => 
      `${cond.condType} -> ${cond.outcome}`
    );
    
    // Call the parent component's update function
    onConditionsUpdated(formattedConditions);
    setHasChanges(false);
  };

  if (!edgeData || !edgeData.conditions) {
    return <p>No condition data available</p>;
  }

  return (
    <div className="edge-source-target">
      <p><strong>Source:</strong> {edgeData.name} (ID: {edgeData.instance_id})</p>
      <p><strong>Required:</strong> {edgeData.required ? 'Yes' : 'No'}</p>
      
      <div className="conditions-container">
        <h4>Conditions:</h4>
        
        <div className="conditions-list">
          {conditions.map((condition, index) => (
            <div key={index} className="condition-edit-row">
              <span className="condition-type">{condition.condType}</span>
              <span className="condition-arrow">→</span>
              
              <select
                value={condition.outcome}
                onChange={(e) => handleConditionChange(index, e.target.value)}
                className="condition-outcome-select"
              >
                {CONDITION_OUTCOMES.map(outcome => (
                  <option key={outcome} value={outcome}>{outcome}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        
        {hasChanges && (
          <div className="condition-buttons">
            <button 
              onClick={handleSaveConditions}
              className="save-conditions-button"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Add a new component section for displaying entry/exit node information
const EntryExitNodeInfo = ({ type, connections }) => {
  return (
    <div className="entry-exit-info">
      <h3>{type === 'entry' ? 'Entry Node' : 'Exit Node'}</h3>
      <p>
        {type === 'entry' 
          ? 'This node represents the starting point of the graph execution. Connect it to the nodes that should be executed first.'
          : 'This node represents the end point of the graph execution. Connect nodes that should be the final steps to this node.'}
      </p>
      <div className="connections-list">
        <h4>Connected Nodes:</h4>
        {connections && connections.length > 0 ? (
          <ul>
            {connections.map((conn, idx) => (
              <li key={idx}>{conn.name} (ID: {conn.instance_id})</li>
            ))}
          </ul>
        ) : (
          <p>No connections yet. Connect this node to action nodes in the editor.</p>
        )}
      </div>
    </div>
  );
};

const EdgeConditionInfo = ({ edgeData }) => {
  return (
    <div className="edge-condition-info">
      <h3>Edge Conditions</h3>
      
      {edgeData.type === 'entry-connection' ? (
        <div>
          <p>This is a connection from the Entry Node to an action.</p>
          <p>Target Node: {edgeData.target.split('_')[0]} (ID: {edgeData.target.split('_')[1]})</p>
        </div>
      ) : edgeData.type === 'exit-connection' ? (
        <div>
          <p>This is a connection from an action to the Exit Node.</p>
          <p>Source Node: {edgeData.source.split('_')[0]} (ID: {edgeData.source.split('_')[1]})</p>
        </div>
      ) : (
        <div>
          <div className="edge-nodes">
            <p><strong>Source:</strong> {edgeData.source.name} (ID: {edgeData.source.instance_id})</p>
            <p><strong>Target:</strong> {edgeData.target.name} (ID: {edgeData.target.instance_id})</p>
          </div>
          
          <div className="conditions-list">
            <h4>Conditions:</h4>
            {edgeData.conditions && edgeData.conditions.length > 0 ? (
              <ul>
                {edgeData.conditions.map((condition, idx) => (
                  <li key={idx} className="condition-item">
                    {condition}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No conditions defined for this edge. The default behavior will be applied.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = `
.edge-condition-info {
  padding: 10px;
  border-radius: 5px;
  background-color: #f8f9fa;
}

.edge-nodes {
  margin-bottom: 15px;
}

.conditions-list {
  background-color: #fff;
  border-radius: 4px;
  padding: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.condition-item {
  padding: 5px 0;
  border-bottom: 1px solid #eee;
}

.condition-item:last-child {
  border-bottom: none;
}
`;

const GraphInfoPanel = ({ selectedElement, onActionUpdated, onGenerateAction, onEdgeConditionsUpdated }) => {
  const [actionData, setActionData] = useState({
    name: '',
    description: '',
    input_parameters: {},
    gui_attributes: {
        status: ''
    }
  });
  const [generationSuccess, setGenerationSuccess] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isEditingPackage, setIsEditingPackage] = useState(false);
  
  // New state for parameter addition
  const [isAddingParameter, setIsAddingParameter] = useState(false);
  const [selectedParameter, setSelectedParameter] = useState(null);
  const [parameterDetails, setParameterDetails] = useState({});

  useEffect(() => {
    if (selectedElement.type === 'action' && selectedElement.data) {
      setActionData(selectedElement.data);
      setEditedName(selectedElement.data.name);
      setGenerationSuccess(false);
      setIsEditingName(false);
      setIsEditingPackage(false);
    } else {
      // Reset to default state when no action is selected
      setActionData({
        name: '',
        description: '',
        input_parameters: {},
        gui_attributes: {
          status: ''
        }
      });
      setEditedName('');
      setGenerationSuccess(false);
      setIsEditingName(false);
      setIsEditingPackage(false);
    }
  }, [selectedElement]);

  // Handle edge condition updates
  const handleEdgeConditionsUpdated = (updatedConditions) => {
    if (onEdgeConditionsUpdated && selectedElement.type === 'edge') {
      // Create updated edge data with new conditions
      const updatedEdgeData = {
        ...selectedElement.data,
        conditions: updatedConditions
      };
      
      // Call the parent component's update function
      onEdgeConditionsUpdated(updatedEdgeData);
    }
  };

  const handleAddParameter = () => {
    if (!selectedParameter) return;

    const newParameters = { ...actionData.input_parameters };
    
    // Helper function to convert to number or return original value
    const parseNumeric = (value) => {
      const parsed = Number(value);
      return isNaN(parsed) ? null : parsed;
    };

    // Handle different parameter types
    if (selectedParameter.type === 'string') {
      // Simple string parameter
      const paramValue = parameterDetails[selectedParameter.name];
      newParameters[selectedParameter.name] = {
        pvf_type: 'string',
        ...(paramValue ? { pvf_value: paramValue } : {})
      };
    } else if (selectedParameter.type === 'compound') {
      // Compound parameter with nested structure
      if (selectedParameter.name === 'distance') {
        // Simple compound type with amount and unit
        newParameters[selectedParameter.name] = {
          amount: {
            pvf_type: 'number',
            ...(parameterDetails.amount ? { pvf_value: parseNumeric(parameterDetails.amount) } : {})
          },
          unit: {
            pvf_type: 'string',
            ...(parameterDetails.unit ? { pvf_value: parameterDetails.unit } : {})
          }
        };
      } else if (['pose', 'position'].includes(selectedParameter.name)) {
        // More complex compound types
        const parameterStructure = {};
        
        if (selectedParameter.name === 'pose') {
          // Pose has both orientation and position
          parameterStructure.orientation = {
            pitch: {
              pvf_type: 'number',
              ...(parameterDetails.pitch ? { pvf_value: parseNumeric(parameterDetails.pitch) } : {})
            },
            roll: {
              pvf_type: 'number',
              ...(parameterDetails.roll ? { pvf_value: parseNumeric(parameterDetails.roll) } : {})
            },
            yaw: {
              pvf_type: 'number',
              ...(parameterDetails.yaw ? { pvf_value: parseNumeric(parameterDetails.yaw) } : {})
            }
          };
          
          parameterStructure.position = {
            x: {
              pvf_type: 'number',
              ...(parameterDetails.x ? { pvf_value: parseNumeric(parameterDetails.x) } : {})
            },
            y: {
              pvf_type: 'number',
              ...(parameterDetails.y ? { pvf_value: parseNumeric(parameterDetails.y) } : {})
            },
            z: {
              pvf_type: 'number',
              ...(parameterDetails.z ? { pvf_value: parseNumeric(parameterDetails.z) } : {})
            }
          };
        } else {
          // Position is simpler
          parameterStructure.x = {
            pvf_type: 'number',
            ...(parameterDetails.x ? { pvf_value: parseNumeric(parameterDetails.x) } : {})
          };
          parameterStructure.y = {
            pvf_type: 'number',
            ...(parameterDetails.y ? { pvf_value: parseNumeric(parameterDetails.y) } : {})
          };
          parameterStructure.z = {
            pvf_type: 'number',
            ...(parameterDetails.z ? { pvf_value: parseNumeric(parameterDetails.z) } : {})
          };
        }
        
        newParameters[selectedParameter.name] = parameterStructure;
      }
    }

    const updatedAction = {
      ...actionData,
      input_parameters: newParameters
    };

    setActionData(updatedAction);
    
    // Reset state
    setIsAddingParameter(false);
    setSelectedParameter(null);
    setParameterDetails({}); // Reset to empty object

    // Notify parent component about the update
    if (onActionUpdated) {
      onActionUpdated(updatedAction);
    }
  };

  const handleRemoveParameter = (paramName) => {
    const newParameters = { ...actionData.input_parameters };
    delete newParameters[paramName];

    const updatedAction = {
      ...actionData,
      input_parameters: newParameters
    };

    setActionData(updatedAction);

    if (onActionUpdated) {
      onActionUpdated(updatedAction);
    }
  };

  const handleNameEdit = () => {
    if (selectedElement.type === 'action' && 
        selectedElement.data.gui_attributes?.status === 'draft') {
        setIsEditingName(true);
    }
  };

  const handleNameSave = () => {
    if (editedName.trim() === '') {
      // Don't allow empty names
      setEditedName(actionData.name);
      setIsEditingName(false);
      return;
    }

    // Update the action data with the new name
    const updatedAction = {
      ...actionData,
      name: editedName
    };

    setActionData(updatedAction);
    setIsEditingName(false);

    // Notify parent component about the name change
    if (onActionUpdated) {
      onActionUpdated(updatedAction);
    }
  };

  const handleNameChange = (e) => {
    setEditedName(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setEditedName(actionData.name);
      setIsEditingName(false);
    }
  };

  // Update the parameter chip rendering method
  const renderParameterValue = (value, depth = 0) => {
    // Prevent excessive recursion
    if (depth > 3) return '...';

    // Handle null or undefined
    if (value === null || value === undefined) return 'Not Set';

    // Check if it's a PVF-style parameter
    if (value.pvf_type) {
      // If pvf_value exists, show it, otherwise just show the type
      return value.pvf_value !== undefined 
        ? `${value.pvf_type}: ${value.pvf_value}` 
        : value.pvf_type;
    }

    // Handle simple types (string, number)
    if (typeof value !== 'object') {
      return value.toString();
    }

    // Handle object types recursively
    return Object.entries(value)
      .map(([key, val]) => {
        // Recursively render nested objects
        const renderedVal = renderParameterValue(val, depth + 1);
        return `${key}: ${renderedVal}`;
      })
      .join(' ');
  };

  // In the parameter input section, update the placeholder logic
  const getParameterPlaceholder = (parameter) => {
    // Simple types
    if (parameter.type === 'string') return 'string';
    if (parameter.type === 'number') return 'number';

    // Compound types - just return 'compound'
    if (parameter.type === 'compound') return 'compound';

    return 'value';
  };

  const renderInputFields = (parameter) => {
    // Recursively generate input fields based on the parameter structure
    const generateInputFields = (param) => {
      if (param.type === 'string') {
        return (
          <input 
            type="text" 
            placeholder={`${param.name} (${param.type})`} 
            value={parameterDetails[param.name] || ''}
            onChange={(e) => setParameterDetails(prev => ({
              ...prev, 
              [param.name]: e.target.value
            }))}
            className="parameter-input"
          />
        );
      }

      if (param.type === 'number') {
        return (
          <input 
            type="text" 
            placeholder={`${param.name} (${param.type})`} 
            value={parameterDetails[param.name] || ''}
            onChange={(e) => setParameterDetails(prev => ({
              ...prev, 
              [param.name]: e.target.value
            }))}
            className="parameter-input"
          />
        );
      }

      if (param.type === 'compound' && param.fields) {
        return param.fields.map(field => {
          if (field.type === 'compound') {
            return (
              <div key={field.name} className="compound-section">
                <h4>{field.name}</h4>
                {field.fields.map(subField => (
                  <input 
                    key={subField.name}
                    type="text" 
                    placeholder={`${subField.name} (${subField.type})`} 
                    value={parameterDetails[subField.name] || ''}
                    onChange={(e) => setParameterDetails(prev => ({
                      ...prev, 
                      [subField.name]: e.target.value
                    }))}
                    className="parameter-input"
                  />
                ))}
              </div>
            );
          }

          return (
            <input 
              key={field.name}
              type="text" 
              placeholder={`${field.name} (${field.type})`} 
              value={parameterDetails[field.name] || ''}
              onChange={(e) => setParameterDetails(prev => ({
                ...prev, 
                [field.name]: e.target.value
              }))}
              className="parameter-input"
            />
          );
        });
      }

      return null;
    };

    // Render input fields for the selected parameter
    return (
      <div className="parameter-details">
        {generateInputFields(parameter)}
        
        <div className="parameter-buttons">
          <button 
            onClick={handleAddParameter}
            className="confirm-parameter-button"
          >
            Add
          </button>
          <button 
            onClick={() => {
              setIsAddingParameter(false);
              setSelectedParameter(null);
            }}
            className="cancel-parameter-button"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (!selectedElement || !selectedElement.type) {
      return <div>Select a graph, action, node, or edge to view details</div>;
    }

    switch (selectedElement.type) {
      case 'graph':
        // ... existing graph rendering
      case 'action':
        // ... existing action rendering
      case 'node':
        // ... existing node rendering
      case 'entry':
        return <EntryExitNodeInfo type="entry" connections={selectedElement.data.connections} />;
      case 'exit':
        return <EntryExitNodeInfo type="exit" connections={selectedElement.data.connections} />;
      case 'edge':
        return <EdgeConditionEditor edgeData={selectedElement.data} onConditionsUpdated={handleEdgeConditionsUpdated} />;
      default:
        return <div>Unknown element type</div>;
    }
  };

  if (!selectedElement.data) {
    return (
      <div className="graph-info-container">
        <h2>Details</h2>
        <pre className="placeholder-text">Select a graph, node, or action</pre>
      </div>
    );
  }

  // Determine title based on the type
  const getTitle = () => {
    switch (selectedElement.type) {
      case 'graph': return 'Graph Details';
      case 'node': return 'Node Details';
      case 'action': return 'Action Details';
      case 'entry': return 'Entry Node';
      case 'exit': return 'Exit Node';
      case 'edge': return 'Edge Conditions';
      default: return 'Details';
    }
  };

  // Create a modified version of the data for display
  const getDisplayData = () => {
    if (selectedElement.type === 'action') {
      // Create a copy to avoid modifying the original
      const displayData = { ...selectedElement.data };
      
      // If we're editing the name, show the edited name in the JSON display
      if (isEditingName) {
        displayData.name = editedName;
      }
      
      return displayData;
    }
    
    return selectedElement.data;
  };

  // Add a safety check before accessing input_parameters
  const parameters = actionData?.input_parameters || {};

  // Handle converting a package action to draft mode for editing
  const handleEditPackage = () => {
    const updatedAction = {
      ...actionData,
      gui_attributes: {
        ...actionData.gui_attributes,
        status: 'draft',
        previousStatus: 'package' // Store the previous status
      }
    };
    
    setActionData(updatedAction);
    setIsEditingPackage(true);
    
    // Notify parent component about the update
    if (onActionUpdated) {
      onActionUpdated(updatedAction);
    }
  };

  return (
    <div className="graph-info-container">
      <div className="info-header">
        <h2>{getTitle()}</h2>
        
        {/* Show status badge if it's an action */}
        {selectedElement.type === 'action' && (
          <div className="status-badge-container">
            <div className={`status-badge ${selectedElement.data.gui_attributes?.status || 'unknown'}`}>
              {selectedElement.data.gui_attributes?.status === 'draft' ? 'Draft' : 
               selectedElement.data.gui_attributes?.status === 'package' ? 'Package' : 'Package'}
            </div>
          </div>
        )}
        
        {/* Name editing for draft actions */}
        {selectedElement.type === 'action' && selectedElement.data.gui_attributes?.status === 'draft' && (
          <div className="action-name-editor">
            {isEditingName ? (
              <div className="name-input-container">
                <input
                  type="text"
                  value={editedName}
                  onChange={handleNameChange}
                  onBlur={handleNameSave}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="name-input"
                />
                <button className="save-name-button" onClick={handleNameSave}>
                  Save
                </button>
              </div>
            ) : (
              <div className="name-display" onClick={handleNameEdit}>
                <span className="action-name">{actionData.name}</span>
                <span className="edit-icon">✏️</span>
              </div>
            )}
          </div>
        )}

        {/* Parameter Addition for Draft Actions */}
        {selectedElement.type === 'action' && selectedElement.data.gui_attributes?.status === 'draft' && (
          <>
            {/* Parameter List for Draft Actions */}
            {Object.keys(parameters).length > 0 && (
              <div className="current-parameters">
                {Object.entries(parameters).map(([name, value]) => (
                  <div key={name} className="parameter-chip">
                    <span className="parameter-name">{name}</span>
                    <span className="parameter-value">
                      {renderParameterValue(value)}
                    </span>
                    <button 
                      onClick={() => handleRemoveParameter(name)}
                      className="remove-parameter-button"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Parameter Addition Section */}
            <div className="parameter-addition-section">
              {!isAddingParameter ? (
                <button 
                  className="add-parameter-button" 
                  onClick={() => setIsAddingParameter(true)}
                >
                  + Add Parameter
                </button>
              ) : (
                <div className="parameter-input-container">
                  <select 
                    value={selectedParameter?.name || ''}
                    onChange={(e) => {
                      const param = PREDEFINED_PARAMETERS.find(p => p.name === e.target.value);
                      setSelectedParameter(param);
                    }}
                    className="parameter-select"
                  >
                    <option value="">Select Parameter</option>
                    {PREDEFINED_PARAMETERS.map(param => (
                      <option key={param.name} value={param.name}>
                        {param.name} ({getParameterPlaceholder(param)})
                      </option>
                    ))}
                  </select>

                  {selectedParameter && renderInputFields(selectedParameter)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Show edge condition editor for edges */}
      {selectedElement.type === 'edge' && (
        <div className="edge-condition-section">
          {renderContent()}
        </div>
      )}
      
      {/* Always show the JSON representation for debugging */}
      <SyntaxHighlighter 
        language="json" 
        style={vs2015}
        customStyle={{
          borderRadius: '5px',
          margin: '0',
          padding: '15px',
          width: '100%',
          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
        }}
      >
        {JSON.stringify(getDisplayData(), null, 2)}
      </SyntaxHighlighter>
      
      {/* Show Edit button for package actions */}
      {selectedElement.type === 'action' && 
       selectedElement.data.gui_attributes?.status === 'package' && 
       !isEditingPackage && (
        <button 
          className="edit-package-button"
          onClick={handleEditPackage}
        >
          Edit Package
        </button>
      )}
      
      {/* Only show Generate button for draft actions */}
      {selectedElement.type === 'action' && 
       selectedElement.data.gui_attributes?.status === 'draft' && 
       !generationSuccess && (
        <button 
          className="generate-button"
          onClick={() => onGenerateAction(selectedElement.data, editedName)}
        >
          {selectedElement.data.gui_attributes?.previousStatus === 'package' ? 'Regenerate Package' : 'Generate Action'}
        </button>
      )}
      
      {generationSuccess && (
        <div className="success-message">
          Action Generated Successfully!
        </div>
      )}
    </div>
  );
};

export default GraphInfoPanel;