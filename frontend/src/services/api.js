import axios from 'axios';
import connectionManager from '../utils/connectionManager';
import { enqueueOfflineOp, getCachedMenu, getCachedTables, getCachedOrders } from '../utils/offlineStorage';

const getBaseURL = () => {
  // In Electron or when server IP is configured
  if (window.SERVER_URL) return window.SERVER_URL;
  // Development proxy
  if (process.env.NODE_ENV === 'development') return '';
  // Try to detect from current URL
  return `http://${window.location.hostname}:5001`;
};

const api = axios.create({
  baseURL: getBaseURL() + '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Re-evaluate base URL on each request (handles Electron late injection)
api.interceptors.request.use((config) => {
  // Update baseURL if SERVER_URL was injected after initial load (Electron)
  if (window.SERVER_URL && !config.baseURL.startsWith(window.SERVER_URL)) {
    config.baseURL = window.SERVER_URL + '/api';
  }

  const token = localStorage.getItem('pos_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Attach device identifier for master-slave tracking
  const deviceId = localStorage.getItem('pos_device_id');
  if (deviceId) {
    config.headers['X-Device-Id'] = deviceId;
  }
  return config;
});

// Response interceptor — offline fallback + auth error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      if (window.location.pathname !== '/login') {
        window.history.pushState({}, '', '/login');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      return Promise.reject(error);
    }

    // Network error — server unreachable
    const isNetworkError = !error.response && (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || error.message === 'Network Error');

    if (isNetworkError) {
      const config = error.config;
      const method = config.method?.toUpperCase();

      // For GET requests — try to serve from offline cache
      if (method === 'GET') {
        const cached = await serveCachedResponse(config.url);
        if (cached) {
          return { data: cached, status: 200, _fromCache: true };
        }
      }

      // For mutation requests (POST/PUT/PATCH) — queue for later
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const op = await enqueueOfflineOp({
          method,
          url: config.url.replace(config.baseURL, ''),
          data: config.data ? JSON.parse(config.data) : undefined,
        });
        console.log(`[Offline] Queued operation: ${method} ${config.url} (id: ${op.id})`);
        // Return a synthetic success so the UI doesn't break
        return {
          data: { _queued: true, _offlineId: op.id, message: 'Operation saved offline — will sync when connected' },
          status: 202,
          _fromOffline: true,
        };
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Serve a cached response for known GET endpoints when offline
 */
async function serveCachedResponse(url) {
  try {
    if (url.includes('/menu')) {
      const items = await getCachedMenu();
      if (items.length > 0) return { items, _cached: true };
    }
    if (url.includes('/tables')) {
      const tables = await getCachedTables();
      if (tables.length > 0) return { tables, _cached: true };
    }
    if (url.includes('/orders')) {
      const orders = await getCachedOrders();
      if (orders.length > 0) return { orders, _cached: true };
    }
  } catch (err) {
    console.error('[Offline] Cache read error:', err);
  }
  return null;
}

export default api;
