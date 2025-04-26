import React, { memo, type ReactNode } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type SpinNodeData = {
  title: string;
  icon?: ReactNode;
  subline?: string;
  actor?: string; // Add actor to the type definition
};

export default memo(({ data }: NodeProps<Node<SpinNodeData>>) => {
  return (
    <>
      {data.actor && <div className="actor-label">{data.actor}</div>}

      <div className={`wrapper ${data.state ? data.state : ""}`}>
        <Handle 
          type="target" 
          position={Position.Top} 
          className="react-flow__handle target" 
        />
        <div className="inner">
          <div className="body">
            {data.icon && <div className="icon">{data.icon}</div>}
            <div>
              <div className="title">{data.title}</div>
              {data.subline && <div className="subline">{data.subline}</div>}
              <div className="source-handle-labels">
                <div className="source-handle-label left">true</div>
                <div className="source-handle-label center">false</div>
                <div className="source-handle-label right">error</div>
                <div className="source-handle-label right">stopped</div>
              </div>
            </div>
          </div>
        </div>
        <Handle 
          type="source" 
          position={Position.Bottom} 
          className="react-flow__handle source source-on-true" 
          id="source-on-true"
          style={{ left: '5%' }}
        />
        <Handle 
          type="source" 
          position={Position.Bottom} 
          className="react-flow__handle source source-on-false" 
          id="source-on-false"
          style={{ left: '20%' }}
        />
        <Handle 
          type="source" 
          position={Position.Bottom} 
          className="react-flow__handle source source-on-error" 
          id="source-on-error"
          style={{ left: '35%' }}
        />
        <Handle 
          type="source" 
          position={Position.Bottom} 
          className="react-flow__handle source source-on-stopped" 
          id="source-on-stopped"
          style={{ left: '50%' }}
        />
      </div>
    </>
  );
});