import produce from 'immer';

/**
 * Creates node data object from an action
 * @param {Object} action - The action object from the graph JSON
 * @returns {Object} - Node data for ReactFlow
 */
export const createNodeDataFromAction = (action) => {
  return {
    title: action.name,
    subline: action.state && action.state !== 'UNINITIALIZED' ? action.state : '',
    instance_id: action.instance_id,
    type: action.type,
    input_parameters: action.input_parameters,
    output_parameters: action.output_parameters,
    actor: action.actor,
    state: action.state
  };
};

/**
 * Calculate position for entry node
 * @param {Object} graphJson - The graph JSON
 * @param {Array} actionNodes - The action nodes array
 * @returns {Object} - Position {x, y}
 */
export const calculateEntryPosition = (graphJson, actionNodes) => {
  if (graphJson.graph_entry?.gui_attributes?.position) {
    return graphJson.graph_entry.gui_attributes.position;
  }

  // If no actions, use default
  if (!actionNodes.length) {
    return { x: -100, y: -150 };
  }

  // Find the topmost action node's y position and center horizontally
  const topY = Math.min(...actionNodes.map(node => node.position.y));
  const centerX = actionNodes.reduce((sum, node) => sum + node.position.x, 0) / actionNodes.length;
  
  return { 
    x: centerX,
    y: topY - 150 
  };
};

/**
 * Calculate position for exit node
 * @param {Object} graphJson - The graph JSON
 * @param {Array} actionNodes - The action nodes array
 * @returns {Object} - Position {x, y}
 */
export const calculateExitPosition = (graphJson, actionNodes) => {
  if (graphJson.graph_exit?.gui_attributes?.position) {
    return graphJson.graph_exit.gui_attributes.position;
  }

  // If no actions, use default
  if (!actionNodes.length) {
    return { x: -100, y: 150 };
  }

  // Find the bottommost action node's y position and center horizontally
  const bottomY = Math.max(...actionNodes.map(node => node.position.y));
  const centerX = actionNodes.reduce((sum, node) => sum + node.position.x, 0) / actionNodes.length;
  
  return { 
    x: centerX - 100,
    y: bottomY + 150 
  };
};

/**
 * Create ReactFlow nodes from graph JSON
 * @param {Object} graphJson - The graph JSON
 * @returns {Array} - Array of ReactFlow nodes
 */
export const createNodesFromGraph = (graphJson) => {
  if (!graphJson || !graphJson.actions) {
    console.warn('Invalid graph JSON provided to createNodesFromGraph');
    return [];
  }

  // Create action nodes
  const actionNodes = graphJson.actions.map((action) => {
    const nodeData = createNodeDataFromAction(action);
    
    return {
      id: `${action.name}_${action.instance_id}`,
      data: nodeData,
      position: action.gui_attributes?.position || { x: 0, y: 0 },
      type: 'turbo',
    };
  });

  // Create entry and exit nodes
  const nodes = [...actionNodes];
  
  // Add entry node if it exists
  if (graphJson.graph_entry && graphJson.graph_entry.actions && graphJson.graph_entry.actions.length > 0) {
    nodes.push({
      id: 'entry-node',
      data: { 
        type: 'entry',
        connections: graphJson.graph_entry.actions
      },
      position: calculateEntryPosition(graphJson, actionNodes),
      type: 'entry'
    });
  }
  
  // Add exit node if it exists
  if (graphJson.graph_exit && graphJson.graph_exit.actions && graphJson.graph_exit.actions.length > 0) {
    nodes.push({
      id: 'exit-node',
      data: { 
        type: 'exit',
        connections: graphJson.graph_exit.actions
      },
      position: calculateExitPosition(graphJson, actionNodes),
      type: 'exit'
    });
  }
  
  return nodes;
};

/**
 * Parse conditions from a string format
 * @param {Array} conditions - Array of condition strings
 * @returns {Array | undefined} - Array of parsed condition objects
 */
export const parseConditions = (conditions) => {
  if (!conditions || !Array.isArray(conditions)) return undefined;
  
  return conditions.map(condStr => {
    const [condType, outcome] = condStr.split(' -> ');
    return { condType, outcome };
  });
};

/**
 * Get source handle based on run condition
 * @param {Array} parsedConditions - Array of parsed condition objects
 * @returns {string|undefined} - Source handle identifier
 */
export const getSourceHandleFromConditions = (parsedConditions) => {
  if (!parsedConditions) return 'source-on-true';

  const CONDITION_TO_SOURCE_HANDLE = {
    'on_true': 'source-on-true',
    'on_false': 'source-on-false',
    'on_error': 'source-on-error',
    'on_stopped': 'source-on-stopped'
  };
  
  const runCondition = parsedConditions?.find(cond => cond.outcome === 'run')?.condType;
  return CONDITION_TO_SOURCE_HANDLE[runCondition];
};

