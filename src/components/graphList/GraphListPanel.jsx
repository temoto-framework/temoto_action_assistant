import React from 'react';
import './GraphListPanel.css'; // Import the CSS file

const GraphListPanel = ({ graphs, activeGraphId, onGraphSelect, onStartStopClick, onNewGraph, runtimeEnabled }) => {
    const handleGraphSelectClick = (graph) => {
        onGraphSelect(graph.graph_name);
    };

    const handleStartStopClick = (graph) => {
        onStartStopClick(graph.graph_name);
    };

    return (
        <div>
            <div className="buttons-column">
                <h2>Graphs</h2>
                {graphs && graphs.map((graph, index) => (
                    <div className="buttons-row" key={index}>
                        <button
                            className={`text-button ${activeGraphId === graph.graph_name ? 'active' : ''}`}
                            onClick={() => handleGraphSelectClick(graph)}
                        >
                            {graph.graph_name}
                        </button>

                        {runtimeEnabled && (
                            <button
                                className={`icon-button ${graph.graph_state === "RUNNING" ? 'running' : ''}`}
                                onClick={() => handleStartStopClick(graph)}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    fill="currentColor"
                                    className="bi bi-play-fill"
                                    viewBox="0 0 16 16"
                                >
                                    {graph.graph_state === "RUNNING" ? 
                                        (<rect x="4" y="4" width="8" height="8" />) : 
                                        (<path d="M3 2 L13 8 L3 14 Z"/>)
                                    }
                                </svg>
                            </button>
                        )}
                    </div>
                ))}
                
                <div className="buttons-row">
                    <button
                        className="text-button"
                        onClick={onNewGraph}
                    >
                        + 
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GraphListPanel;
