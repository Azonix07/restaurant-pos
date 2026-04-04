import { useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';

const useSocket = (eventName, callback) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const socket = getSocket();
    const handler = (...args) => callbackRef.current(...args);
    socket.on(eventName, handler);
    return () => socket.off(eventName, handler);
  }, [eventName]);
};

export default useSocket;
