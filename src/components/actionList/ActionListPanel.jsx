import React from 'react';
import './ActionListPanel.css';
import { useDnD } from './DnDContext.jsx';

const ActionListPanel = ({ actions, activeActionId, onActionSelect, selectedGraph, onNewAction }) => {
    const [_, setType] = useDnD();

    const handleActionSelectClick = (action) => {
        onActionSelect(action.name);
    };

    const onDragStart = (event, nodeType, actionName) => {
        setType(nodeType);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('actionName', actionName);
        
        if (!selectedGraph) {
            console.warn('Please select a graph before dropping an action');
        }

        console.log('Dragging:', nodeType, ", with action name: ", actionName);
    };

    return (
        <div>
            <div className="buttons-column">
                <h2>Actions</h2>
                {actions && actions.length > 0 ? (
                    actions.map((action, index) => (
                        <div className="buttons-row" key={action.id || index}>
                            <button
                                className={`text-button ${activeActionId === action.name ? 'active-action' : ''}`}
                                onClick={() => handleActionSelectClick(action)}
                                onDragStart={(event) => onDragStart(event, 'action', action.name)}
                                draggable
                            >
                                {action.name}
                            </button>
                        </div>
                    ))
                ) : (
                    <p>No actions available</p>
                )}
                <div className="buttons-row">
                    <button 
                        className="text-button"
                        onClick={onNewAction}
                    >
                        +
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActionListPanel;
