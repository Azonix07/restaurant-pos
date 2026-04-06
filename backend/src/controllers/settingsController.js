const SystemSettings = require('../models/SystemSettings');
const AuditLog = require('../models/AuditLog');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const RawMaterial = require('../models/RawMaterial');

// ─── Get current settings ────────────────────────────
exports.getSettings = async (req, res, next) => {
  try {
    const settings = await SystemSettings.getInstance();
    res.json({ settings });
  } catch (error) { next(error); }
};

// ─── Toggle Rush Mode ────────────────────────────────
exports.toggleRushMode = async (req, res, next) => {
  try {
    const settings = await SystemSettings.getInstance();
    const wasEnabled = settings.rushMode.enabled;
    settings.rushMode.enabled = !wasEnabled;

    if (!wasEnabled) {
      settings.rushMode.enabledAt = new Date();
      settings.rushMode.enabledBy = req.user._id;
    } else {
      settings.rushMode.enabledAt = null;
      settings.rushMode.enabledBy = null;
    }

    await settings.save();

    await AuditLog.create({
      action: wasEnabled ? 'disable' : 'enable',
      module: 'rush_mode',
      description: `Rush Mode ${wasEnabled ? 'disabled' : 'enabled'} by ${req.user.name}`,
      user: req.user._id,
      userName: req.user.name,
    });

    // Broadcast to all clients
    const io = req.app.get('io');
    if (io) io.emit('settings:rushMode', { enabled: settings.rushMode.enabled });

    res.json({ settings, message: `Rush Mode ${settings.rushMode.enabled ? 'enabled' : 'disabled'}` });
  } catch (error) { next(error); }
};

// ─── Update Rush Mode options ────────────────────────
exports.updateRushConfig = async (req, res, next) => {
  try {
    const settings = await SystemSettings.getInstance();
    const allowed = [
      'autoKOT', 'autoAssignTables', 'disableImages', 'disableAnimations',
      'disableEditOldBills', 'disableComplexDiscounts', 'disableReports', 'skipKOTConfirmation',
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) settings.rushMode[key] = req.body[key];
    }
    await settings.save();
    res.json({ settings });
  } catch (error) { next(error); }
};

// ─── Toggle Test Mode (Admin only with PIN) ─────────
exports.toggleTestMode = async (req, res, next) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ message: 'PIN required' });

    // Verify admin PIN
    const User = require('../models/User');
    const admin = await User.findById(req.user._id);
    if (!admin || !admin.pin) return res.status(400).json({ message: 'Admin PIN not set' });

    const bcrypt = require('bcryptjs');
    const pinMatch = await bcrypt.compare(pin, admin.pin);
    if (!pinMatch) return res.status(403).json({ message: 'Invalid PIN' });

    const settings = await SystemSettings.getInstance();
    const wasEnabled = settings.testMode.enabled;
    settings.testMode.enabled = !wasEnabled;

    if (!wasEnabled) {
      settings.testMode.enabledAt = new Date();
      settings.testMode.enabledBy = req.user._id;
      // Auto-disable after 1 hour
      settings.testMode.autoDisableAt = new Date(Date.now() + 3600000);
    } else {
      settings.testMode.enabledAt = null;
      settings.testMode.enabledBy = null;
      settings.testMode.autoDisableAt = null;
    }

    await settings.save();

    await AuditLog.create({
      action: wasEnabled ? 'disable' : 'enable',
      module: 'test_mode',
      description: `Test Mode ${wasEnabled ? 'disabled' : 'enabled'} by ${req.user.name}`,
      user: req.user._id,
      userName: req.user.name,
    });

    const io = req.app.get('io');
    if (io) io.emit('settings:testMode', { enabled: settings.testMode.enabled });

    res.json({ settings, message: `Test Mode ${settings.testMode.enabled ? 'enabled — auto-disables in 1 hour' : 'disabled'}` });
  } catch (error) { next(error); }
};

