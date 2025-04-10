import React, { useState, useEffect, useRef } from "react";
import "./ChatPanel.css";
import io from "socket.io-client";

// Get the server address dynamically instead of hardcoding localhost
const getServerUrl = () => {
  // Use the current hostname (works when connecting via IP address)
  return `http://${window.location.hostname}:4000`;
};

// Establish connection to the backend server using dynamic URL
const socket = io(getServerUrl());

const ChatPanel = () => {
  const [messages, setMessages] = useState({});
  const [activeTabs, setActiveTabs] = useState([]);
  const [input, setInput] = useState("");
  const [actorsAwaitingResponse, setActorsAwaitingResponse] = useState([]);
  const [showDebugMessages, setShowDebugMessages] = useState(false);

  // Ref for auto-scrolling the chat log.
  const chatLogRef = useRef(null);

  // on page refresh
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

  useEffect(() => {
    // Call refresh on mount.
    refreshChatInterface();
  
    // Define a handler that calls refreshChatInterface.
    const onPageShow = () => refreshChatInterface();
  
    // Listen for the 'pageshow' event (fires on load/reload)
    window.addEventListener("pageshow", onPageShow);
    // Listen for 'popstate' to capture back/forward navigation.
    window.addEventListener("popstate", onPageShow);
  
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPageShow);
    };
  }, []);

  useEffect(() => {
    socket.on("connect", () => {
      refreshChatInterface();
    });
    
    // Listen for debug mode status from server
    socket.on("debug_mode", (isDebugEnabled) => {
      console.log("Debug mode status from server:", isDebugEnabled);
      setShowDebugMessages(isDebugEnabled);
    });
    
    // Cleanup: remove the listeners when the component unmounts.
    return () => {
      socket.off("connect");
      socket.off("debug_mode");
    };
  }, []);
  
  /**
   * Scrolls the chat log to the bottom.
   */
  const autoScrollToBottom = () => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  };

  /**
   * Listen for the "chat_log" event from the backend.
   * When received, update the local messages state.
   */
  useEffect(() => {
    socket.on("chat_log", (chatLog) => {
      setMessages(chatLog);
      
      // Check for any "request" type messages and update UI
      const updatedAwaitingActors = [];
      Object.entries(chatLog).forEach(([actor, messages]) => {
        // Look through recent messages for request types
        const recentMessages = messages.slice(-5);
        for (const message of recentMessages) {
          if (message.length > 3 && message[3] === "request") {
            updatedAwaitingActors.push(actor);
            break;
          }
        }
      });
      
      setActorsAwaitingResponse(updatedAwaitingActors);
    });
    
    return () => {
      socket.off("chat_log");
    };
  }, []);

  /**
   * Auto-scroll when messages or active tabs change.
   */
  useEffect(() => {
    autoScrollToBottom();
  }, [messages, activeTabs]);

  /**
   * Sends a message to the backend.
   * The message will be sent to all selected actors.
   */
  const handleSend = async () => {
    if (!input.trim()) return;
    if (activeTabs.length === 0) {
      alert("Please select at least one actor to send the message.");
      return;
    }
    
    const request = {
      actor: activeTabs, // Send to all selected actors
      message: input.trim(),
    };

    setInput("");

    try {
      const response = await fetch(`${getServerUrl()}/send_message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        console.error("Failed to send message");
      }
      // The backend will update and emit the updated chat_log.
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  /**
   * Handles adding a new actor (tab).
   * This sends a POST request to the backend's /add_new_actor endpoint.
   */
  const handleAddTab = async () => {
    const actor = prompt("Enter the actor's name:");
    if (!actor) return;
    try {
      const response = await fetch(`${getServerUrl()}/add_new_actor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor_name: actor }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Error adding actor");
        return;
      }
      // Optionally auto-select the new actor.
      if (!activeTabs.includes(actor)) {
        setActiveTabs([...activeTabs, actor]);
      }
    } catch (error) {
      console.error("Error adding new actor:", error);
    }
  };

  /**
   * Toggles the selection of a tab (actor).
   * With Shift key: toggles the actor to add/remove from selection
   * Without Shift key: selects only this actor
   */
  const handleToggleTab = (actor, event) => {
    // If shift key is pressed, toggle the selection
    if (event.shiftKey) {
      if (activeTabs.includes(actor)) {
        setActiveTabs(activeTabs.filter((a) => a !== actor));
      } else {
        setActiveTabs([...activeTabs, actor]);
      }
    } else {
      // If shift is not pressed, select only this actor
      setActiveTabs([actor]);
    }
  };

  /**
   * Handles the Enter key press to send messages.
   */
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * Simulates a voice prompt action (placeholder).
   */
  const handleVoicePrompt = () => alert("Voice Prompt Activated! (🎙️)");

  /**
   * Toggles debug message visibility
   */
  const toggleDebugMessages = () => {
    setShowDebugMessages(!showDebugMessages);
  };

  // Combine messages from all selected actors, remove duplicates, and sort them chronologically.
  let combinedMessages = [];
  if (activeTabs.length > 0) {
    activeTabs.forEach((actor) => {
      const actorMessages = messages[actor] || [];
      combinedMessages = combinedMessages.concat(actorMessages);
    });
    // Remove duplicates by creating a unique key for each message.
    const seen = new Set();
    combinedMessages = combinedMessages.filter((msg) => {
      const key = msg.join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // Filter out debug messages if showDebugMessages is false
    if (!showDebugMessages) {
      combinedMessages = combinedMessages.filter((msg) => {
        // Don't show messages from user "debug"
        return msg[1] !== "debug";
      });
    }
    
    // Sort by timestamp (assuming the first element is a valid timestamp).
    combinedMessages.sort((a, b) => new Date(a[0]) - new Date(b[0]));
  }

  // Helper function to get tab class including response-waiting state 
  const getTabClass = (actor) => {
    let className = "tab-button";
    
    // First check if it's active
    if (activeTabs.includes(actor)) {
      className += " active-tab";
    }
    
    // Then check if it's awaiting response (this should come second so it can override active if needed)
    if (actorsAwaitingResponse.includes(actor)) {
      className += " awaiting-response-tab";
    }
    
    return className;
  };

  // Helper to determine message type class
  const getMessageTypeClass = (message) => {
    if (message.length <= 3) return "";
    
    const type = message[3];
    switch(type) {
      case "request": return "request-type";
      case "response": return "response-type";
      case "info": return "info-type";
      case "error": return "error-type";
      default: return "";
    }
  };

  return (
    <div className="chat-sub-panel">
      <div className="chat-container">
        {/* Tab Section */}
        <div className="tab-container">
          <div className="actor-selector">
            <button className="add-tab-button" onClick={handleAddTab}>
              +
            </button>
            
            <div className="tabs-scrollable">
              {Object.keys(messages).map((actor) => (
                <button
                  key={actor}
                  className={getTabClass(actor)}
                  onClick={(e) => handleToggleTab(actor, e)}
                >
                  {actor}
                  {actorsAwaitingResponse.includes(actor) && (
                    <span className="awaiting-response-indicator">⏳</span>
                  )}
                </button>
              ))}
            </div>
            
            <button 
              className={`debug-toggle-button ${showDebugMessages ? 'debug-active' : ''}`} 
              onClick={toggleDebugMessages}
              title="Toggle Debug Messages"
            >
              {showDebugMessages ? "🐞" : "🐞"}
            </button>
          </div>
        </div>

        {/* Chat Log */}
        <div className="chat-log" ref={chatLogRef}>
          {activeTabs.length > 0 ? (
            combinedMessages.length > 0 ? (
              combinedMessages.map((chat, idx) => {
                // Each chat entry is in the form [timestamp, user, message, type].
                const [timestamp, user, message, type] = chat;
                const messageClass = `chat-message ${user === "debug" ? "debug-type" : getMessageTypeClass(chat)}`;
                
                return (
                  <div key={idx} className={messageClass}>
                    {showDebugMessages && <span className="chat-timestamp">{timestamp}</span>}
                    <strong>{user}:</strong> {message}
                  </div>
                );
              })
            ) : (
              <p>No messages yet. Start a conversation.</p>
            )
          ) : (
            <p>No actor selected. Please select at least one actor.</p>
          )}
        </div>

        {/* Input Section */}
        <div className="chat-input-container">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here..."
          />
          <button onClick={handleSend}>Send</button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;