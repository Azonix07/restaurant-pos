/**
 * Cloud Sync Service
 * 
 * Syncs local MongoDB data to a cloud MongoDB Atlas instance in the background.
 * This allows the admin/owner to access POS data remotely from their phone
 * while the restaurant operates on a local LAN server.
 *
 * Architecture:
 *   Local MongoDB (LAN server) ──sync──> Cloud MongoDB Atlas (remote access)
 *
 * The local DB is always the source of truth during operations.
 * Cloud is a near-real-time replica for remote read access + backup.
 */

const mongoose = require('mongoose');
const config = require('../config');

let cloudConnection = null;
let syncInterval = null;
let isSyncing = false;
let lastSyncAt = null;
let syncStatus = 'idle'; // idle | syncing | error | disabled
let lastError = null;

// Collections to sync (most important for remote monitoring)
const SYNC_COLLECTIONS = [
  'orders', 'menuitems', 'tables', 'users', 'transactions',
  'expenses', 'kots', 'customers', 'invoices', 'parties',
  'accounts', 'journalentries', 'devices', 'alertlogs',
  'companies', 'billsequences',
];

/**
 * Connect to the cloud MongoDB Atlas instance
 */
const connectCloud = async () => {
  if (!config.cloudMongoUri) {
    syncStatus = 'disabled';
    return null;
  }

  try {
    cloudConnection = await mongoose.createConnection(config.cloudMongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      maxPoolSize: 3,
    }).asPromise();

    console.log('[CloudSync] Connected to cloud MongoDB');
    syncStatus = 'idle';
    return cloudConnection;
  } catch (err) {
    console.error('[CloudSync] Cloud connection failed:', err.message);
    syncStatus = 'error';
    lastError = err.message;
    cloudConnection = null;
    return null;
  }
};

/**
 * Sync a single collection from local to cloud.
 * Uses a change-tracking approach: sync documents modified since lastSyncAt.
 */
const syncCollection = async (collectionName) => {
  if (!cloudConnection) return { synced: 0 };

  const localDb = mongoose.connection.db;
  const cloudDb = cloudConnection.db;

  const localCol = localDb.collection(collectionName);
  const cloudCol = cloudDb.collection(collectionName);

  // Build query: docs modified since last sync
  const query = lastSyncAt
    ? { updatedAt: { $gt: lastSyncAt } }
    : {};

  const docs = await localCol.find(query).toArray();
  if (docs.length === 0) return { synced: 0 };

  // Upsert each document to cloud
  const bulkOps = docs.map(doc => ({
    replaceOne: {
      filter: { _id: doc._id },
      replacement: doc,
      upsert: true,
    },
  }));

  const result = await cloudCol.bulkWrite(bulkOps, { ordered: false });
  return {
    synced: result.upsertedCount + result.modifiedCount,
    collection: collectionName,
  };
};

/**
 * Run a full sync cycle across all tracked collections
 */
const runSyncCycle = async () => {
  if (isSyncing || !cloudConnection) return;
  isSyncing = true;
  syncStatus = 'syncing';

  const cycleStart = new Date();
  let totalSynced = 0;

  try {
    for (const col of SYNC_COLLECTIONS) {
      try {
        const result = await syncCollection(col);
        totalSynced += result.synced;
      } catch (colErr) {
        // Skip individual collection errors, continue with others
        console.error(`[CloudSync] Error syncing ${col}:`, colErr.message);
      }
    }

    lastSyncAt = cycleStart;
    syncStatus = 'idle';
    lastError = null;

    if (totalSynced > 0) {
      console.log(`[CloudSync] Synced ${totalSynced} documents at ${cycleStart.toISOString()}`);
    }
  } catch (err) {
    console.error('[CloudSync] Sync cycle error:', err.message);
    syncStatus = 'error';
    lastError = err.message;

    // Try to reconnect if connection was lost
    if (err.message.includes('topology') || err.message.includes('connect')) {
      cloudConnection = null;
      setTimeout(() => connectCloud(), 5000);
    }
  } finally {
    isSyncing = false;
  }
};

/**
 * Start the periodic sync service
 */
const startSync = async () => {
  if (!config.cloudMongoUri || !config.syncEnabled) {
    console.log('[CloudSync] Cloud sync is disabled (set CLOUD_MONGODB_URI and SYNC_ENABLED=true to enable)');
    syncStatus = 'disabled';
    return;
  }

  await connectCloud();
  if (!cloudConnection) return;

  // Initial full sync
  await runSyncCycle();

  // Periodic sync
  syncInterval = setInterval(() => {
    runSyncCycle();
  }, config.syncIntervalMs);

  console.log(`[CloudSync] Periodic sync started (every ${config.syncIntervalMs / 1000}s)`);
};

/**
 * Stop the sync service
 */
const stopSync = async () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (cloudConnection) {
    await cloudConnection.close();
    cloudConnection = null;
  }
  syncStatus = 'disabled';
  console.log('[CloudSync] Sync stopped');
};

/**
 * Force an immediate sync cycle
 */
const forceSyncNow = async () => {
  if (!cloudConnection) {
    await connectCloud();
  }
  if (cloudConnection) {
    await runSyncCycle();
  }
  return getSyncStatus();
};

/**
 * Get current sync status
 */
const getSyncStatus = () => ({
  status: syncStatus,
  lastSyncAt,
  lastError,
  cloudConnected: !!cloudConnection,
  syncEnabled: config.syncEnabled && !!config.cloudMongoUri,
});

module.exports = {
  startSync,
  stopSync,
  forceSyncNow,
  getSyncStatus,
  runSyncCycle,
};
