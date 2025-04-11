import React, { useState } from "react";
import "./HomePage.css";
import temoto_banner from "../../public/temoto_logo_name.png";
import tutorials from "./data/tutorials";
import references from "./data/references";
import authors from "./data/authors";
import useWindowDimensions from "../../hooks/useWindowDimensions";

const HomePage = () => {
  const [activeSection, setActiveSection] = useState("about");
  const { aspectRatio, height } = useWindowDimensions();
  
  /* Thresholds to determine mobile mode */
  const aspectRatioThreshold = 0.6; // 0-1
  const heightThreshold = 500; // in px
  
  /* Determine if in mobile mode */
  const isMobile = aspectRatio > aspectRatioThreshold || height < heightThreshold;

  // Function to render the appropriate section based on activeSection state
  const renderSection = () => {
    switch (activeSection) {
      case "about":
        return (
          <div className="section-content">
            <h2>About TEMOTO</h2>
            <p>
              TEMOTO (Task Execution and MOnitoring TOolkit) is an advanced 
              robotics framework designed to simplify human-robot interaction 
              and task automation. It provides a set of tools for developing 
              reliable and adaptable robotic systems capable of executing 
              complex tasks in dynamic environments.
            </p>
            <p>
              The framework excels at providing intuitive interfaces for 
              controlling robots while abstracting away technical complexities,
              making robotics more accessible to non-experts. TEMOTO leverages 
              modern approaches to robot programming, task planning, and execution 
              monitoring to create robust robotic solutions.
            </p>
            <div className="feature-grid">
              <div className="feature-card">
                <h3>Intuitive Interaction</h3>
                <p>Natural interfaces for communicating with robots through 
                chat, gestures, and voice commands.</p>
              </div>
              <div className="feature-card">
                <h3>Task Automation</h3>
                <p>Powerful task execution engine capable of handling complex 
                multi-step operations with error recovery.</p>
              </div>
              <div className="feature-card">
                <h3>Adaptive Planning</h3>
                <p>Smart planning algorithms that adjust to changing environments 
                and unexpected obstacles.</p>
              </div>
              <div className="feature-card">
                <h3>Modular Architecture</h3>
                <p>Extensible design allowing easy integration with existing 
                robotic systems and components.</p>
              </div>
            </div>
          </div>
        );
      case "tutorials":
        return (
          <div className="section-content">
            <h2>Tutorials</h2>
            <p className="section-description">
              Get started with TEMOTO through our comprehensive tutorials.
              From basic setup to advanced implementations, we've got you covered.
            </p>
            <div className="tutorials-list">
              {tutorials.map((tutorial, index) => (
                <div key={index} className="tutorial-card">
                  <h3>{tutorial.title}</h3>
                  <p>{tutorial.description}</p>
                  <div className="tutorial-footer">
                    <span className="difficulty-level">{tutorial.level}</span>
                    <a href={tutorial.link} target="_blank" rel="noopener noreferrer" className="tutorial-link">
                      View Tutorial
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "papers":
        return (
          <div className="section-content">
            <h2>Research Papers</h2>
            <p className="section-description">
              Explore academic papers and publications related to TEMOTO's development,
              applications, and underlying technologies.
            </p>
            <div className="papers-list">
              {references.map((paper, index) => (
                <div key={index} className="paper-card">
                  <h3>{paper.title}</h3>
                  <p className="paper-authors">{paper.authors}</p>
                  <p className="paper-venue">{paper.venue} ({paper.year})</p>
                  <div className="paper-links">
                    {paper.doi && (
                      <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer">
                        DOI
                      </a>
                    )}
                    {paper.link && (
                      <a href={paper.link} target="_blank" rel="noopener noreferrer">
                        PDF
                      </a>
                    )}
                    {paper.code && (
                      <a href={paper.code} target="_blank" rel="noopener noreferrer">
                        Code
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "team":
        return (
          <div className="section-content">
            <h2>Our Team</h2>
            <p className="section-description">
              Meet the researchers, engineers, and contributors who have helped
              make TEMOTO a reality.
            </p>
            <div className="team-grid">
              {authors.map((author, index) => (
                <div key={index} className="team-card">
                  <div className="team-card-header">
                    <h3>{author.name}</h3>
                    <p className="affiliation">{author.affiliation}</p>
                  </div>
                  <p className="contribution">{author.contribution}</p>
                  {author.links && (
                    <div className="author-links">
                      {author.links.github && (
                        <a href={author.links.github} target="_blank" rel="noopener noreferrer" title="GitHub">
                          GitHub
                        </a>
                      )}
                      {author.links.website && (
                        <a href={author.links.website} target="_blank" rel="noopener noreferrer" title="Website">
                          Website
                        </a>
                      )}
                      {author.links.linkedin && (
                        <a href={author.links.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn">
                          LinkedIn
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return <div className="section-content">Select a section</div>;
    }
  };

  return (
    <div className={`home-page ${isMobile ? "mobile" : ""}`}>
      <div className={`home-banner ${isMobile ? "mobile" : ""}`}>
        <img src={temoto_banner} alt="TEMOTO Logo" className="banner-logo" />
        <h1>Task Execution and MOnitoring TOolkit</h1>
        <div className="banner-actions">
          <a href="https://github.com/temoto-framework" target="_blank" rel="noopener noreferrer" className="banner-button">
            <span className="github-icon">&#128187;</span> GitHub
          </a>
          <a href="#tutorials" className="banner-button" onClick={(e) => {e.preventDefault(); setActiveSection("tutorials")}}>
            Get Started
          </a>
        </div>
      </div>

      <div className="home-navigation">
        <button 
          className={`nav-button ${activeSection === "about" ? "active" : ""}`} 
          onClick={() => setActiveSection("about")}
        >
          About
        </button>
        <button 
          className={`nav-button ${activeSection === "tutorials" ? "active" : ""}`} 
          onClick={() => setActiveSection("tutorials")}
        >
          Tutorials
        </button>
        <button 
          className={`nav-button ${activeSection === "papers" ? "active" : ""}`} 
          onClick={() => setActiveSection("papers")}
        >
          Papers
        </button>
        <button 
          className={`nav-button ${activeSection === "team" ? "active" : ""}`} 
          onClick={() => setActiveSection("team")}
        >
          Team
        </button>
      </div>

      <div className="home-content">
        {renderSection()}
      </div>

      <div className="home-footer">
        <p>© {new Date().getFullYear()} TEMOTO Framework. All rights reserved.</p>
        <div className="footer-links">
          <a href="https://github.com/temoto-framework" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <span className="separator">|</span>
          <a href="mailto:contact@temoto-framework.org">
            Contact
          </a>
        </div>
      </div>
    </div>
  );
};

export default HomePage;