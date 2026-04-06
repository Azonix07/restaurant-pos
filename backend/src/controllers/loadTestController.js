const Order = require('../models/Order');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const KOT = require('../models/KOT');
const Transaction = require('../models/Transaction');
const { generateOrderNumber } = require('../utils/orderNumber');
const AuditLog = require('../models/AuditLog');

// Simulate rush hour: N orders in rapid succession
exports.simulateRushHour = async (req, res, next) => {
  try {
    const { orderCount = 50, delayMs = 200 } = req.body;

    if (orderCount > 200) {
      return res.status(400).json({ message: 'Max 200 orders per simulation' });
    }

    const menuItems = await MenuItem.find({ isAvailable: true }).limit(30).lean();
    if (menuItems.length === 0) {
      return res.status(400).json({ message: 'No menu items available for simulation' });
    }

    const tables = await Table.find({ status: 'available' }).lean();
    const results = { created: 0, failed: 0, errors: [], startTime: Date.now() };

    for (let i = 0; i < orderCount; i++) {
      try {
        const itemCount = Math.floor(Math.random() * 5) + 1;
        const orderItems = [];

        for (let j = 0; j < itemCount; j++) {
          const item = menuItems[Math.floor(Math.random() * menuItems.length)];
          orderItems.push({
            menuItem: item._id,
            name: item.name,
            quantity: Math.floor(Math.random() * 3) + 1,
            price: item.price,
            gstRate: 5,
            status: 'placed',
          });
        }

        const orderNumber = await generateOrderNumber();
        const types = ['dine_in', 'takeaway', 'delivery'];
        const type = types[Math.floor(Math.random() * types.length)];

        const table = type === 'dine_in' && tables.length > 0
          ? tables[Math.floor(Math.random() * tables.length)]
          : null;

        const order = new Order({
          orderNumber,
          type,
          table: table?._id,
          tableNumber: table?.number,
          items: orderItems,
          customerName: `Test Customer ${i + 1}`,
          isTestData: true,
          createdBy: req.user._id,
          waiter: req.user._id,
        });

        order.calculateTotals();
        await order.save();
        results.created++;

        // Small delay to simulate real traffic
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (err) {
        results.failed++;
        results.errors.push(err.message);
      }
    }

    results.endTime = Date.now();
    results.durationMs = results.endTime - results.startTime;
    results.ordersPerSecond = (results.created / (results.durationMs / 1000)).toFixed(1);

    await AuditLog.create({
      action: 'load_test',
      module: 'system',
      description: `Rush hour simulation: ${results.created}/${orderCount} orders in ${results.durationMs}ms (${results.ordersPerSecond} orders/sec)`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.json({
      message: `Simulation complete`,
      results,
    });
  } catch (error) {
    next(error);
  }
};

// Simulate network failure (disconnect all socket clients)
exports.simulateNetworkFailure = async (req, res, next) => {
  try {
    const { durationSec = 10 } = req.body;
    const io = req.app.get('io');

    if (!io) {
      return res.status(400).json({ message: 'Socket.IO not available' });
    }

    const sockets = await io.fetchSockets();
    const disconnectedCount = sockets.length;

    // Broadcast warning first
    io.emit('test:networkFailure', { duration: durationSec });

    // Disconnect all clients
    for (const s of sockets) {
      s.disconnect(true);
    }

    await AuditLog.create({
      action: 'load_test',
      module: 'system',
      description: `Network failure simulation: ${disconnectedCount} clients disconnected for ${durationSec}s`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.json({
      message: `Disconnected ${disconnectedCount} clients. They should auto-reconnect.`,
      disconnectedCount,
      durationSec,
    });
  } catch (error) {
    next(error);
  }
};

// Clean up test data
exports.cleanTestData = async (req, res, next) => {
  try {
    const orderResult = await Order.deleteMany({ isTestData: true });
    const kotResult = await KOT.deleteMany({
      order: { $in: (await Order.find({ isTestData: true }).select('_id')).map(o => o._id) },
    });

    await AuditLog.create({
      action: 'clean_test_data',
      module: 'system',
      description: `Cleaned ${orderResult.deletedCount} test orders`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.json({
      message: 'Test data cleaned',
      ordersDeleted: orderResult.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

// Get system performance stats
exports.getPerformanceStats = async (req, res, next) => {
  try {
    const os = require('os');
    const mongoose = require('mongoose');

    // DB stats
    const dbStats = await mongoose.connection.db.stats();

    // Today's order count + speed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const orderCount = await Order.countDocuments({ createdAt: { $gte: today } });

    // Average response time (from recent orders — time between creation and first status change)
    const recentOrders = await Order.find({ createdAt: { $gte: today } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const stats = {
      system: {
        uptime: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage(),
        cpuCount: os.cpus().length,
        loadAvg: os.loadavg(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        platform: os.platform(),
        hostname: os.hostname(),
      },
      database: {
        collections: dbStats.collections,
        documents: dbStats.objects,
        dataSize: `${(dbStats.dataSize / 1024 / 1024).toFixed(1)} MB`,
        indexSize: `${(dbStats.indexSize / 1024 / 1024).toFixed(1)} MB`,
      },
      today: {
        orderCount,
        avgOrdersPerHour: (orderCount / Math.max(1, new Date().getHours())).toFixed(1),
      },
    };

    res.json({ stats });
  } catch (error) {
    next(error);
  }
};
