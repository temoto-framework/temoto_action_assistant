import React from "react";
import "./MenuPanel.css";
import temoto_logo from "../../public/temoto_logo_icon.png";
import temoto_name from "../../public/temoto_logo_name.png";

const MenuPanel = ({ setPage, currentPage, isMobile }) => {
  const buttons = [
    { id: 1, text: "Chat HRI", page: "ChatInterfacePage" },
    { id: 2, text: "Action", page: "ActionInterfacePage" },
  ];
  
  // Add Planned Actions to mobile menu options
  const mobileButtons = [
    ...buttons,
    { id: 3, text: "Planned Actions", page: "PlannedActionsPage" }
  ];
  
  const info = { text: "Info", page: "InfoInterfacePage" };
  
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
      
      {/* Only show info button if not in mobile mode, otherwise add it as a regular menu item */}
      {isMobile ? (
        <button
          className={`menu-button ${currentPage === info.page ? 'active' : ''}`}
          onClick={() => setPage(info.page)}
        >
          {info.text}
        </button>
      ) : (
        <div className="menu-panel-bottom">
          <button
            className={`info-button ${currentPage === info.page ? 'active' : ''}`}
            onClick={() => setPage(info.page)}
          >
            {<img src={temoto_logo} alt="Temoto Logo" className="temoto-logo" />}
          </button>
        </div>
      )}
    </div>
  );
};

export default MenuPanel;