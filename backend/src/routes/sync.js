const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getSyncStatus, forceSyncNow } = require('../services/cloudSync');

// GET /api/sync/status — Get cloud sync status
router.get('/status', auth, (req, res) => {
  res.json(getSyncStatus());
});

// POST /api/sync/now — Force immediate sync (admin only)
router.post('/now', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  try {
    const result = await forceSyncNow();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sync/data — Bulk data endpoint for device sync
// Devices call this after reconnecting to get latest data
router.get('/data', auth, async (req, res) => {
  const { since } = req.query;
  const mongoose = require('mongoose');
  const db = mongoose.connection.db;

  const sinceDate = since ? new Date(since) : new Date(0);
  const collections = ['orders', 'menuitems', 'tables'];

  try {
    const data = {};
    for (const col of collections) {
      data[col] = await db.collection(col)
        .find({ updatedAt: { $gt: sinceDate } })
        .sort({ updatedAt: -1 })
        .limit(500)
        .toArray();
    }
    data.syncedAt = new Date().toISOString();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sync/push — Receive queued operations from offline devices
router.post('/push', auth, async (req, res) => {
  const { operations } = req.body;
  if (!Array.isArray(operations) || operations.length === 0) {
    return res.json({ processed: 0 });
  }

  const mongoose = require('mongoose');
  const results = [];

  for (const op of operations) {
    try {
      const { method, url, data, timestamp } = op;
      // Replay the operation by making an internal API request
      // We use mongoose models directly to avoid circular HTTP calls
      const collection = url.split('/')[1]; // e.g., /orders -> orders
      const db = mongoose.connection.db;

      if (method === 'POST' && data) {
        const result = await db.collection(collection).insertOne({
          ...data,
          _syncedFromOffline: true,
          _offlineTimestamp: new Date(timestamp),
          createdAt: new Date(timestamp),
          updatedAt: new Date(),
        });
        results.push({ id: op.id, status: 'ok', insertedId: result.insertedId });
      } else if (method === 'PUT' || method === 'PATCH') {
        const docId = url.split('/')[2];
        if (docId && mongoose.Types.ObjectId.isValid(docId)) {
          await db.collection(collection).updateOne(
            { _id: new mongoose.Types.ObjectId(docId) },
            { $set: { ...data, updatedAt: new Date() } }
          );
          results.push({ id: op.id, status: 'ok' });
        }
      }
    } catch (err) {
      results.push({ id: op.id, status: 'error', message: err.message });
    }
  }

  // Emit socket event so other devices know data changed
  const io = req.app.get('io');
  if (io) {
    io.emit('sync:dataChanged', { source: 'offline-push', count: results.length });
  }

  res.json({ processed: results.length, results });
});

module.exports = router;
