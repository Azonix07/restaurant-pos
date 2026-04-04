/**
 * Connection Manager — Detects network state and auto-switches between modes
 * 
 * Modes:
 *   'online'  — Internet available, using LAN server (fastest)
 *   'lan'     — No internet but LAN server reachable (local WiFi)
 *   'offline' — Nothing reachable, using cached data + queuing operations
 * 
 * Hierarchy: Always prefer LAN server (fastest). Use internet for cloud sync only.
 * The LAN server is the primary data source. Cloud is for remote access by admin.
 */

const HEALTH_CHECK_INTERVAL = 10000; // 10s
const INTERNET_CHECK_INTERVAL = 30000; // 30s
const INTERNET_CHECK_URL = 'https://dns.google/resolve?name=example.com&type=A';

let currentMode = 'online'; // Start optimistic
let lanReachable = true;
let internetReachable = navigator.onLine;
let healthCheckTimer = null;
let internetCheckTimer = null;
let listeners = new Set();

/**
 * Get the LAN server URL
 */
const getServerUrl = () => {
  if (window.SERVER_URL) return window.SERVER_URL;
  if (process.env.NODE_ENV === 'development') return 'http://localhost:5001';
  return `http://${window.location.hostname}:5001`;
};

/**
 * Check if the LAN server is reachable
 */
const checkLAN = async () => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${getServerUrl()}/api/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    lanReachable = res.ok;
  } catch {
    lanReachable = false;
  }
  return lanReachable;
};

/**
 * Check if internet is available (lightweight DNS check)
 */
const checkInternet = async () => {
  if (!navigator.onLine) {
    internetReachable = false;
    return false;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(INTERNET_CHECK_URL, {
      signal: controller.signal,
      mode: 'cors',
      cache: 'no-store',
    });
    clearTimeout(timeout);
    internetReachable = res.ok;
  } catch {
    internetReachable = false;
  }
  return internetReachable;
};

/**
 * Determine the current mode based on checks
 */
const evaluateMode = () => {
  let newMode;
  if (lanReachable && internetReachable) {
    newMode = 'online';
  } else if (lanReachable) {
    newMode = 'lan';
  } else {
    newMode = 'offline';
  }

  if (newMode !== currentMode) {
    const oldMode = currentMode;
    currentMode = newMode;
    notifyListeners({ mode: newMode, previousMode: oldMode, lanReachable, internetReachable });
  }
};

/**
 * Notify all subscribers of mode changes
 */
const notifyListeners = (event) => {
  listeners.forEach(fn => {
    try { fn(event); } catch (err) { console.error('[ConnMgr] Listener error:', err); }
  });
};

/**
 * Start monitoring connection status
 */
const startMonitoring = () => {
  // Initial checks
  checkLAN().then(() => checkInternet()).then(() => evaluateMode());

  // Periodic LAN health check (fast, every 10s)
  healthCheckTimer = setInterval(async () => {
    await checkLAN();
    evaluateMode();
  }, HEALTH_CHECK_INTERVAL);

  // Periodic internet check (slower, every 30s)
  internetCheckTimer = setInterval(async () => {
    await checkInternet();
    evaluateMode();
  }, INTERNET_CHECK_INTERVAL);

  // Browser online/offline events (instant detection)
  window.addEventListener('online', async () => {
    await checkInternet();
    await checkLAN();
    evaluateMode();
  });

  window.addEventListener('offline', () => {
    internetReachable = false;
    evaluateMode();
  });
};

/**
 * Stop monitoring
 */
const stopMonitoring = () => {
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  if (internetCheckTimer) clearInterval(internetCheckTimer);
};

/**
 * Subscribe to mode changes
 * @returns {Function} Unsubscribe function
 */
const subscribe = (callback) => {
  listeners.add(callback);
  // Immediately call with current state
  callback({ mode: currentMode, lanReachable, internetReachable });
  return () => listeners.delete(callback);
};

/**
 * Get current connection state
 */
const getState = () => ({
  mode: currentMode,
  lanReachable,
  internetReachable,
  serverUrl: getServerUrl(),
});

/**
 * Force a connectivity re-check right now
 */
const recheckNow = async () => {
  await Promise.all([checkLAN(), checkInternet()]);
  evaluateMode();
  return getState();
};

export default {
  startMonitoring,
  stopMonitoring,
  subscribe,
  getState,
  recheckNow,
  getServerUrl,
};
