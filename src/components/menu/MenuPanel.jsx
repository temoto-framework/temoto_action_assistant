import React from "react";
import "./MenuPanel.css";
import temoto_logo from "../../public/temoto_logo_icon.png";

const MenuPanel = ({ setPage, currentPage }) => {
  const buttons = [
    { id: 1, text: "Chat", page: "ChatInterfacePage" },
    { id: 2, text: "Action", page: "ActionInterfacePage" },
  ];
  const info = { text: "Info", page: "InfoInterfacePage" };

  return (
    <div className="menu-panel">
      {buttons.map((button) => (
        <button
          key={button.id}
          className={`menu-button ${currentPage === button.page ? 'active' : ''}`}
          onClick={() => setPage(button.page)}
        >
          {button.text}
        </button>
      ))}
      {/* New bottom container */}
      <div className="menu-panel-bottom">
        <button
          className={`info-button ${currentPage === info.page ? 'active' : ''}`}
          onClick={() => setPage(info.page)}
        >
          {<img src={temoto_logo} alt="Temoto Logo" className="temoto-logo" />}
        </button>
      </div>
    </div>
  );
};

export default MenuPanel;