/**
 * Create edges for action nodes
 * @param {Object} graphJson - The graph JSON
 * @returns {Array} - Array of edges for action nodes
 */
export const createActionEdges = (graphJson) => {
  if (!graphJson || !graphJson.actions) return [];
  
  return graphJson.actions.flatMap(action => {
    if (!action.parents || !Array.isArray(action.parents)) return [];
    
    return action.parents.map(parent => {
      const parsedConditions = parseConditions(parent.conditions);
      const sourceHandle = getSourceHandleFromConditions(parsedConditions) 
      
      const id = `${parent.name}_${parent.instance_id} to ${action.name}_${action.instance_id}`;
      const source = `${parent.name}_${parent.instance_id}`;
      const target = `${action.name}_${action.instance_id}`;
      
      // If the source handle is undefined and the source is not the entry node, log warning
      if (sourceHandle === undefined && source !== 'entry-node') {
        console.log(`No source handle found for ${source} to ${action.name}_${action.instance_id}`);
        return null;
      }
      
      return {
        id: id,
        source: source,
        sourceHandle: sourceHandle,
        target: target,
        
        // Metadata for converting back to UMRF graph
        source_name: parent.name,
        source_id: parent.instance_id,
        target_name: action.name,
        target_id: action.instance_id,
      };
    }).filter(edge => edge !== null); // Filter out any null edges
  });
};

/**
 * Create edges for entry node
 * @param {Object} graphJson - The graph JSON
 * @returns {Array} - Array of edges from entry node
 */
export const createEntryEdges = (graphJson) => {
  if (!graphJson.graph_entry || !graphJson.graph_entry.actions) return [];
  
  return graphJson.graph_entry.actions.map(entry => ({
    id: `entry to ${entry.name}_${entry.instance_id}`,
    source: 'entry-node',
    target: `${entry.name}_${entry.instance_id}`,
    source_name: 'entry',
    source_id: null,
    target_name: entry.name,
    target_id: entry.instance_id,
  }));
};

/**
 * Create edges for exit node
 * @param {Object} graphJson - The graph JSON
 * @returns {Array} - Array of edges to exit node
 */
export const createExitEdges = (graphJson) => {
  if (!graphJson.graph_exit || !graphJson.graph_exit.actions) return [];
  
  return graphJson.graph_exit.actions.map(exit => ({
    id: `${exit.name}_${exit.instance_id} to exit`,
    source: `${exit.name}_${exit.instance_id}`,
    target: 'exit-node',
    source_name: exit.name,
    source_id: exit.instance_id,
    target_name: 'exit',
    target_id: null,
  }));
};

/**
 * Create all edges from graph JSON
 * @param {Object} graphJson - The graph JSON
 * @returns {Array} - Array of all edges
 */
export const createEdgesFromGraph = (graphJson) => {
  const actionEdges = createActionEdges(graphJson);
  const entryEdges = createEntryEdges(graphJson);
  const exitEdges = createExitEdges(graphJson);
  
  return [...actionEdges, ...entryEdges, ...exitEdges];
};

/**
 * Extract metadata from the original graph for parent-child relationships
 * @param {Object} activeGraph - The active graph
 * @returns {Object} - Original metadata map
 */
export const extractOriginalMetadata = (activeGraph) => {
  const metadata = {
    parents: {},
    children: {}
  };
  
  if (!activeGraph || !activeGraph.actions) return metadata;
  
  activeGraph.actions.forEach(action => {
    // Store parent metadata
    if (action.parents) {
      action.parents.forEach(parent => {
        const key = `${parent.name}_${parent.instance_id}_to_${action.name}_${action.instance_id}`;
        metadata.parents[key] = { ...parent };
      });
    }
    
    // Store children metadata
    if (action.children) {
      action.children.forEach(child => {
        const key = `${action.name}_${action.instance_id}_to_${child.name}_${child.instance_id}`;
        metadata.children[key] = { ...child };
      });
    }
  });
  
  return metadata;
};

/**
 * Update entry node connections in the graph
 * @param {Object} activeGraphUpdated - The updated graph
 * @param {Object} flow - The ReactFlow object
 * @param {Object} entryNode - The entry node
 */
export const updateEntryConnections = (activeGraphUpdated, flow, entryNode) => {
  if (!entryNode) return;
  
  if (Array.isArray(activeGraphUpdated.graph_entry)) {
    // If graph_entry is an array, add entries directly
    flow.edges.forEach(edge => {
      if (edge.source === 'entry-node') {
        const targetParts = edge.target.split('_');
        if (targetParts.length === 2) {
          activeGraphUpdated.graph_entry.push({
            name: targetParts[0],
            instance_id: parseInt(targetParts[1])
          });
        }
      }
    });
  } else {
    // If graph_entry is an object, update its properties
    activeGraphUpdated.graph_entry.gui_attributes = {
      position: entryNode.position
    };
    
    flow.edges.forEach(edge => {
      if (edge.source === 'entry-node') {
        const targetParts = edge.target.split('_');
        if (targetParts.length === 2) {
          activeGraphUpdated.graph_entry.actions.push({
            name: targetParts[0],
            instance_id: parseInt(targetParts[1])
          });
        }
      }
    });
  }
};

