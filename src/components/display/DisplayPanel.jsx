import React, { useState, useEffect, useRef } from "react";
import "./DisplayPanel.css";
import { io } from "socket.io-client";

const DisplayPanel = () => {
  const [socket, setSocket] = useState(null);
  const [targets, setTargets] = useState([]);
  const [availableFeeds, setAvailableFeeds] = useState({});
  const [selectedImages, setSelectedImages] = useState([]);
  const [activeTarget, setActiveTarget] = useState(null);
  const [connected, setConnected] = useState(false);
  const [imageRefreshTimestamps, setImageRefreshTimestamps] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  const [fullScreenImageIndex, setFullScreenImageIndex] = useState(null);
  const [isTargetContainerCollapsed, setIsTargetContainerCollapsed] = useState(true);
  
  // Reference for the display content div
  const displayContentRef = useRef(null);
  
  // Server configuration
  const SERVER_URL = 'http://localhost:4000';
  
  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SERVER_URL);
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });
    
    setSocket(newSocket);
    
    // Clean up socket connection on component unmount
    return () => newSocket.disconnect();
  }, []);
  
  // Setup event listeners when socket is connected
  useEffect(() => {
    if (!socket || !connected) return;
    
    console.log("Setting up socket event listeners");
    
    // Request the list of available targets and feeds
    socket.emit('display_get_feeds');
    console.log("Requested feeds");
    
    // Listen for available targets
    socket.on('display_available_targets', (data) => {
      console.log('Received targets:', data);
      setTargets(data);
    });
    
    // Listen for available feeds
    socket.on('display_available_feeds', (data) => {
      console.log('Received feeds:', data);
      setAvailableFeeds(data);
    });
    
    // Listen for image updates
    socket.on('image_updated', (data) => {
      console.log(`Image updated event received for: ${data.target}/${data.name}`);
      refreshImageSrc(data.target, data.name);
    });
    
    // Set up polling for available feeds
    const intervalId = setInterval(() => {
      socket.emit('display_get_feeds');
      console.log("Polling for feeds");
    }, 5000); // Poll every 5 seconds
    
    // Cleanup function
    return () => {
      socket.off('display_available_targets');
      socket.off('display_available_feeds');
      socket.off('image_updated');
      clearInterval(intervalId);
    };
  }, [socket, connected]);
  
  // Function to refresh an image's timestamp
  const refreshImageSrc = (targetId, imageName) => {
    console.log(`Refreshing image timestamp for ${targetId}/${imageName}`);
    setImageRefreshTimestamps(prev => ({
      ...prev,
      [`${targetId}-${imageName}`]: Date.now()
    }));
    
    // Reset any error state
    setImageErrors(prev => ({
      ...prev,
      [`${targetId}-${imageName}`]: false
    }));
  };
  
  // Handle image selection
  const handleImageSelect = (targetId, imageName) => {
    // Check if already selected
    const existingIndex = selectedImages.findIndex(img => 
      img.targetId === targetId && img.imageName === imageName
    );
    
    if (existingIndex !== -1) {
      // Remove from selection
      const updatedImages = [...selectedImages];
      updatedImages.splice(existingIndex, 1);
      setSelectedImages(updatedImages);
      
      // If the fullscreen image is being removed, reset fullscreen state
      if (fullScreenImageIndex === existingIndex) {
        setFullScreenImageIndex(null);
      } else if (fullScreenImageIndex !== null && fullScreenImageIndex > existingIndex) {
        // Adjust fullscreen index if an image before it was removed
        setFullScreenImageIndex(fullScreenImageIndex - 1);
      }
      
      // Unsubscribe from the feed
      if (socket && connected) {
        socket.emit('display_unsubscribe_from_image', { target: targetId, name: imageName });
        console.log(`Unsubscribed from ${targetId}/${imageName}`);
      }
    } else if (imageName) {
      // Add to selection immediately so the UI shows it
      console.log(`Adding ${targetId}/${imageName} to selected images`);
      
      // If this is the first image, make it fullscreen automatically
      const newImages = [...selectedImages, { targetId, imageName }];
      setSelectedImages(newImages);
      
      // If there was previously no image (this is the first one), set it to fullscreen
      if (selectedImages.length === 0) {
        setFullScreenImageIndex(0);
      }
      
      setActiveTarget(targetId);
      
      // Subscribe to the feed
      if (socket && connected) {
        console.log(`Subscribing to ${targetId}/${imageName}`);
        socket.emit('display_subscribe_to_image', { target: targetId, name: imageName });
        
        // Reset the refresh timestamp to trigger a new image load
        refreshImageSrc(targetId, imageName);
        
        // Set up multiple retries to handle subscription latency
        const retryIntervals = [500, 1000, 2000, 4000]; // ms
        retryIntervals.forEach(delay => {
          setTimeout(() => {
            console.log(`Retry loading image after ${delay}ms`);
            refreshImageSrc(targetId, imageName);
          }, delay);
        });
      }
    }
  };
  
  // Handle target selection
  const handleTargetClick = (targetId) => {
    setActiveTarget(targetId);
  };
  
  // Handle toggling fullscreen mode for an image
  const handleToggleFullscreen = (index, e) => {
    e.stopPropagation(); // Prevent bubbling to parent elements
    
    // If current image is already fullscreen, exit fullscreen
    if (fullScreenImageIndex === index) {
      setFullScreenImageIndex(null);
    } else {
      // Otherwise, make this image fullscreen
      setFullScreenImageIndex(index);
    }
  };
  
  // Handle image load error
  const handleImageError = (selection, cacheKey) => {
    console.error(`Failed to load image: ${selection.targetId}/${selection.imageName}`);
    console.error(`URL attempted: ${SERVER_URL}/api/images/${selection.targetId}/${selection.imageName}?t=${cacheKey}`);
    
    // Mark this image as having an error
    setImageErrors(prev => ({
      ...prev,
      [`${selection.targetId}-${selection.imageName}`]: true
    }));
    
    // Retry a few times over several seconds
    const retryDelays = [1000, 3000, 5000];
    let retryCount = 0;
    
    const retryImage = () => {
      if (retryCount < retryDelays.length) {
        setTimeout(() => {
          console.log(`Retry attempt ${retryCount + 1} for ${selection.targetId}/${selection.imageName}`);
          refreshImageSrc(selection.targetId, selection.imageName);
          retryCount++;
          retryImage();
        }, retryDelays[retryCount]);
      }
    };
    
    retryImage();
  };
  
  // Handle manual refresh attempt
  const handleManualRefresh = (selection) => {
    console.log(`Manual refresh for ${selection.targetId}/${selection.imageName}`);
    
    // Re-subscribe to the feed
    if (socket && connected) {
      socket.emit('display_subscribe_to_image', { target: selection.targetId, name: selection.imageName });
    }
    
    // Reset error state and refresh timestamp
    refreshImageSrc(selection.targetId, selection.imageName);
  };
  
  // Toggle target container collapse state
  const toggleTargetContainer = () => {
    setIsTargetContainerCollapsed(!isTargetContainerCollapsed);
  };
  
  return (
    <div className="display-sub-panel">
      <div 
        ref={displayContentRef}
        className={`display-content ${!isTargetContainerCollapsed ? 'mobile-targets-expanded' : ''}`}
      >
        {/* Image display container */}
        <div className="display-image-container">
          {isTargetContainerCollapsed && (
            <button 
              className="mobile-expand-btn"
              onClick={toggleTargetContainer}
              title="Show Targets"
            >
              ≡
            </button>
          )}
          
          {/* Error indicator alongside the expand button when collapsed */}
          {isTargetContainerCollapsed && Object.values(imageErrors).some(error => error) && (
            <div 
              className="error-indicator" 
              title="One or more images have errors"
              onClick={toggleTargetContainer}
            >
              !
            </div>
          )}
          
          {selectedImages.length > 0 ? (
            selectedImages.map((selection, index) => {
              // Generate a unique cache-busting key
              const cacheKey = imageRefreshTimestamps[`${selection.targetId}-${selection.imageName}`] || Date.now();
              const imageSrc = `${SERVER_URL}/api/images/${selection.targetId}/${selection.imageName}?t=${cacheKey}`;
              const hasError = imageErrors[`${selection.targetId}-${selection.imageName}`];
              const isFullscreen = fullScreenImageIndex === index;
              
              console.log(`Rendering image from: ${imageSrc}, hasError: ${hasError}, isFullscreen: ${isFullscreen}`);
              
              // Only render the image if it's fullscreen or no image is in fullscreen mode
              if (fullScreenImageIndex === null || isFullscreen) {
                return (
                  <div key={`${selection.targetId}-${selection.imageName}-${index}`} 
                       className={`display-image ${hasError ? 'image-error' : ''} ${isFullscreen ? 'fullscreen' : ''}`}>
                    
                    <img 
                      src={imageSrc}
                      alt={`${selection.targetId} - ${selection.imageName}`}
                      onLoad={() => {
                        console.log(`Successfully loaded image: ${selection.targetId}/${selection.imageName}`);
                        // Reset error state if it was previously in error
                        if (hasError) {
                          setImageErrors(prev => ({
                            ...prev,
                            [`${selection.targetId}-${selection.imageName}`]: false
                          }));
                        }
                      }}
                      onError={() => handleImageError(selection, cacheKey)}
                    />
                    
                    {hasError && (
                      <div className="image-error-overlay">
                        <p>Failed to load image</p>
                        <button onClick={() => handleManualRefresh(selection)}>
                          Retry
                        </button>
                      </div>
                    )}
                    
                    <div className="image-overlay">
                      <span>{selection.targetId}: {selection.imageName}</span>
                      <div className="image-controls">
                        <button 
                          onClick={(e) => handleToggleFullscreen(index, e)}
                          className="toggle-size-btn"
                          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                        >
                          {isFullscreen ? "⊖" : "⊕"}
                        </button>
                        <button 
                          onClick={() => handleImageSelect(selection.targetId, selection.imageName)}
                          className="remove-btn"
                          title="Remove"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  </div>
                );
              } else {
                // Return null for images that should be hidden when in fullscreen mode
                return null;
              }
            })
          ) : (
            <div className="no-images-placeholder">
              Select images from the target panels
            </div>
          )}
        </div>
        
        {/* Target container - always rendered with mobile style */}
        {!isTargetContainerCollapsed && (
          <div className="display-target-container">
            <button 
              className="mobile-collapse-btn"
              onClick={toggleTargetContainer}
              title="Show Images"
            >
              ×
            </button>
            
            {/* Error indicator in expanded mode */}
            {!isTargetContainerCollapsed && Object.values(imageErrors).some(error => error) && (
              <div 
                className="error-indicator" 
                title="One or more images have errors"
              >
                !
              </div>
            )}
            
            {targets.length > 0 ? (
              targets.map(target => (
                <div 
                  key={target.id} 
                  className={`display-panel-target ${activeTarget === target.id ? 'active-target' : ''}`}
                  onClick={() => handleTargetClick(target.id)}
                >
                  <h3>{target.name || target.id}</h3>
                  <select 
                    className="display-image-name"
                    onChange={(e) => handleImageSelect(target.id, e.target.value)}
                    value=""
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">Select an image</option>
                    {availableFeeds[target.id]?.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <div className="selected-target-images">
                    {selectedImages
                      .filter(img => img.targetId === target.id)
                      .map((img, idx) => {
                        const hasError = imageErrors[`${img.targetId}-${img.imageName}`];
                        return (
                          <div key={idx} className={`selected-image-badge ${hasError ? 'image-error-badge' : ''}`}>
                            {img.imageName}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleImageSelect(target.id, img.imageName);
                              }}
                              className="remove-badge"
                            >
                              &times;
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-targets-placeholder">
                No targets available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DisplayPanel;