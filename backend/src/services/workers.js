/**
 * Background Workers
 * 
 * Each worker registers with the JobQueue and subscribes to EventBus events.
 * Workers run ONLY in the background — they never block core POS operations.
 * 
 * Workers:
 *   - sync_worker     → queues cloud sync on data changes
 *   - fraud_worker    → per-user risk scoring on suspicious actions
 *   - report_worker   → pre-computes daily aggregates
 *   - inventory_worker → stock reservation + low-stock alerts
 *   - insights_worker  → peak hour and recommendation analysis
 */

const { eventBus, EVENTS } = require('./eventBus');
const { jobQueue } = require('./jobQueue');
const logger = require('../utils/logger');

let _io = null; // socket.io reference, set during init

// ─── SYNC WORKER ──────────────────────────────────────────────
// Queues cloud sync pushes when data changes
jobQueue.registerWorker('sync_push', async (data) => {
  const { runSyncCycle, getSyncStatus } = require('./cloudSync');
  const status = getSyncStatus();
  if (status.status === 'disabled') return; // cloud sync not configured
  await runSyncCycle();
});

// ─── FRAUD WORKER ─────────────────────────────────────────────
// Per-user risk scoring triggered by suspicious events
jobQueue.registerWorker('fraud_score', async (data) => {
  const Order = require('../models/Order');
  const AuditLog = require('../models/AuditLog');
  const AlertLog = require('../models/AlertLog');

  const { userId, userName, action, orderId } = data;
  if (!userId) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today.getTime() + 86400000);
  const dateFilter = { createdAt: { $gte: today, $lt: endOfDay } };

  // Count today's actions by this user
  const [refunds, discountOrders, deletions] = await Promise.all([
    Order.countDocuments({ ...dateFilter, 'refund.refundedBy': userId }),
    Order.countDocuments({ ...dateFilter, createdBy: userId, discount: { $gt: 0 } }),
    AuditLog.countDocuments({ ...dateFilter, user: userId, action: 'delete' }),
  ]);

  // risk_score = (refund × 3) + (discount × 2) + (delete × 4)
  const riskScore = (refunds * 3) + (discountOrders * 2) + (deletions * 4);

  if (riskScore >= 15) {
    const existing = await AlertLog.findOne({
      type: 'FRAUD_USER_RISK',
      'metadata.userId': userId,
      createdAt: { $gte: today, $lt: endOfDay },
    });

    if (!existing) {
      const alert = await AlertLog.create({
        type: 'FRAUD_USER_RISK',
        severity: riskScore >= 25 ? 'critical' : 'warning',
        title: `High Risk Score: ${userName || 'Unknown'}`,
        message: `Risk score ${riskScore} — Refunds: ${refunds}, Discounts: ${discountOrders}, Deletions: ${deletions}`,
        metadata: { userId, userName, riskScore, refunds, discountOrders, deletions },
      });
      if (_io) {
        _io.to('admin').to('manager').emit('fraud:alert', alert);
      }
      logger.warn(`[FraudWorker] User ${userName} risk score: ${riskScore}`);
    }
  }
});

// ─── REPORT WORKER ────────────────────────────────────────────
// Incremental daily aggregate updates after payments
jobQueue.registerWorker('report_update', async (data) => {
  // Pre-compute popular items and hourly breakdown
  const Order = require('../models/Order');
  const cache = require('../utils/cache');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today.getTime() + 86400000);

  const hourlyAgg = await Order.aggregate([
    { $match: { paymentStatus: 'paid', completedAt: { $gte: today, $lt: endOfDay } } },
    { $group: {
      _id: { $hour: '$completedAt' },
      orders: { $sum: 1 },
      revenue: { $sum: '$total' },
    }},
    { $sort: { '_id': 1 } },
  ]);

  const itemAgg = await Order.aggregate([
    { $match: { paymentStatus: 'paid', completedAt: { $gte: today, $lt: endOfDay } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
    { $sort: { qty: -1 } },
    { $limit: 20 },
  ]);

  // Cache for fast access by report endpoints
  cache.set('report:hourly', hourlyAgg, 300000);   // 5 min TTL
  cache.set('report:topItems', itemAgg, 300000);
});

// ─── INVENTORY WORKER ─────────────────────────────────────────
// Stock alerts after deductions
jobQueue.registerWorker('stock_alert_check', async (data) => {
  const RawMaterial = require('../models/RawMaterial');
  const AlertLog = require('../models/AlertLog');

  const lowStock = await RawMaterial.find({
    $expr: { $lte: ['$currentStock', '$minimumStock'] },
    isActive: { $ne: false },
  }).lean();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today.getTime() + 86400000);

  for (const mat of lowStock) {
    const existing = await AlertLog.findOne({
      type: 'low_stock',
      'metadata.materialId': mat._id.toString(),
      createdAt: { $gte: today, $lt: endOfDay },
    });
    if (!existing) {
      const alert = await AlertLog.create({
        type: 'low_stock',
        severity: mat.currentStock <= 0 ? 'critical' : 'warning',
        title: `Low Stock: ${mat.name}`,
        message: `${mat.name}: ${mat.currentStock} ${mat.unit} remaining (min: ${mat.minimumStock})`,
        metadata: { materialId: mat._id.toString(), currentStock: mat.currentStock, minimumStock: mat.minimumStock },
      });
      if (_io) {
        _io.to('admin').to('manager').emit('alert:new', alert);
      }
    }
  }
});

