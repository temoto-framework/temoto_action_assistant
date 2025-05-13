import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
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

import SpinNode from './SpinNode.tsx';
import { EntryNode, ExitNode } from './EntryExitNode.jsx';
// import '@xyflow/react/dist/style.css';

import '@xyflow/react/dist/base.css';
// import "./NodeEditorPanel.css";
import "./SpinNode.css";
import "./SelectedNode.css";
import "./EntryExitNode.css";

import { useDnD } from "../../components/actionList/DnDContext.jsx";
import * as GraphConversionUtils from '../../utils/GraphConversion.js';

const nodeTypes = {
  turbo: SpinNode,
  entry: EntryNode,
  exit: ExitNode,
};

const NodeEditorPanel = forwardRef(({ graphDataIn, onUpdateGraph, onNodeSelect, onEdgeSelect }, ref) => {

  const [activeGraph, setActiveGraph] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState();
  const [edges, setEdges, onEdgesChange] = useEdgesState();
  const [rfInstance, setRfInstance] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const { screenToFlowPosition } = useReactFlow();
  const [type] = useDnD();

  console.log("Nodes: ", nodes)
  console.log("Edges: ", edges)

  const buildEdgeData = useCallback((edge) => {
    if (!edge || !activeGraph) return {
      type: 'edge',
      source: { name: '', instance_id: '' },
      target: { name: '', instance_id: '' },
      conditions: []
    };
    
    if (edge.source === 'entry-node' || edge.target === 'exit-node') {
      // Handle special case for entry/exit nodes
      if (edge.source === 'entry-node') {
        return {
          type: 'entry-connection',
          target: edge.target
        };
      } else if (edge.target === 'exit-node') {
        return {
          type: 'exit-connection',
          source: edge.source
        };
      }
    }
    
    // Regular node connection
    const sourceNodeId = edge.source;
    const targetNodeId = edge.target;
    
    // Parse node IDs to get names and instance IDs
    const [sourceName, sourceInstanceId] = sourceNodeId.split('_');
    const [targetName, targetInstanceId] = targetNodeId.split('_');
    
    // Find source and target actions in the graph
    const sourceAction = activeGraph.actions.find(
      action => action.name === sourceName && 
                action.instance_id.toString() === sourceInstanceId
    );
    
    const targetAction = activeGraph.actions.find(
      action => action.name === targetName && 
                action.instance_id.toString() === targetInstanceId
    );
    
    if (sourceAction && targetAction) {
      // Check if the target action has the source as a parent
      const parentRelation = targetAction.parents?.find(
        parent => parent.name === sourceName && 
                  parent.instance_id.toString() === sourceInstanceId
      );
      
      return {
        type: 'edge',
        source: {
          name: sourceName,
          instance_id: sourceInstanceId,
          node: sourceAction
        },
        target: {
          name: targetName,
          instance_id: targetInstanceId,
          node: targetAction
        },
        conditions: parentRelation?.conditions || []
      };
    }
    
    return {};
  }, [activeGraph]);

  // TODO: Remove if you don't need this anymore
  const handleEdgeButtonClick = useCallback((event, edge) => {
    event.stopPropagation();
    console.log("Edge button clicked:", 'edge.id:', edge.id, 'edge.source:', edge.source, 'edge.target:', edge.target);

    setSelectedNodeId(null);
    setSelectedEdgeId(edge.id);

    onEdgeSelect({id: edge.id, source: edge.source, target: edge.target});

  }, [onEdgeSelect]);

  // Clean handler for node clicks
  const handleNodeClick = useCallback((event, node) => {
    // Clear any selected edge
    setSelectedEdgeId(null);
    
    // Set this node as selected
    setSelectedNodeId(node.id);
    
    // Notify parent component about the selected node
    onNodeSelect(node.data);
  }, [onNodeSelect]);

  // Clean handler for pane clicks (background)
  const handlePaneClick = useCallback(() => {
    // Clear all selections
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    
    // Notify parent that nothing is selected
    onNodeSelect(null);
  }, [onNodeSelect]);

  useImperativeHandle(ref, () => ({
    getCurrentGraph() {
      if (activeGraph && rfInstance) {
        const updatedGraph = GraphConversionUtils.flowToJson(activeGraph, rfInstance);
        return Promise.resolve(onUpdateGraph(updatedGraph));
      }
      return Promise.resolve(); // Return resolved promise if no activeGraph
    },
    clearActiveNode: () => {
      console.log("Clearing active node", selectedNodeId);
      setSelectedNodeId(null);
    },
    clearActiveEdge: () => {
      console.log("Clearing active edge", selectedEdgeId);
      setSelectedEdgeId(null);
    }
  }));

  useEffect(() => {
    if (graphDataIn) {
      const result = GraphConversionUtils.jsonToFlow(graphDataIn);
      setNodes(result.nodes);
      setEdges(result.edges);
      setActiveGraph(result.activeGraph);
    }
  }, [graphDataIn, setNodes, setEdges, setActiveGraph]);

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

      const newEdge = {
        id: `${params.source} to ${params.target}`,
        ...params,
      }
      
      const newEdges = addEdge(newEdge, edges); 
      setEdges(newEdges);
      console.log("newEdges: ", newEdges);

      const sourceNode = nodes.find(node => node.id === params.source);
      const targetNode = nodes.find(node => node.id === params.target);
      
      if (sourceNode && targetNode) {
        // Use the utility function to update node relationships
        const updatedGraph = GraphConversionUtils.updateNodeRelationships(
          activeGraph, 
          params, 
          sourceNode, 
          targetNode
        );
        
        // Update the graph in the backend and frontend
        setActiveGraph(updatedGraph);
        onUpdateGraph(updatedGraph);
      }
    },
    [edges, nodes, activeGraph, onUpdateGraph, setEdges]
  );

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

  const onEdgesDelete = useCallback(
    (deletedEdges) => {
      console.log("Edges deleted:", deletedEdges);
      
      if (!activeGraph) return;
      
      // Create updated graph without the deleted edges
      const updatedGraph = produce(activeGraph, draft => {
        deletedEdges.forEach(deletedEdge => {
          // Handle entry node connection deletion
          if (deletedEdge.source === 'entry-node') {
            const targetParts = deletedEdge.target.split('_');
            if (targetParts.length === 2) {
              // Remove from graph_entry
              if (draft.graph_entry && draft.graph_entry.actions) {
                draft.graph_entry.actions = draft.graph_entry.actions.filter(
                  entry => !(entry.name === targetParts[0] && 
                            entry.instance_id.toString() === targetParts[1])
                );
              }
            }
          }
          
          // Handle exit node connection deletion
          else if (deletedEdge.target === 'exit-node') {
            const sourceParts = deletedEdge.source.split('_');
            if (sourceParts.length === 2) {
              // Remove from graph_exit
              if (draft.graph_exit && draft.graph_exit.actions) {
                draft.graph_exit.actions = draft.graph_exit.actions.filter(
                  exit => !(exit.name === sourceParts[0] && 
                           exit.instance_id.toString() === sourceParts[1])
                );
              }
            }
          }
          
          // Find source and target actions for regular connections
          else {
            const sourceAction = draft.actions.find(
            action => `${action.name}_${action.instance_id}` === deletedEdge.source
          );
          const targetAction = draft.actions.find(
            action => `${action.name}_${action.instance_id}` === deletedEdge.target
          );
          
          if (sourceAction && targetAction) {
            // Remove child from source action
            console.log("sourceAction: ", sourceAction);
            console.log("targetAction: ", targetAction);
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
      
      const updatedGraph = produce(activeGraph, draft => {
        if (node.id === 'entry-node') {
          if (!draft.graph_entry.gui_attributes) {
            draft.graph_entry.gui_attributes = {};
          }
          draft.graph_entry.gui_attributes.position = {
            x: node.position.x,
            y: node.position.y
          };
          return;
        }

        if (node.id === 'exit-node') {
          if (!draft.graph_exit.gui_attributes) {
            draft.graph_exit.gui_attributes = {};
          }
          draft.graph_exit.gui_attributes.position = {
            x: node.position.x,
            y: node.position.y
          };
          return;
        }
        
        const actionIndex = draft.actions.findIndex(
          action => action.name === node.data.title && 
                   action.instance_id.toString() === node.data.instance_id.toString()
        );
        
        if (actionIndex !== -1) {
          if (!draft.actions[actionIndex].gui_attributes) {
            draft.actions[actionIndex].gui_attributes = {};
          }
          
          draft.actions[actionIndex].gui_attributes.position = {
            x: node.position.x,
            y: node.position.y
          };
        }
      });
      
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
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        >
          <Background />
      </ReactFlow>
  );
});

export default forwardRef(({graphDataIn, onUpdateGraph, onNodeSelect, onEdgeSelect}, ref) => (
  <ReactFlowProvider>
    <NodeEditorPanel ref={ref} graphDataIn={graphDataIn} onUpdateGraph={onUpdateGraph} onNodeSelect={onNodeSelect} onEdgeSelect={onEdgeSelect} />
  </ReactFlowProvider>
));

