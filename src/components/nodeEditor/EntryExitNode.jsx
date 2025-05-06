import React from 'react';
import { Handle } from '@xyflow/react';

const EntryNode = ({ data, isConnectable }) => {
  return (
    <div className="entry-node">
      <div className="entry-inner">E</div>
      <Handle
        type="source"
        position="bottom"
        id="out"
        isConnectable={isConnectable}
      />
    </div>
  );
};

const ExitNode = ({ data, isConnectable }) => {
  return (
    <div className="exit-node">
      <div className="exit-inner">X</div>
      <Handle
        type="target"
        position="top"
        id="in"
        isConnectable={isConnectable}
      />
    </div>
  );
};

export { EntryNode, ExitNode };