/**
 * Update exit node connections in the graph
 * @param {Object} activeGraphUpdated - The updated graph
 * @param {Object} flow - The ReactFlow object
 * @param {Object} exitNode - The exit node
 */
export const updateExitConnections = (activeGraphUpdated, flow, exitNode) => {
  if (!exitNode) return;
  
  if (Array.isArray(activeGraphUpdated.graph_exit)) {
    // If graph_exit is an array, add entries directly
    flow.edges.forEach(edge => {
      if (edge.target === 'exit-node') {
        const sourceParts = edge.source.split('_');
        if (sourceParts.length === 2) {
          activeGraphUpdated.graph_exit.push({
            name: sourceParts[0],
            instance_id: parseInt(sourceParts[1])
          });
        }
      }
    });
  } else {
    // If graph_exit is an object, update its properties
    activeGraphUpdated.graph_exit.gui_attributes = {
      position: exitNode.position
    };
    
    flow.edges.forEach(edge => {
      if (edge.target === 'exit-node') {
        const sourceParts = edge.source.split('_');
        if (sourceParts.length === 2) {
          activeGraphUpdated.graph_exit.actions.push({
            name: sourceParts[0],
            instance_id: parseInt(sourceParts[1])
          });
        }
      }
    });
  }
};

/**
 * Process a regular node and update its relationships in the graph
 * @param {Object} node - The node to process
 * @param {Object} flow - The ReactFlow object
 * @param {Object} activeGraph - The active graph
 * @param {Object} originalMetadata - Original metadata map
 * @returns {Object} - Updated node
 */
export const processRegularNode = (node, flow, activeGraph, originalMetadata) => {
  // Skip entry/exit nodes
  if (node.type === 'entry' || node.type === 'exit') return null;
  
  // Find the original node to preserve any additional fields
  const originalNode = activeGraph.actions?.find(
    action => action.name === node.data.title && 
              action.instance_id.toString() === node.data.instance_id.toString()
  );
  
  // Create the node with all original fields if it exists
  let umrfNode = originalNode ? { ...originalNode } : {
    name: node.data.title,
    instance_id: node.data.instance_id,
    type: node.data.type,
    parents: [],
    children: [],
    input_parameters: node.data.input_parameters,
    output_parameters: node.data.output_parameters,
    actor: node.data.actor
  };
  
  // Always update position
  if (!umrfNode.gui_attributes) {
    umrfNode.gui_attributes = {};
  }
  umrfNode.gui_attributes.position = node.position;
  
  // Update state if it exists
  if (node.data.state) {
    umrfNode.state = node.data.state;
  }
  
  // Reset parents and children arrays as they will be rebuilt
  umrfNode.parents = [];
  umrfNode.children = [];
  
  // Find edges where the node is a source or target
  flow.edges.forEach(edge => {
    // Skip edges connected to entry/exit nodes
    if (edge.source === 'entry-node' || edge.target === 'exit-node') return;
    
    if (node.data.title === edge.source_name && node.data.instance_id === edge.source_id) {
      // If node is a source, add to children
      const childKey = `${edge.source_name}_${edge.source_id}_to_${edge.target_name}_${edge.target_id}`;
      const originalChild = originalMetadata.children[childKey];
      
      // Create child with original metadata if it exists
      const child = originalChild ? { ...originalChild } : {
        name: edge.target_name,
        instance_id: edge.target_id
      };
      
      umrfNode.children.push({
        name: child.name,
        instance_id: child.instance_id,
      });
    } else if (node.data.title === edge.target_name && node.data.instance_id === edge.target_id) {
      // If node is a target, add to parents
      const parentKey = `${edge.source_name}_${edge.source_id}_to_${edge.target_name}_${edge.target_id}`;
      const originalParent = originalMetadata.parents[parentKey];
      
      // Create parent with original metadata if it exists
      const parent = originalParent ? { ...originalParent } : {
        name: edge.source_name,
        instance_id: edge.source_id,
      };
      
      umrfNode.parents.push(parent);
    }
  });
  
  return umrfNode;
};

/**
 * Convert source handle to condition
 * @param {string} sourceHandle - The source handle
 * @returns {string|undefined} - Condition string
 */
