import { useState, useEffect } from 'react';
import connectionManager from '../utils/connectionManager';

/**
 * React hook that provides live connection status
 * @returns {{ mode: 'online'|'lan'|'offline', lanReachable: boolean, internetReachable: boolean }}
 */
const useConnectionStatus = () => {
  const [status, setStatus] = useState(connectionManager.getState());

  useEffect(() => {
    const unsubscribe = connectionManager.subscribe((event) => {
      setStatus({
        mode: event.mode,
        lanReachable: event.lanReachable,
        internetReachable: event.internetReachable,
      });
    });
    return unsubscribe;
  }, []);

  return status;
};

export default useConnectionStatus;
