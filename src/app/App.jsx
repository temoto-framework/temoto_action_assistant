import React, { useState, useEffect } from "react";
import "./App.css";
import MenuPanel from "../components/menu/MenuPanel";
import ChatInterfacePage from "../pages/chatInterface/ChatInterfacePage";
import ActionInterfacePage from "../pages/actionInterface/ActionInterfacePage";
import PlannedActionsPage from "../pages/plannedActionsInterface/PlannedActionsPage";
import useWindowDimensions from "../hooks/useWindowDimensions";
import temoto_banner from "../public/temoto_logo_name.png";

const App = () => {
  const [currentPage, setCurrentPage] = useState("ChatInterfacePage");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { aspectRatio, height } = useWindowDimensions();

  /* Thresholds to hide navigation bar and switch to chat interface */
  const aspectRatioThreshold = 0.6; // 0-1
  const heightThreshold = 500; // in px

  /* Determine if in mobile mode */
  const isMobile = aspectRatio > aspectRatioThreshold || height < heightThreshold;

  useEffect(() => {
    // Close mobile menu when changing pages
    setMobileMenuOpen(false);
  }, [currentPage]);

  /* Setup page rendered */
  const renderPage = () => {
    switch (currentPage) {
      case "ChatInterfacePage":
        return <ChatInterfacePage />;
      case "ActionInterfacePage":
        return <ActionInterfacePage />;
      case "PlannedActionsPage":
        return <PlannedActionsPage />;
      case "InfoInterfacePage":
        // Assuming you'll implement this later
        return <div>Info Page</div>;
      default:
        return <ChatInterfacePage />;
    }
  };

  /* Toggle mobile menu */
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  
  /* Close mobile menu when clicking outside */
  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  /* Render toolbar + page */
  return (
    <div className={`webapp ${isMobile ? "mobile" : ""}`}>
      {isMobile ? (
        <>
          <div className="nav mobile">
            <div className="mobile-banner-container">
              <img src={temoto_banner} alt="Temoto Logo" className="mobile-banner" />
            </div>
            <button className="mobile-menu-toggle" onClick={toggleMobileMenu}>
              Menu
            </button>
            {mobileMenuOpen && (
              <>
                <div className="mobile-menu-backdrop" onClick={closeMobileMenu}></div>
                <div className="mobile-menu-dropdown">
                  <MenuPanel 
                    setPage={setCurrentPage} 
                    currentPage={currentPage} 
                    isMobile={true} 
                  />
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="nav">
          <MenuPanel 
            setPage={setCurrentPage} 
            currentPage={currentPage}
            isMobile={false}
          />
        </div>
      )}
      <div className="app">{renderPage()}</div>
    </div>
  );
};

export default App;