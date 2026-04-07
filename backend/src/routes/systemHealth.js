const router = require('express').Router();
const { auth, authorize } = require('../middleware/auth');
const { jobQueue } = require('../services/jobQueue');
const { eventBus } = require('../services/eventBus');
const { getSyncStatus } = require('../services/cloudSync');
const mongoose = require('mongoose');
const os = require('os');

// GET /api/system-health — comprehensive system health
router.get('/', auth, authorize('admin', 'manager'), async (req, res) => {
  const memUsage = process.memoryUsage();
  const cloudSync = getSyncStatus();

  // Rush mode status
  let rushMode = { enabled: false };
  try {
    const SystemSettings = require('../models/SystemSettings');
    const settings = await SystemSettings.getInstance();
    rushMode = settings.rushMode || { enabled: false };
  } catch { /* ignore */ }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    uptimeFormatted: formatUptime(process.uptime()),

    // Database
    db: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      host: mongoose.connection.host || 'unknown',
      name: mongoose.connection.name || 'unknown',
    },

    // Memory
    memory: {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      systemFree: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
      systemTotal: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
    },

    // Job Queue
    jobQueue: jobQueue.getStats(),

    // Event Bus
    eventBus: eventBus.getStats(),

    // Cloud Sync
    cloudSync,

    // Rush Mode
    rushMode: { enabled: rushMode.enabled, enabledAt: rushMode.enabledAt },

    // System
    nodeVersion: process.version,
    platform: os.platform(),
    cpus: os.cpus().length,
    hostname: os.hostname(),
  });
});

// GET /api/system-health/jobs/dead — Dead queue contents
router.get('/jobs/dead', auth, authorize('admin'), async (req, res) => {
  res.json({ deadQueue: jobQueue.getDeadQueue() });
});

// POST /api/system-health/jobs/retry-dead — Retry all dead jobs
router.post('/jobs/retry-dead', auth, authorize('admin'), async (req, res) => {
  const count = jobQueue.retryDeadQueue();
  res.json({ message: `${count} dead jobs re-queued` });
});

// POST /api/system-health/jobs/clear-dead — Clear dead queue
router.post('/jobs/clear-dead', auth, authorize('admin'), async (req, res) => {
  const count = jobQueue.clearDeadQueue();
  res.json({ message: `${count} dead jobs cleared` });
});

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

module.exports = router;
