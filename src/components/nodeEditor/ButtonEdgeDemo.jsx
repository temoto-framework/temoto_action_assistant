import { EdgeProps, getBezierPath } from "@xyflow/react";
import { memo } from "react";
import { MousePointerClick } from "lucide-react";
import "./SelectedEdge.css";

// Custom button component instead of shadcn/ui button
const CustomButton = ({ onClick, children, size, variant }) => {
  return (
    <button
      onClick={onClick}
      className={`custom-button ${variant === "secondary" ? "secondary" : "primary"} ${size === "icon" ? "icon-size" : ""}`}
      style={{
        padding: size === "icon" ? "4px" : "8px 16px",
        borderRadius: "4px",
        backgroundColor: variant === "secondary" ? "#f1f5f9" : "#0ea5e9",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {children}
    </button>
  );
};

// Custom edge component instead of imported ButtonEdge
const CustomButtonEdge = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  children
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  
  const midX = labelX;
  const midY = labelY;

  return (
    <>
      <path
        id={id}
        style={{ ...style, strokeWidth: 2, stroke: '#b1b1b7' }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {children && (
        <foreignObject
          width={40}
          height={40}
          x={midX - 20}
          y={midY - 20}
          className="edgebutton-foreignobject"
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
            {children}
          </div>
        </foreignObject>
      )}
    </>
  );
};

const ButtonEdgeDemo = memo(({ id, source, target, data, selected, handleClick, ...rest }) => {
  return (
    <CustomButtonEdge id={id} source={source} target={target} data={data} selected={selected} {...rest}>
      <CustomButton onClick={handleClick} size="icon" variant="secondary">
        <MousePointerClick size={16} />
      </CustomButton>
    </CustomButtonEdge>
  );
});

export default ButtonEdgeDemo;