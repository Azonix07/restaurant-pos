const Order = require('../models/Order');
const AuditLog = require('../models/AuditLog');
const AlertLog = require('../models/AlertLog');
const BillSequence = require('../models/BillSequence');
const KOT = require('../models/KOT');

let monitorInterval = null;

const runFraudChecks = async (io) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today.getTime() + 86400000);
  const dateFilter = { createdAt: { $gte: today, $lt: endOfDay } };
  const alerts = [];

  try {
    // 1. Bill number gaps
    const dateStr = today.toISOString().split('T')[0];
    const gaps = await BillSequence.detectGaps('BILL', dateStr);
    if (gaps.length > 0) {
      alerts.push({
        type: 'FRAUD_BILL_GAP',
        severity: 'critical',
        title: 'Bill Number Gap Detected',
        message: `Missing bill numbers: ${gaps.slice(0, 10).join(', ')}${gaps.length > 10 ? ` (+${gaps.length - 10} more)` : ''}`,
        metadata: { gaps },
      });
    }

    // 2. Quick voids (cancelled within 5 min of creation)
    const quickVoids = await Order.countDocuments({
      ...dateFilter,
      status: 'cancelled',
      $expr: { $lt: [{ $subtract: ['$updatedAt', '$createdAt'] }, 300000] },
    });
    if (quickVoids > 3) {
      alerts.push({
        type: 'FRAUD_QUICK_VOID',
        severity: 'critical',
        title: 'Suspicious Quick Voids',
        message: `${quickVoids} orders cancelled within 5 minutes of creation`,
        metadata: { count: quickVoids },
      });
    }

    // 3. Excessive cancellations
    const cancelCount = await Order.countDocuments({ ...dateFilter, status: 'cancelled' });
    if (cancelCount > 10) {
      alerts.push({
        type: 'FRAUD_HIGH_CANCEL',
        severity: 'warning',
        title: 'High Cancellation Rate',
        message: `${cancelCount} orders cancelled today`,
        metadata: { count: cancelCount },
      });
    }

    // 4. Discount abuse
    const paidOrders = await Order.find({ ...dateFilter, paymentStatus: 'paid' });
    const totalSales = paidOrders.reduce((s, o) => s + o.subtotal, 0);
    const totalDiscount = paidOrders.reduce((s, o) => s + o.discount, 0);
    const discountRate = totalSales > 0 ? (totalDiscount / totalSales) * 100 : 0;
    if (discountRate > 10) {
      alerts.push({
        type: 'FRAUD_HIGH_DISCOUNT',
        severity: 'warning',
        title: 'Excessive Discount Rate',
        message: `Discount rate: ${discountRate.toFixed(1)}% (₹${totalDiscount.toFixed(0)} on ₹${totalSales.toFixed(0)})`,
        metadata: { discountRate: discountRate.toFixed(1), totalDiscount, totalSales },
      });
    }

    // 5. Suspicious delete activity
    const deletions = await AuditLog.countDocuments({ ...dateFilter, action: 'delete' });
    if (deletions > 10) {
      alerts.push({
        type: 'FRAUD_DELETIONS',
        severity: 'warning',
        title: 'High Delete Activity',
        message: `${deletions} delete operations logged today`,
        metadata: { count: deletions },
      });
    }

    // Persist and emit new alerts only (deduplicate by type per day)
    for (const alert of alerts) {
      const exists = await AlertLog.findOne({
        type: alert.type,
        createdAt: { $gte: today, $lt: endOfDay },
      });
      if (!exists) {
        const saved = await AlertLog.create(alert);
        io.to('admin').to('manager').emit('fraud:alert', saved);
        console.log(`[FRAUD MONITOR] New alert: ${alert.type} - ${alert.message}`);
      }
    }
  } catch (err) {
    console.error('[FRAUD MONITOR] Error:', err.message);
  }
};

exports.startFraudMonitor = (io, intervalMs = 300000) => {
  // Default: run every 5 minutes
  if (monitorInterval) clearInterval(monitorInterval);

  // Run immediately, then on interval
  setTimeout(() => runFraudChecks(io), 10000); // 10s after startup
  monitorInterval = setInterval(() => runFraudChecks(io), intervalMs);

  console.log(`[FRAUD MONITOR] Started (interval: ${intervalMs / 1000}s)`);
};

exports.stopFraudMonitor = () => {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[FRAUD MONITOR] Stopped');
  }
};
