import React, { useState } from "react";
import "./ChatInterfacePage.css";
import ChatPanel from "../../components/chat/ChatPanel.jsx";
import DisplayPanel from "../../components/display/DisplayPanel.jsx";
import PlannedActionPanel from "../../components/plannedActions/PlannedActionPanel.jsx";
import useWindowDimensions from "../../hooks/useWindowDimensions";

const ChatInterfacePage = () => {
  // ----------------- State and Dimensions -----------------
  // Retrieve window dimensions and aspect ratio
  const { aspectRatio, width } = useWindowDimensions();
  // State to toggle the visibility of the PlannedActionPanel in mobile view
  const [showPlannedActionPanel, setShowPlannedActionPanel] = useState(false);
  
  // ----------------- Layout Determination -----------------
  // Thresholds for determining layout mode
  const aspectRatioThreshold = 0.9; // Aspect ratio threshold for mobile layout
  const mobileWidthThreshold = 800; // Width threshold for mobile layout
  // Determine if the interface should render in mobile layout
  const isMobile = aspectRatio > aspectRatioThreshold || width < mobileWidthThreshold;

  // -------------------- Render ------------------------
  return isMobile ? (
    // Mobile Layout
    <div className="chat-interface-page mobile">
      {/* Toggle Button for Planned Action Panel */}
      <div className="button-container">
        <button
          className="toggle-planned-action-panel-button"
          onClick={() => setShowPlannedActionPanel(!showPlannedActionPanel)}
        >
          {showPlannedActionPanel ? "<<<" : ">>>"}
        </button>
      </div>
      {/* Render Planned Action Panel or Display & Chat Panels */}
      {showPlannedActionPanel ? (
        <div className="planned-action-panel-container">
          <PlannedActionPanel />
        </div>
      ) : (
        <>
          <div className="display-panel">
            <DisplayPanel />
          </div>
          <div className="chat-panel">
            <ChatPanel />
          </div>
        </>
      )}
    </div>
  ) : (
    // Desktop Layout
    <div className="chat-interface-page">
      <div className="planned-action-panel">
        <PlannedActionPanel />
      </div>
      <div className="display-panel">
        <DisplayPanel />
      </div>
      <div className="chat-panel">
        <ChatPanel />
      </div>
    </div>
  );
};

export default ChatInterfacePage;