// ─── Generate test data ─────────────────────────────
exports.generateTestData = async (req, res, next) => {
  try {
    const settings = await SystemSettings.getInstance();
    if (!settings.testMode.enabled) {
      return res.status(400).json({ message: 'Test Mode must be enabled first' });
    }

    const { count = 20 } = req.body;
    const menuItems = await MenuItem.find({ isAvailable: true }).limit(20);
    if (menuItems.length === 0) {
      return res.status(400).json({ message: 'No menu items available for test data' });
    }

    const fakeOrders = [];
    const names = ['Test Customer A', 'Test Customer B', 'Walk-in Test', 'Test VIP', 'Demo User'];
    const types = ['dine_in', 'takeaway', 'delivery'];
    const statuses = ['placed', 'preparing', 'ready', 'completed'];

    for (let i = 0; i < Math.min(count, 100); i++) {
      const numItems = Math.floor(Math.random() * 4) + 1;
      const orderItems = [];
      for (let j = 0; j < numItems; j++) {
        const item = menuItems[Math.floor(Math.random() * menuItems.length)];
        orderItems.push({
          menuItem: item._id,
          name: item.name,
          price: item.price,
          quantity: Math.floor(Math.random() * 3) + 1,
          gstRate: 5,
        });
      }

      const order = new Order({
        orderNumber: `TEST-${Date.now()}-${i}`,
        type: types[Math.floor(Math.random() * types.length)],
        items: orderItems,
        customerName: names[Math.floor(Math.random() * names.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        paymentStatus: Math.random() > 0.3 ? 'paid' : 'pending',
        paymentMethod: Math.random() > 0.5 ? 'cash' : 'upi',
        isTestData: true,
        createdBy: req.user._id,
      });
      order.calculateTotals();
      await order.save();
      fakeOrders.push(order);
    }

    res.json({ message: `Generated ${fakeOrders.length} test orders`, count: fakeOrders.length });
  } catch (error) { next(error); }
};

// ─── Clear test data ─────────────────────────────────
exports.clearTestData = async (req, res, next) => {
  try {
    const result = await Order.deleteMany({ isTestData: true });
    res.json({ message: `Cleared ${result.deletedCount} test orders` });
  } catch (error) { next(error); }
};

// ─── Update UI Mode ─────────────────────────────────
exports.updateUIMode = async (req, res, next) => {
  try {
    const { mode } = req.body;
    if (!['beginner', 'advanced'].includes(mode)) {
      return res.status(400).json({ message: 'Mode must be beginner or advanced' });
    }
    const settings = await SystemSettings.getInstance();
    settings.uiMode = mode;
    await settings.save();

    const io = req.app.get('io');
    if (io) io.emit('settings:uiMode', { mode });

    res.json({ settings, message: `UI mode set to ${mode}` });
  } catch (error) { next(error); }
};

// ─── Smart Dashboard Alerts ─────────────────────────
exports.getSmartAlerts = async (req, res, next) => {
  try {
    const settings = await SystemSettings.getInstance();
    const alerts = [];

    // 1. Low stock items
    if (settings.alerts.lowStockEnabled) {
      const lowStockItems = await MenuItem.find({
        isAvailable: true,
        lowStockThreshold: { $gt: 0 },
        $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      }).select('name stock lowStockThreshold').limit(10);

      if (lowStockItems.length > 0) {
        alerts.push({
          type: 'low_stock',
          severity: 'warning',
          title: `${lowStockItems.length} items low on stock`,
          items: lowStockItems.map(i => `${i.name} (${i.stock}/${i.lowStockThreshold})`),
        });
      }

      // Low stock raw materials
      const lowRaw = await RawMaterial.find({
        minStock: { $gt: 0 },
        $expr: { $lte: ['$currentStock', '$minStock'] },
      }).select('name currentStock minStock unit').limit(10);

      if (lowRaw.length > 0) {
        alerts.push({
          type: 'low_raw_material',
          severity: 'warning',
          title: `${lowRaw.length} raw materials below reorder level`,
          items: lowRaw.map(r => `${r.name}: ${r.currentStock}${r.unit} (min: ${r.minStock})`),
        });
      }
    }

    // 2. No sales alert
    const minutesAgo = new Date(Date.now() - settings.alerts.noSalesAlertMinutes * 60000);
    const recentOrderCount = await Order.countDocuments({
      createdAt: { $gte: minutesAgo },
      isTestData: { $ne: true },
    });
    if (recentOrderCount === 0) {
      alerts.push({
        type: 'no_sales',
        severity: 'info',
        title: `No orders in the last ${settings.alerts.noSalesAlertMinutes} minutes`,
        items: [],
      });
    }

    // 3. Top selling item today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const topItems = await Order.aggregate([
      { $match: { createdAt: { $gte: today }, paymentStatus: 'paid', isTestData: { $ne: true } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
      { $sort: { qty: -1 } },
      { $limit: 3 },
    ]);

    if (topItems.length > 0) {
      alerts.push({
        type: 'top_selling',
        severity: 'success',
        title: `Top item today: ${topItems[0]._id} (${topItems[0].qty} sold)`,
        items: topItems.map(i => `${i._id}: ${i.qty} units — ₹${i.revenue.toFixed(0)}`),
      });
    }

    // 4. Dead stock (items not sold in N days)
    const deadStockDate = new Date(Date.now() - settings.alerts.deadStockDays * 86400000);
    const soldItemIds = await Order.distinct('items.menuItem', {
      createdAt: { $gte: deadStockDate },
      paymentStatus: 'paid',
    });
    const deadItems = await MenuItem.find({
      isAvailable: true,
      _id: { $nin: soldItemIds },
    }).select('name category price').limit(10);

    if (deadItems.length > 0) {
      alerts.push({
        type: 'dead_stock',
        severity: 'warning',
        title: `${deadItems.length} items not sold in ${settings.alerts.deadStockDays} days`,
        items: deadItems.map(i => `${i.name} (${i.category}) — ₹${i.price}`),
      });
    }

    res.json({ alerts, generated: new Date() });
  } catch (error) { next(error); }
};

// ─── Update alert config ────────────────────────────
exports.updateAlertConfig = async (req, res, next) => {
  try {
    const settings = await SystemSettings.getInstance();
    const allowed = ['lowStockEnabled', 'noSalesAlertMinutes', 'highDiscountThreshold', 'deadStockDays'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) settings.alerts[key] = req.body[key];
    }
    await settings.save();
    res.json({ settings });
  } catch (error) { next(error); }
};
