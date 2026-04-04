/**
 * Sync Queue — Manages offline operation replay and data sync
 * 
 * When the device goes offline, API mutations are queued in IndexedDB.
 * When connection returns (LAN or online), this service:
 *   1. Pushes queued operations to the server
 *   2. Pulls fresh data to update local cache
 */

import api from '../services/api';
import { getOfflineQueue, removeFromQueue, clearOfflineQueue, setMeta, getMeta,
  cacheMenu, cacheTables, cacheOrders } from './offlineStorage';
import connectionManager from './connectionManager';

let isFlushing = false;
let flushListeners = new Set();

/**
 * Flush the offline queue — push all pending operations to the server
 */
export const flushQueue = async () => {
  if (isFlushing) return;
  const { mode } = connectionManager.getState();
  if (mode === 'offline') return;

  isFlushing = true;
  notifyFlushListeners('flushing');

  try {
    const queue = await getOfflineQueue();
    if (queue.length === 0) {
      isFlushing = false;
      notifyFlushListeners('idle');
      return;
    }

    console.log(`[SyncQueue] Flushing ${queue.length} queued operations`);

    // Try batch push first (server handles replay)
    try {
      const res = await api.post('/sync/push', { operations: queue });
      if (res.data.processed > 0) {
        await clearOfflineQueue();
        console.log(`[SyncQueue] Batch pushed ${res.data.processed} operations`);
      }
    } catch (batchErr) {
      // Batch push failed — try one by one
      console.warn('[SyncQueue] Batch push failed, trying individually:', batchErr.message);
      for (const op of queue) {
        try {
          await api({ method: op.method, url: op.url, data: op.data });
          await removeFromQueue(op.id);
        } catch (err) {
          console.error(`[SyncQueue] Failed to replay op ${op.id}:`, err.message);
          // Leave failed ops in queue for next retry
        }
      }
    }

    notifyFlushListeners('done');
  } catch (err) {
    console.error('[SyncQueue] Flush error:', err.message);
    notifyFlushListeners('error');
  } finally {
    isFlushing = false;
  }
};

/**
 * Pull fresh data from server and update local caches
 */
export const pullLatestData = async () => {
  const { mode } = connectionManager.getState();
  if (mode === 'offline') return;

  try {
    const lastSync = await getMeta('lastDataSync');

    // Fetch latest data since last sync
    const res = await api.get('/sync/data', {
      params: { since: lastSync || '' },
    });

    const data = res.data;

    // Update local caches
    if (data.menuitems?.length > 0) {
      await cacheMenu(data.menuitems);
    }
    if (data.tables?.length > 0) {
      await cacheTables(data.tables);
    }
    if (data.orders?.length > 0) {
      await cacheOrders(data.orders);
    }

    await setMeta('lastDataSync', data.syncedAt || new Date().toISOString());
    console.log('[SyncQueue] Local cache updated');
  } catch (err) {
    console.error('[SyncQueue] Pull data error:', err.message);
  }
};

/**
 * Full sync cycle: flush queue + pull latest data
 */
export const fullSync = async () => {
  await flushQueue();
  await pullLatestData();
};

/**
 * Auto-sync when connection state changes
 */
let unsubscribe = null;

export const startAutoSync = () => {
  // Sync when mode changes from offline to lan/online
  unsubscribe = connectionManager.subscribe((event) => {
    if (event.previousMode === 'offline' && event.mode !== 'offline') {
      console.log(`[SyncQueue] Connection restored (${event.mode}), starting sync...`);
      setTimeout(() => fullSync(), 1000); // Small delay for connection to stabilize
    }
  });
};

export const stopAutoSync = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
};

// Listener management for UI
const notifyFlushListeners = (status) => {
  flushListeners.forEach(fn => fn(status));
};

export const onFlushStatus = (callback) => {
  flushListeners.add(callback);
  return () => flushListeners.delete(callback);
};

export default { flushQueue, pullLatestData, fullSync, startAutoSync, stopAutoSync, onFlushStatus };
