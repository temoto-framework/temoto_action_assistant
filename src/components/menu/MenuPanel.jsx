import React from "react";
import "./MenuPanel.css";
import temoto_logo from "../../public/temoto_logo_icon.png";

const MenuPanel = ({ setPage, currentPage, isMobile }) => {
  const buttons = [
    { id: 1, text: "Home", page: "HomePage" },
    { id: 2, text: "Chat HRI", page: "ChatInterfacePage" },
    { id: 3, text: "Action", page: "ActionInterfacePage" },
  ];
  
  // Add Planned Actions to mobile menu options
  const mobileButtons = [
    ...buttons,
    { id: 4, text: "Planned Actions", page: "PlannedActionsPage" }
  ];
  
  return (
    <div className={`menu-panel ${isMobile ? 'mobile' : ''}`}>
      {/* Show different set of buttons depending on mobile mode */}
      {(isMobile ? mobileButtons : buttons).map((button) => (
        <button
          key={button.id}
          className={`menu-button ${currentPage === button.page ? 'active' : ''}`}
          onClick={() => setPage(button.page)}
        >
          {button.text}
        </button>
      ))}
      
      {/* Only show logo if not in mobile mode */}
      {!isMobile && (
        <div className="menu-panel-bottom">
          <img src={temoto_logo} alt="Temoto Logo" className="temoto-logo" />
        </div>
      )}
    </div>
  );
};

export default MenuPanel;