import React, { useState, useEffect } from "react";
import "./PlannedActionsPage.css";
import PlannedActionPanel from "../../components/plannedActions/PlannedActionPanel";
import useWindowDimensions from "../../hooks/useWindowDimensions";
import io from "socket.io-client";

// Get the server address dynamically instead of hardcoding localhost
const getServerUrl = () => {
  // Use the current hostname (works when connecting via IP address)
  return `http://${window.location.hostname}:4000`;
};

// Establish connection to the backend server using dynamic URL
const socket = io(getServerUrl());

const PlannedActionsPage = () => {
  // State for debug messages
  const [showDebugMessages, setShowDebugMessages] = useState(false);
  
  // Retrieve window dimensions
  const { aspectRatio, width } = useWindowDimensions();
  
  // Thresholds for determining layout mode
  const aspectRatioThreshold = 0.9;
  const mobileWidthThreshold = 800;
  
  // Determine if the interface should render in mobile layout
  const isMobile = aspectRatio > aspectRatioThreshold || width < mobileWidthThreshold;
  
  // Function to refresh the page
  const refreshChatInterface = async () => {
    try {
      await fetch(`${getServerUrl()}/chat_interface_page_refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      console.log("Chat interface refreshed");
    } catch (error) {
      console.error("Error refreshing chat interface:", error);
    }
  };
  
  // Handle page refresh events
  useEffect(() => {
    // Call refresh on mount
    refreshChatInterface();
    
    // Define a handler that calls refreshChatInterface
    const onPageShow = () => refreshChatInterface();
    
    // Listen for the 'pageshow' event (fires on load/reload)
    window.addEventListener("pageshow", onPageShow);
    
    // Listen for 'popstate' to capture back/forward navigation
    window.addEventListener("popstate", onPageShow);
    
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPageShow);
    };
  }, []);
  
  // Socket connection handling
  useEffect(() => {
    socket.on("connect", () => {
      refreshChatInterface();
    });
    
    // Listen for debug mode status from server
    socket.on("debug_mode", (isDebugEnabled) => {
      console.log("Debug mode status from server:", isDebugEnabled);
      setShowDebugMessages(isDebugEnabled);
    });
    
    // Cleanup: remove the listeners when the component unmounts
    return () => {
      socket.off("connect");
      socket.off("debug_mode");
    };
  }, []);
  
  return (
    <div className={`planned-actions-page ${isMobile ? "mobile" : ""}`}>
      <div className="planned-actions-container">
        <h2 className="page-title">Planned Actions</h2>
        <div className="planned-action-panel-container">
          <PlannedActionPanel showDebugMessages={showDebugMessages} />
        </div>
      </div>
    </div>
  );
};

export default PlannedActionsPage;