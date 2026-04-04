/**
 * Offline Storage — IndexedDB wrapper for local data caching
 * 
 * Stores critical POS data locally on each device so the app works
 * even when the LAN server is temporarily unreachable.
 * 
 * Stores: menu items, tables, recent orders, pending offline operations
 */

const DB_NAME = 'pos_offline';
const DB_VERSION = 1;

const STORES = {
  MENU: 'menu',
  TABLES: 'tables',
  ORDERS: 'orders',
  QUEUE: 'offlineQueue',
  META: 'meta',
};

let dbInstance = null;

const openDB = () => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORES.MENU)) {
        db.createObjectStore(STORES.MENU, { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains(STORES.TABLES)) {
        db.createObjectStore(STORES.TABLES, { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains(STORES.ORDERS)) {
        const orderStore = db.createObjectStore(STORES.ORDERS, { keyPath: '_id' });
        orderStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.QUEUE)) {
        db.createObjectStore(STORES.QUEUE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[OfflineDB] Open error:', event.target.error);
      reject(event.target.error);
    };
  });
};

// Generic helpers
const getStore = async (storeName, mode = 'readonly') => {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
};

const getAllFromStore = async (storeName) => {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const putInStore = async (storeName, data) => {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  if (Array.isArray(data)) {
    data.forEach(item => store.put(item));
  } else {
    store.put(data);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const clearStore = async (storeName) => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// ─── Public API ───

/** Cache menu items locally */
export const cacheMenu = async (items) => {
  await clearStore(STORES.MENU);
  await putInStore(STORES.MENU, items);
};

/** Get cached menu items */
export const getCachedMenu = () => getAllFromStore(STORES.MENU);

/** Cache tables locally */
export const cacheTables = async (tables) => {
  await clearStore(STORES.TABLES);
  await putInStore(STORES.TABLES, tables);
};

/** Get cached tables */
export const getCachedTables = () => getAllFromStore(STORES.TABLES);

/** Cache recent orders */
export const cacheOrders = async (orders) => {
  await putInStore(STORES.ORDERS, orders);
};

/** Get cached orders */
export const getCachedOrders = () => getAllFromStore(STORES.ORDERS);

// ─── Offline Queue ───

/** Add an operation to the offline queue (will be replayed when back online) */
export const enqueueOfflineOp = async (operation) => {
  const op = {
    ...operation,
    id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    retries: 0,
  };
  await putInStore(STORES.QUEUE, op);
  return op;
};

/** Get all pending offline operations */
export const getOfflineQueue = () => getAllFromStore(STORES.QUEUE);

/** Remove a processed operation from the queue */
export const removeFromQueue = async (id) => {
  const db = await openDB();
  const tx = db.transaction(STORES.QUEUE, 'readwrite');
  const store = tx.objectStore(STORES.QUEUE);
  // Find by our string id field
  const all = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const item = all.find(op => op.id === id);
  if (item) {
    store.delete(item.id);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

/** Clear the entire offline queue */
export const clearOfflineQueue = async () => {
  await clearStore(STORES.QUEUE);
};

// ─── Meta (last sync timestamp, etc.) ───

export const setMeta = async (key, value) => {
  await putInStore(STORES.META, { key, value, updatedAt: new Date().toISOString() });
};

export const getMeta = async (key) => {
  const store = await getStore(STORES.META);
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
  });
};

export default {
  cacheMenu, getCachedMenu,
  cacheTables, getCachedTables,
  cacheOrders, getCachedOrders,
  enqueueOfflineOp, getOfflineQueue, removeFromQueue, clearOfflineQueue,
  setMeta, getMeta,
};