// ─── INSIGHTS WORKER ──────────────────────────────────────────
// Peak hour detection + simple recommendations
jobQueue.registerWorker('insights_compute', async (data) => {
  const Order = require('../models/Order');
  const cache = require('../utils/cache');

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const peakHours = await Order.aggregate([
    { $match: { paymentStatus: 'paid', completedAt: { $gte: weekAgo } } },
    { $group: {
      _id: { hour: { $hour: '$completedAt' }, dayOfWeek: { $dayOfWeek: '$completedAt' } },
      avg: { $avg: '$total' },
      count: { $sum: 1 },
    }},
    { $sort: { count: -1 } },
  ]);

  cache.set('insights:peakHours', peakHours, 600000); // 10 min TTL
});

// ─── EVENT SUBSCRIPTIONS ──────────────────────────────────────

const initWorkers = (io) => {
  _io = io;

  // --- Order lifecycle events ---
  eventBus.subscribe(EVENTS.ORDER_CREATED, (payload) => {
    jobQueue.enqueue('sync_push', payload, { priority: 1 });
  }, 'sync-on-order-create');

  eventBus.subscribe(EVENTS.PAYMENT_PROCESSED, (payload) => {
    jobQueue.enqueue('sync_push', payload, { priority: 2 });
    jobQueue.enqueue('report_update', payload, { priority: 1 });
    jobQueue.enqueue('stock_alert_check', payload, { priority: 1 });
    jobQueue.enqueue('fraud_score', {
      userId: payload.userId,
      userName: payload.userName,
      action: 'payment',
      orderId: payload.orderId,
    }, { priority: 3 });
  }, 'workers-on-payment');

  eventBus.subscribe(EVENTS.ORDER_CANCELLED, (payload) => {
    jobQueue.enqueue('fraud_score', {
      userId: payload.userId,
      userName: payload.userName,
      action: 'cancel',
      orderId: payload.orderId,
    }, { priority: 5 });
    jobQueue.enqueue('sync_push', payload, { priority: 1 });
  }, 'fraud-on-cancel');

  eventBus.subscribe(EVENTS.REFUND_PROCESSED, (payload) => {
    jobQueue.enqueue('fraud_score', {
      userId: payload.userId,
      userName: payload.userName,
      action: 'refund',
      orderId: payload.orderId,
    }, { priority: 5 });
    jobQueue.enqueue('sync_push', payload, { priority: 2 });
  }, 'fraud-on-refund');

  eventBus.subscribe(EVENTS.BILL_DELETED, (payload) => {
    jobQueue.enqueue('fraud_score', {
      userId: payload.userId,
      userName: payload.userName,
      action: 'delete',
    }, { priority: 5 });
    jobQueue.enqueue('sync_push', payload, { priority: 2 });
  }, 'fraud-on-bill-delete');

  eventBus.subscribe(EVENTS.STOCK_DEDUCTED, (payload) => {
    jobQueue.enqueue('stock_alert_check', payload, { priority: 2 });
  }, 'inventory-on-stock-deduct');

  eventBus.subscribe(EVENTS.WASTAGE_LOGGED, (payload) => {
    jobQueue.enqueue('stock_alert_check', payload, { priority: 2 });
    jobQueue.enqueue('fraud_score', {
      userId: payload.userId,
      userName: payload.userName,
      action: 'wastage',
    }, { priority: 3 });
  }, 'inventory-on-wastage');

  // Periodic insights (every 15 minutes)
  setInterval(() => {
    jobQueue.enqueue('insights_compute', {}, { priority: 0 });
  }, 15 * 60 * 1000);

  // Initial compute after startup
  setTimeout(() => {
    jobQueue.enqueue('insights_compute', {}, { priority: 0 });
    jobQueue.enqueue('report_update', {}, { priority: 0 });
  }, 15000);

  logger.info('[Workers] All background workers initialized');
};

module.exports = { initWorkers };
