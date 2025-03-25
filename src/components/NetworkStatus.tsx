import React, { useState, useEffect } from 'react';
import './NetworkStatus.css'; // We'll create this file next

interface NetworkStatusProps {
  onStatusChange?: (isOnline: boolean) => void;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ onStatusChange }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [reconnecting, setReconnecting] = useState(false);
  const [lastReconnectAttempt, setLastReconnectAttempt] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      console.log('Network is back online');
      setIsOnline(true);
      setReconnecting(false);
      if (onStatusChange) onStatusChange(true);
    };

    const handleOffline = () => {
      console.log('Network is offline');
      setIsOnline(false);
      if (onStatusChange) onStatusChange(false);
    };

    // Add event listeners for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Every 30 seconds, check if we're still having issues and try to reconnect
    const intervalId = setInterval(() => {
      if (!isOnline || reconnecting) {
        const now = new Date();
        
        // Only try to reconnect if we haven't tried in the last 30 seconds
        if (!lastReconnectAttempt || (now.getTime() - lastReconnectAttempt.getTime() > 30000)) {
          console.log('Attempting to reconnect...');
          setReconnecting(true);
          setLastReconnectAttempt(now);
          
          // Try to ping a resource to check connectivity
          fetch('https://www.googleapis.com/ping?key=' + Date.now(), { 
            mode: 'no-cors',
            cache: 'no-store' 
          })
            .then(() => {
              if (!isOnline) {
                console.log('Reconnect successful');
                setIsOnline(true);
                setReconnecting(false);
                if (onStatusChange) onStatusChange(true);
                
                // Force a page reload to reestablish all connections
                window.location.reload();
              }
            })
            .catch(error => {
              console.error('Reconnect failed:', error);
              setReconnecting(false);
            });
        }
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [isOnline, reconnecting, lastReconnectAttempt, onStatusChange]);

  if (isOnline) {
    return null; // Don't show anything when online
  }

  return (
    <div className="network-status">
      <div className="network-status-overlay">
        <div className="network-status-message">
          {reconnecting ? (
            <>
              <div className="spinner"></div>
              <p>Reconnecting...</p>
            </>
          ) : (
            <>
              <p>⚠️ You appear to be offline</p>
              <button 
                className="reconnect-button"
                onClick={() => {
                  setReconnecting(true);
                  setLastReconnectAttempt(new Date());
                  // Force reload to reestablish connections
                  window.location.reload();
                }}
              >
                Reconnect
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkStatus; 