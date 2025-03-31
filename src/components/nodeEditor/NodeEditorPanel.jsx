import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle} from 'react';
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  // Panel,
} from '@xyflow/react';
import produce from 'immer';

import SpinNode, { type SpinNodeData } from './SpinNode.tsx';

// import '@xyflow/react/dist/style.css';

import '@xyflow/react/dist/base.css';
// import "./NodeEditorPanel.css";
import "./SpinNode.css";
import "./SelectedNode.css";

import { useDnD } from "../../components/actionList/DnDContext.jsx";

const nodeTypes = {
  turbo: SpinNode,
};

const NodeEditorPanel = forwardRef(({ graphDataIn, onUpdateGraph, onNodeSelect }, ref) => {

  const [activeGraph, setActiveGraph] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState();
  const [edges, setEdges, onEdgesChange] = useEdgesState();
  const [rfInstance, setRfInstance] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const { screenToFlowPosition } = useReactFlow();
  const [type] = useDnD();

  console.log("Nodes: ", nodes)
  console.log("Edges: ", edges)

  useImperativeHandle(ref, () => ({
    getCurrentGraph() {
      if (activeGraph) {
        return Promise.resolve(onUpdateGraph(flowToJson()));
      }
      return Promise.resolve(); // Return resolved promise if no activeGraph
    },
    clearActiveNode: () => {
      console.log("Clearing active node", selectedNodeId);
      setSelectedNodeId(null);
    }
  }));

  const jsonToFlow = useCallback((graphJson) => {
    // Early return if graphJson is undefined or null
    if (!graphJson) {
      console.warn('jsonToFlow called with undefined or null graphJson');
      setNodes([]);
      setEdges([]);
      setActiveGraph(null);
      return;
    }
  
    // Add a check for actions array
    const new_nodes = graphJson.actions?.map((action) => {
      // Existing node creation logic
      let nodeData = {
        title: action.name,
        subline: action.state && action.state !== 'UNINITIALIZED' ? action.state : '',
        instance_id: action.instance_id,
        type: action.type,
        input_parameters: action.input_parameters,
        output_parameters: action.output_parameters,
        actor: action.actor,
      };
  
      // Conditionally add state field
      if (action.state) {
        nodeData.state = action.state;
      }
  
      return {
        id: `${action.name}_${action.instance_id}`,
        data: nodeData,
        position: action.gui_attributes?.position || { x: 0, y: 0 },
        type: 'turbo'
      };
    }) || [];
  
    const new_edges = graphJson.actions?.flatMap(action =>
      action.children?.map(child => ({
        id: `${action.name}_${action.instance_id} to ${child.name}_${child.instance_id}`,
        source: `${action.name}_${action.instance_id}`,
        target: `${child.name}_${child.instance_id}`,
  
        // Needed for converting back to UMRF graph
        source_name: action.name,
        source_id:   action.instance_id,
        target_name: child.name,
        target_id:   child.instance_id,
      })) || []
    );
  
    setActiveGraph(graphJson)
    setNodes(new_nodes)
    setEdges(new_edges)
  }, [setActiveGraph, setNodes, setEdges]);

  const flowToJson = useCallback(() => {
    console.log("flowToJson: ", activeGraph.graph_name)

    // Start with all existing fields from activeGraph
    let activeGraphUpdated = {
        ...activeGraph,  // Preserve all existing fields
        actions: []      // Reset actions array as it will be rebuilt
    };

    if (activeGraph.graph_state){
      activeGraphUpdated.graph_state = activeGraph.graph_state;
    }

    if (rfInstance) {
        const flow = rfInstance.toObject();

        // For each "node" in flow.nodes, create a json object "umrf_node"
        flow.nodes.forEach(node => {
            let umrf_node = {
                name: node.data.title,
                instance_id: node.data.instance_id,
                type: node.data.type,
                parents: [],
                children: [],
                gui_attributes: {position: node.position},
                input_parameters: node.data.input_parameters,
                output_parameters: node.data.output_parameters,
                actor: node.data.actor
            };

            if (node.data.state){
              umrf_node.state = node.data.state
            }

            // Find edges where the node is a source or target
            flow.edges.forEach(edge => {
                if (node.data.title === edge.source_name && node.data.instance_id === edge.source_id) {
                    // If node is a source, add to children
                    umrf_node.children.push({
                        name: edge.target_name,
                        instance_id: edge.target_id
                    });
                } else if (node.data.title === edge.target_name && node.data.instance_id === edge.target_id) {
                    // If node is a target, add to parents
                    umrf_node.parents.push({
                        name: edge.source_name,
                        instance_id: edge.source_id
                    });
                }
            });

            // Add "umrf_node" to "activeGraphUpdated.actions" array
            activeGraphUpdated.actions.push(umrf_node);
        });
    }

    return activeGraphUpdated;
  }, [activeGraph, rfInstance]);

  useEffect(() => {
    if (graphDataIn) {
      jsonToFlow(graphDataIn);
    }
  }, [graphDataIn, jsonToFlow]);

  useEffect(() => {
    return () => {
      // Clean up when component unmounts or when graphDataIn changes
      setNodes([]);
      setEdges([]);
      setActiveGraph(null);
    };
  }, [graphDataIn]);

  const onConnect = useCallback(
    (params) => {
      console.log("onConnect: ", params);
      
      // Add the new edge to React Flow
      const newEdges = addEdge(params, edges);
      setEdges(newEdges);

      // Find source and target nodes
      const sourceNode = nodes.find(node => node.id === params.source);
      const targetNode = nodes.find(node => node.id === params.target);

      if (sourceNode && targetNode) {
        // Update the active graph state
        const updatedGraph = produce(activeGraph, draft => {
          // Find the source and target actions in the graph
          const sourceAction = draft.actions.find(
            action => `${action.name}_${action.instance_id}` === params.source
          );
          const targetAction = draft.actions.find(
            action => `${action.name}_${action.instance_id}` === params.target
          );

          if (sourceAction && targetAction) {
            // Add child to source action
            if (!sourceAction.children) {
              sourceAction.children = [];
            }
            
            // Check if child already exists to prevent duplicates
            const childExists = sourceAction.children.some(
              child => child.name === targetAction.name && 
                       child.instance_id === targetAction.instance_id
            );

            if (!childExists) {
              sourceAction.children.push({
                name: targetAction.name,
                instance_id: targetAction.instance_id
              });
            }

            // Add parent to target action
            if (!targetAction.parents) {
              targetAction.parents = [];
            }

            const parentExists = targetAction.parents.some(
              parent => parent.name === sourceAction.name && 
                        parent.instance_id === sourceAction.instance_id
            );

            if (!parentExists) {
              targetAction.parents.push({
                name: sourceAction.name,
                instance_id: sourceAction.instance_id
              });
            }
          }
        });

        // Update the graph in the backend and frontend
        setActiveGraph(updatedGraph);
        onUpdateGraph(updatedGraph);
      }
    },
    [edges, nodes, activeGraph, onUpdateGraph, setEdges]
  );

  const handleNodeClick = (node) => {
    console.log("Node clicked, node: ", node);
    setSelectedNodeId(node.id);
    onNodeSelect(node.data);
  };
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      console.log('Drop event triggered');

      const dragType = type || 'turbo';
      console.log('Type at drop:', dragType);
      if (!dragType) return;

      const actionName = event.dataTransfer.getData('actionName');
      console.log('Action Name at drop:', actionName);
      if (!actionName) return;

      // Convert screen coordinates to flow coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });

      // Create new UMRF node
      const newNode = {
        name: actionName,
        instance_id: Date.now(), // Use timestamp as temporary unique ID
        type: "sync", // Default type
        input_parameters: {}, // Will be populated from action template
        parents: [],
        children: [],
        gui_attributes: {
          position: position
        }
      };

      // Update the graph structure
      const updatedGraph = {
        ...activeGraph,
        actions: [...(activeGraph?.actions || []), newNode]
      };

      setActiveGraph(updatedGraph);
      onUpdateGraph(updatedGraph);

      // Add node to flow
      const flowNode = {
        id: `${actionName}_${newNode.instance_id}`,
        type: dragType,
        position,
        data: {
          title: actionName,
          instance_id: newNode.instance_id,
          type: "sync",
          input_parameters: {},
          output_parameters: {},
        }
      };

      setNodes((nds) => Array.isArray(nds) ? [...nds, flowNode] : [flowNode]);
    },
    [type, setNodes, activeGraph, onUpdateGraph, screenToFlowPosition]
  );

  const onNodesDelete = useCallback(
    (deletedNodes) => {
      console.log("Nodes deleted:", deletedNodes);
      
      if (!activeGraph) return;
      
      // Create updated graph without the deleted nodes
      const updatedGraph = produce(activeGraph, draft => {
        // For each deleted node, remove it from the actions array
        deletedNodes.forEach(deletedNode => {
          const nodeId = deletedNode.id;
          const [nodeName, nodeInstanceId] = nodeId.split('_');
          
          // Find the index of the action to remove
          const actionIndex = draft.actions.findIndex(
            action => action.name === deletedNode.data.title && 
                     action.instance_id.toString() === deletedNode.data.instance_id.toString()
          );
          
          if (actionIndex !== -1) {
            // Remove the action
            draft.actions.splice(actionIndex, 1);
            
            // Update parent/child relationships
            draft.actions.forEach(action => {
              // Remove from children arrays
              if (action.children) {
                action.children = action.children.filter(
                  child => !(child.name === deletedNode.data.title && 
                            child.instance_id.toString() === deletedNode.data.instance_id.toString())
                );
              }
              
              // Remove from parents arrays
              if (action.parents) {
                action.parents = action.parents.filter(
                  parent => !(parent.name === deletedNode.data.title && 
                             parent.instance_id.toString() === deletedNode.data.instance_id.toString())
                );
              }
            });
          }
        });
      });
      
      // Update local state and backend
      setActiveGraph(updatedGraph);
      onUpdateGraph(updatedGraph);
      const wasSelectedNodeDeleted = deletedNodes.some(
        node => node.id === selectedNodeId
      );
    
      if (wasSelectedNodeDeleted) {
        setSelectedNodeId(null);
        onNodeSelect(null);
      }
    },
    [activeGraph, onUpdateGraph]
  );

  // Add a new method to handle edge deletions
  const onEdgesDelete = useCallback(
    (deletedEdges) => {
      console.log("Edges deleted:", deletedEdges);
      
      if (!activeGraph) return;
      
      // Create updated graph without the deleted edges
      const updatedGraph = produce(activeGraph, draft => {
        deletedEdges.forEach(deletedEdge => {
          // Find source and target actions
          const sourceAction = draft.actions.find(
            action => `${action.name}_${action.instance_id}` === deletedEdge.source
          );
          const targetAction = draft.actions.find(
            action => `${action.name}_${action.instance_id}` === deletedEdge.target
          );
          
          if (sourceAction && targetAction) {
            // Remove child from source action
            if (sourceAction.children) {
              sourceAction.children = sourceAction.children.filter(
                child => !(child.name === targetAction.name && 
                          child.instance_id === targetAction.instance_id)
              );
            }
            
            // Remove parent from target action
            if (targetAction.parents) {
              targetAction.parents = targetAction.parents.filter(
                parent => !(parent.name === sourceAction.name && 
                           parent.instance_id === sourceAction.instance_id)
              );
            }
          }
        });
      });
      
      // Update local state and backend
      setActiveGraph(updatedGraph);
      onUpdateGraph(updatedGraph);
    },
    [activeGraph, onUpdateGraph]
  );

  const onNodeDragStop = useCallback(
    (event, node) => {
      console.log("Node dragged and stopped:", node);
      
      if (!activeGraph) return;
      
      // Create updated graph with the new node position
      const updatedGraph = produce(activeGraph, draft => {
        // Find the action that corresponds to this node
        const actionIndex = draft.actions.findIndex(
          action => action.name === node.data.title && 
                   action.instance_id.toString() === node.data.instance_id.toString()
        );
        
        if (actionIndex !== -1) {
          // Update the position in gui_attributes
          if (!draft.actions[actionIndex].gui_attributes) {
            draft.actions[actionIndex].gui_attributes = {};
          }
          
          draft.actions[actionIndex].gui_attributes.position = {
            x: node.position.x,
            y: node.position.y
          };
        }
      });
      
      // Update local state and backend
      setActiveGraph(updatedGraph);
      onUpdateGraph(updatedGraph);
    },
    [activeGraph, onUpdateGraph]
  );

  return (
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        onInit={setRfInstance}
        nodeTypes={nodeTypes}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStop={onNodeDragStop}
        fitView
        fitViewOptions={{ padding: 2 }}
        style={{ backgroundColor: "#F7F9FB"}}
        onNodeClick={(event, node) => handleNodeClick(node)}
        >
          <Background />
      </ReactFlow>
  );
});

export default forwardRef(({graphDataIn, onUpdateGraph, onNodeSelect}, ref) => (
  <ReactFlowProvider>
    <NodeEditorPanel ref={ref} graphDataIn={graphDataIn} onUpdateGraph={onUpdateGraph} onNodeSelect={onNodeSelect} />
  </ReactFlowProvider>
));

// export default NodeEditorPanel;
