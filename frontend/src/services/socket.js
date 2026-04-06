import { io } from 'socket.io-client';

const getSocketURL = () => {
  if (window.SERVER_URL) return window.SERVER_URL;
  if (process.env.NODE_ENV === 'development') return 'http://localhost:5001';
  return `http://${window.location.hostname}:5001`;
};

let socket = null;
let heartbeatInterval = null;

// Generate a unique device ID (persisted in localStorage)
const getDeviceId = () => {
  let deviceId = localStorage.getItem('pos_device_id');
  if (!deviceId) {
    deviceId = `DEV-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('pos_device_id', deviceId);
  }
  return deviceId;
};

export const connectSocket = () => {
  if (socket?.connected) return socket;
  // Prevent creating a new socket if one is already connecting
  if (socket && !socket.connected && socket.io?.engine?.transport) return socket;

  socket = io(getSocketURL(), {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);

    // Register device with master
    const deviceId = getDeviceId();
    socket.emit('device:register', {
      deviceId,
      type: localStorage.getItem('pos_device_type') || 'cashier_terminal',
    });

    // Start heartbeat (every 8 seconds)
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (socket?.connected) {
        socket.emit('device:heartbeat', { deviceId: getDeviceId(), timestamp: Date.now() });
      }
    }, 8000);

    // Trigger sync on reconnect (async, fire-and-forget)
    import('../utils/syncQueue').then(({ fullSync }) => {
      fullSync().catch(err => console.warn('[Socket] Reconnect sync failed:', err.message));
    }).catch(() => {});
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  });

  // Handle device lock from master
  socket.on('device:locked', (data) => {
    if (data.deviceId === getDeviceId()) {
      localStorage.setItem('pos_device_locked', 'true');
      localStorage.setItem('pos_device_lock_reason', data.reason || 'Locked by admin');
      window.dispatchEvent(new CustomEvent('device:locked', { detail: data }));
    }
  });

  socket.on('device:unlocked', (data) => {
    if (data.deviceId === getDeviceId()) {
      localStorage.removeItem('pos_device_locked');
      localStorage.removeItem('pos_device_lock_reason');
      window.dispatchEvent(new CustomEvent('device:unlocked', { detail: data }));
    }
  });

  socket.on('connect_error', (error) => {
    console.log('Socket connection error:', error.message);
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) return connectSocket();
  return socket;
};

export const getDeviceIdExport = getDeviceId;

export const disconnectSocket = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default { connectSocket, getSocket, disconnectSocket, getDeviceId: getDeviceIdExport };
