import React from 'react';
import { Handle } from '@xyflow/react';

const EntryExitNode = ({ data, isConnectable }) => {
  const { type, connections } = data;
  const isEntry = type === 'entry';
  
  return (
    <div 
      className={`entry-exit-node ${isEntry ? 'entry-node' : 'exit-node'}`}
    >
      <div className="entry-exit-inner">
        {isEntry ? 'E' : 'X'}
      </div>
      
      {isEntry ? (
        <Handle
          type="source"
          position="bottom"
          id="out"
          isConnectable={isConnectable}
        />
      ) : (
        <Handle
          type="target"
          position="top"
          id="in"
          isConnectable={isConnectable}
        />
      )}
    </div>
  );
};

export default EntryExitNode; 