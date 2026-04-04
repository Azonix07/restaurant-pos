const AuditLog = require('../models/AuditLog');
const AlertLog = require('../models/AlertLog');
const BillSequence = require('../models/BillSequence');
const Order = require('../models/Order');
const KOT = require('../models/KOT');

// Get fraud alerts / anomalies
exports.getAlerts = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today.getTime() + 86400000);

    const alerts = [];

    // 1. Bill number gaps
    const dateStr = today.toISOString().split('T')[0];
    const gaps = await BillSequence.detectGaps('BILL', dateStr);
    if (gaps.length > 0) {
      alerts.push({
        type: 'bill_gap',
        severity: 'critical',
        message: `Bill number gaps detected: ${gaps.join(', ')}`,
        count: gaps.length,
      });
    }

    // 2. Order cancellations today
    const cancelled = await Order.countDocuments({
      status: 'cancelled',
      createdAt: { $gte: today, $lt: endOfDay },
    });
    if (cancelled > 5) {
      alerts.push({
        type: 'high_cancellations',
        severity: 'warning',
        message: `${cancelled} orders cancelled today (threshold: 5)`,
        count: cancelled,
      });
    }

    // 3. Excessive discounts
    const discountOrders = await Order.find({
      discount: { $gt: 0 },
      createdAt: { $gte: today, $lt: endOfDay },
      paymentStatus: 'paid',
    });
    const totalDiscount = discountOrders.reduce((s, o) => s + o.discount, 0);
    const totalSales = discountOrders.reduce((s, o) => s + o.subtotal, 0);
    const discountPercent = totalSales > 0 ? (totalDiscount / totalSales) * 100 : 0;
    if (discountPercent > 10) {
      alerts.push({
        type: 'high_discount',
        severity: 'warning',
        message: `Discount rate ${discountPercent.toFixed(1)}% exceeds 10% threshold. Total: ₹${totalDiscount.toFixed(2)}`,
        count: discountOrders.length,
      });
    }

    // 4. KOT vs Bill mismatches
    const completedOrders = await Order.find({
      status: 'completed',
      createdAt: { $gte: today, $lt: endOfDay },
    });
    let mismatchCount = 0;
    for (const order of completedOrders.slice(0, 50)) {
      const kots = await KOT.find({ order: order._id, status: { $ne: 'cancelled' } });
      const kotItemQty = {};
      kots.forEach(kot => kot.items.forEach(i => {
        if (i.status !== 'cancelled') {
          const key = i.menuItem.toString();
          kotItemQty[key] = (kotItemQty[key] || 0) + i.quantity;
        }
      }));
      const orderItemQty = {};
      order.items.forEach(i => {
        if (i.status !== 'cancelled') {
          const key = i.menuItem.toString();
          orderItemQty[key] = (orderItemQty[key] || 0) + i.quantity;
        }
      });
      const hasMismatch = Object.keys(orderItemQty).some(k => orderItemQty[k] !== (kotItemQty[k] || 0));
      if (hasMismatch) mismatchCount++;
    }
    if (mismatchCount > 0) {
      alerts.push({
        type: 'kot_mismatch',
        severity: 'critical',
        message: `${mismatchCount} orders have KOT vs billing mismatches`,
        count: mismatchCount,
      });
    }

    // 5. Suspicious audit trail activities
    const deletions = await AuditLog.countDocuments({
      action: 'delete',
      createdAt: { $gte: today, $lt: endOfDay },
    });
    if (deletions > 10) {
      alerts.push({
        type: 'high_deletions',
        severity: 'warning',
        message: `${deletions} delete operations today`,
        count: deletions,
      });
    }

    // 6. Price modifications
    const priceChanges = await AuditLog.countDocuments({
      action: 'update',
      module: 'menu',
      createdAt: { $gte: today, $lt: endOfDay },
    });
    if (priceChanges > 20) {
      alerts.push({
        type: 'frequent_price_changes',
        severity: 'info',
        message: `${priceChanges} menu modifications today`,
        count: priceChanges,
      });
    }

    res.json({
      alerts,
      totalAlerts: alerts.length,
      criticalCount: alerts.filter(a => a.severity === 'critical').length,
      warningCount: alerts.filter(a => a.severity === 'warning').length,
    });
  } catch (error) {
    next(error);
  }
};

// Get reconciliation report
exports.getReconciliation = async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate.getTime() + 86400000);
    const dateFilter = { createdAt: { $gte: targetDate, $lt: endDate } };

    const orders = await Order.find({ ...dateFilter, paymentStatus: 'paid' });
    const cancelledOrders = await Order.find({ ...dateFilter, status: 'cancelled' });

    // KOT totals
    const kots = await KOT.find(dateFilter);
    const kotItemCount = kots.reduce((s, k) => s + k.items.filter(i => i.status !== 'cancelled').length, 0);
    const orderItemCount = orders.reduce((s, o) => s + o.items.filter(i => i.status !== 'cancelled').length, 0);

    // Bill gaps
    const dateStr = targetDate.toISOString().split('T')[0];
    const gaps = await BillSequence.detectGaps('BILL', dateStr);

    res.json({
      date: dateStr,
      orders: {
        total: orders.length,
        cancelled: cancelledOrders.length,
        totalSales: orders.reduce((s, o) => s + o.total, 0),
        totalDiscount: orders.reduce((s, o) => s + o.discount, 0),
      },
      kot: {
        totalKOTs: kots.length,
        kotItemCount,
        orderItemCount,
        mismatch: kotItemCount !== orderItemCount,
      },
      billGaps: gaps,
      isClean: gaps.length === 0 && cancelledOrders.length <= 5,
    });
  } catch (error) {
    next(error);
  }
};