export const sourceHandleToCondition = (sourceHandle) => {
  const SOURCE_HANDLE_TO_CONDITION = {
    'source-on-true': 'on_true',
    'source-on-false': 'on_false',
    'source-on-error': 'on_error',
    'source-on-stopped': 'on_stopped'
  };
  
  return SOURCE_HANDLE_TO_CONDITION[sourceHandle];
};

/**
 * Create conditions array from run condition
 * @param {string} runCondition - The run condition
 * @returns {Array} - Conditions array
 */
export const createConditionsFromRunCondition = (runCondition) => {
  return runCondition ? [`${runCondition} -> run`] : [];
};

/**
 * Update parent-child relationships when connecting nodes
 * @param {Object} activeGraph - The active graph
 * @param {Object} params - Connection parameters
 * @param {Object} sourceNode - Source node
 * @param {Object} targetNode - Target node
 * @returns {Object} - Updated graph
 */
export const updateNodeRelationships = (activeGraph, params, sourceNode, targetNode) => {
  // Handle entry node connections
  if (sourceNode.type === 'entry') {
    return produce(activeGraph, draft => {
      const targetParts = params.target.split('_');
      if (targetParts.length === 2) {
        // Ensure graph_entry structure exists
        if (!draft.graph_entry) {
          draft.graph_entry = { actions: [], gui_attributes: {} };
        }

        // Check if connection already exists
        const connectionExists = draft.graph_entry.actions.some(
          entry => entry.name === targetParts[0] && 
                  entry.instance_id.toString() === targetParts[1]
        );
        
        if (!connectionExists) {
          draft.graph_entry.actions.push({
            name: targetParts[0],
            instance_id: parseInt(targetParts[1])
          });
        }
      }
    });
  }
  // Handle regular node connections
  else {
    const runCondition = sourceHandleToCondition(params.sourceHandle);
    const conditions = createConditionsFromRunCondition(runCondition);
    
    return produce(activeGraph, draft => {
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
            instance_id: sourceAction.instance_id,
            conditions: conditions
          });
        }
      }
    });
  }
};

/**
 * Convert JSON graph to ReactFlow format
 * @param {Object} graphJson - The graph JSON
 * @returns {Object} - {nodes, edges} for ReactFlow
 */
export const jsonToFlow = (graphJson) => {
  if (!graphJson) {
    console.warn('jsonToFlow called with undefined or null graphJson');
    return { nodes: [], edges: [] };
  }
  
  const nodes = createNodesFromGraph(graphJson);
  const edges = createEdgesFromGraph(graphJson);
  
  return { nodes, edges, activeGraph: graphJson };
};

/**
 * Convert ReactFlow format back to JSON graph
 * @param {Object} activeGraph - The active graph
 * @param {Object} rfInstance - The ReactFlow instance
 * @returns {Object} - Updated graph JSON
 */
export const flowToJson = (activeGraph, rfInstance) => {
  if (!activeGraph || !rfInstance) {
    console.warn('flowToJson called with invalid parameters');
    return activeGraph;
  }
  
  console.log("flowToJson: ", activeGraph.graph_name);

  // Create a deep copy of the active graph to preserve all fields
  let activeGraphUpdated = JSON.parse(JSON.stringify(activeGraph));
  
  // Reset only the arrays that will be rebuilt
  activeGraphUpdated.actions = [];
  
  // Preserve the original graph_entry/graph_exit structure
  // If they were arrays in the original, keep them as arrays
  if (Array.isArray(activeGraph.graph_entry)) {
    activeGraphUpdated.graph_entry = [];
  } else {
    // Otherwise use the object structure
    activeGraphUpdated.graph_entry = {
      actions: [],
      gui_attributes: activeGraph.graph_entry?.gui_attributes || {}
    };
  }
  
  if (Array.isArray(activeGraph.graph_exit)) {
    activeGraphUpdated.graph_exit = [];
  } else {
    // Otherwise use the object structure
    activeGraphUpdated.graph_exit = {
      actions: [],
      gui_attributes: activeGraph.graph_exit?.gui_attributes || {}
    };
  }

  const flow = rfInstance.toObject();
  
  // Find entry and exit nodes
  const entryNode = flow.nodes.find(node => node.id === 'entry-node');
  const exitNode = flow.nodes.find(node => node.id === 'exit-node');
  
  // Extract original metadata
  const originalMetadata = extractOriginalMetadata(activeGraph);
  
  // Update entry and exit connections
  updateEntryConnections(activeGraphUpdated, flow, entryNode);
  updateExitConnections(activeGraphUpdated, flow, exitNode);
  
  // Process regular nodes
  flow.nodes.forEach(node => {
    const umrfNode = processRegularNode(node, flow, activeGraph, originalMetadata);
    if (umrfNode) {
      activeGraphUpdated.actions.push(umrfNode);
    }
  });
  
  return activeGraphUpdated;
}; 