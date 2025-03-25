import React, { useState, useEffect, useRef } from 'react';
import './NetworkStatus.css'; // We'll create this file next
import { isFirestoreInitialized } from '../firebase';
import { checkCollectionPaths } from '../firestore';

interface NetworkStatusProps {
  onStatusChange: (online: boolean) => void;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ onStatusChange }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(true);
  const [showMessage, setShowMessage] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Firestore connection check
  const checkFirestoreConnection = async () => {
    // Check if Firestore is initialized
    const isInitialized = isFirestoreInitialized();
    if (!isInitialized) {
      setIsFirestoreConnected(false);
      setErrorDetails("Firestore initialization failed");
      return false;
    }
    
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      try {
        const userId = JSON.parse(currentUser).uid;
        // Try to check collection paths to see if we can access data
        const success = await checkCollectionPaths(userId);
        setIsFirestoreConnected(success);
        if (success) {
          setErrorDetails(null);
        } else {
          setErrorDetails("Cannot access Firestore collections");
        }
        return success;
      } catch (error) {
        console.error("Error checking Firestore connection:", error);
        setIsFirestoreConnected(false);
        setErrorDetails(`${error}`);
        return false;
      }
    }
    
    // No user, so we can't check collections
    return true;
  };
  
  // Attempt reconnection
  const attemptReconnect = async () => {
    console.log("Attempting to reconnect to Firebase...");
    setRetryCount(prev => prev + 1);
    
    const success = await checkFirestoreConnection();
    if (success) {
      console.log("Successfully reconnected to Firestore");
      setShowMessage(false);
      // Try to reload the page to ensure everything is fresh
      if (retryCount > 2) {
        window.location.reload();
      }
    } else {
      console.log("Failed to reconnect to Firestore, will retry in 30 seconds");
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(attemptReconnect, 30000);
    }
  };
  
  // Network status change handler
  const handleNetworkStatusChange = () => {
    const online = navigator.onLine;
    console.log(`Network status: ${online ? 'online' : 'offline'}`);
    setIsOnline(online);
    onStatusChange(online);
    
    // Show message immediately if offline
    if (!online) {
      setShowMessage(true);
      setErrorDetails("No internet connection");
    } else {
      // When coming back online, check Firestore connection
      checkFirestoreConnection().then(success => {
        if (!success) {
          setShowMessage(true);
        } else {
          if (showTimeoutRef.current) {
            clearTimeout(showTimeoutRef.current);
          }
          // Hide the message after 3 seconds if back online
          showTimeoutRef.current = setTimeout(() => {
            setShowMessage(false);
          }, 3000);
        }
      });
    }
  };
  
  // Initial check and event listeners
  useEffect(() => {
    // Check initial status
    handleNetworkStatusChange();
    
    // Add event listeners
    window.addEventListener('online', handleNetworkStatusChange);
    window.addEventListener('offline', handleNetworkStatusChange);
    
    // Initial Firestore check
    checkFirestoreConnection().then(success => {
      if (!success) {
        console.log("Initial Firestore connection check failed");
        setShowMessage(true);
        // Set up automatic retry
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(attemptReconnect, 5000);
      }
    });
    
    // Cleanup
    return () => {
      window.removeEventListener('online', handleNetworkStatusChange);
      window.removeEventListener('offline', handleNetworkStatusChange);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }
    };
  }, []);
  
  // Don't show anything if everything is fine
  if (!showMessage) {
    return null;
  }
  
  let statusMessage = "";
  if (!isOnline) {
    statusMessage = "You're offline. Please check your internet connection.";
  } else if (!isFirestoreConnected) {
    statusMessage = "Cannot connect to Firebase. ";
    if (errorDetails) {
      statusMessage += `Error: ${errorDetails}`;
    }
  }
  
  return (
    <div className="network-status">
      {showMessage && (
        <div className="network-status-overlay">
          <div className="network-status-message">
            <span>{statusMessage}</span>
            <div className="spinner"></div>
            <button 
              className="reconnect-button"
              onClick={attemptReconnect}
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkStatus; 