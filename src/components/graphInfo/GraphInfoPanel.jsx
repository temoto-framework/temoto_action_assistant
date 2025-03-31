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

const GraphInfoPanel = ({ selectedElement, onActionUpdated, onGenerateAction }) => {
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
    }
  }, [selectedElement]);

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

  return (
    <div className="graph-info-container">
      <div className="info-header">
        <h2>{getTitle()}</h2>
        
        {/* Show status badge if it's an action */}
        {selectedElement.type === 'action' && (
          <div className={`status-badge ${selectedElement.data.gui_attributes?.status || 'unknown'}`}>
            {selectedElement.data.gui_attributes?.status === 'draft' ? 'Draft' : 
             selectedElement.data.gui_attributes?.status === 'package' ? 'Package' : 'Package'}
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
      
      {/* Only show Generate button for draft actions */}
      {selectedElement.type === 'action' && 
       selectedElement.data.gui_attributes?.status === 'draft' && 
       !generationSuccess && (
        <button 
          className="generate-button"
          onClick={() => onGenerateAction(selectedElement.data, editedName)}
        >
          Generate Action
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