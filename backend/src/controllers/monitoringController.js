const AlertLog = require('../models/AlertLog');
const Device = require('../models/Device');
const Order = require('../models/Order');
const KOT = require('../models/KOT');
const BillSequence = require('../models/BillSequence');

// Get all alerts
exports.getAlerts = async (req, res, next) => {
  try {
    const { type, severity, resolved, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (severity) filter.severity = severity;
    if (resolved !== undefined) filter.isResolved = resolved === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const alerts = await AlertLog.find(filter)
      .populate('device', 'name type')
      .populate('user', 'name')
      .populate('resolvedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AlertLog.countDocuments(filter);
    const unresolved = await AlertLog.countDocuments({ isResolved: false });
    const critical = await AlertLog.countDocuments({ isResolved: false, severity: 'critical' });

    res.json({ alerts, total, unresolved, critical, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

// Resolve an alert
exports.resolveAlert = async (req, res, next) => {
  try {
    const { resolution } = req.body;
    const alert = await AlertLog.findById(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });

    alert.isResolved = true;
    alert.resolvedBy = req.user._id;
    alert.resolvedAt = new Date();
    alert.resolution = resolution || 'Resolved';
    await alert.save();

    res.json({ alert });
  } catch (error) {
    next(error);
  }
};

// Get monitoring dashboard data
exports.getDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Device status
    const devices = await Device.find({ isApproved: true });
    const staleThreshold = 15000;
    const deviceStatus = devices.map(d => ({
      _id: d._id,
      name: d.name,
      type: d.type,
      isMaster: d.isMaster,
      status: d.isLocked ? 'locked' :
        (d.lastHeartbeat && (now - d.lastHeartbeat.getTime() < staleThreshold)) ? 'online' : 'offline',
      lastHeartbeat: d.lastHeartbeat,
      kitchenSection: d.kitchenSection,
    }));

    // Active alerts
    const activeAlerts = await AlertLog.find({ isResolved: false })
      .sort({ severity: -1, createdAt: -1 })
      .limit(20);

    // Today's stats
    const todayOrders = await Order.countDocuments({ createdAt: { $gte: todayStart } });
    const todaySales = await Order.aggregate([
      { $match: { createdAt: { $gte: todayStart }, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);

    // KOT stats
    const pendingKOTs = await KOT.countDocuments({
      status: { $in: ['pending', 'acknowledged', 'preparing'] },
    });

    // Bill gap detection
    const today = now.toISOString().split('T')[0];
    const billGaps = await BillSequence.detectGaps('BILL', today);

    // No-sales detection (if no orders in last 2 hours during business hours 9-22)
    const twoHoursAgo = new Date(now - 2 * 3600000);
    const hour = now.getHours();
    let noSalesAlert = false;
    if (hour >= 9 && hour <= 22) {
      const recentOrders = await Order.countDocuments({ createdAt: { $gte: twoHoursAgo } });
      noSalesAlert = recentOrders === 0;
    }

    res.json({
      devices: deviceStatus,
      summary: {
        devicesOnline: deviceStatus.filter(d => d.status === 'online').length,
        devicesOffline: deviceStatus.filter(d => d.status === 'offline').length,
        devicesLocked: deviceStatus.filter(d => d.status === 'locked').length,
        todayOrders,
        todaySales: todaySales[0]?.total || 0,
        pendingKOTs,
        billGaps: billGaps.length,
        noSalesAlert,
      },
      activeAlerts,
    });
  } catch (error) {
    next(error);
  }
};

// Bill gap detection endpoint
exports.detectBillGaps = async (req, res, next) => {
  try {
    const { date, prefix } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const gaps = await BillSequence.detectGaps(prefix || 'BILL', targetDate);

    if (gaps.length > 0) {
      await AlertLog.create({
        type: 'bill_mismatch',
        severity: 'critical',
        title: `Bill number gaps detected`,
        message: `Missing bill numbers on ${targetDate}: ${gaps.join(', ')}`,
        metadata: { date: targetDate, gaps, prefix: prefix || 'BILL' },
      });
    }

    res.json({ date: targetDate, prefix: prefix || 'BILL', gaps, hasGaps: gaps.length > 0 });
  } catch (error) {
    next(error);
  }
};
