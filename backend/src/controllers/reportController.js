const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');

exports.getDailySummary = async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate.getTime() + 86400000);

    const dateFilter = { createdAt: { $gte: targetDate, $lt: endDate } };

    const orders = await Order.find({ ...dateFilter, paymentStatus: 'paid' });
    const expenses = await Expense.find({ date: { $gte: targetDate, $lt: endDate } });

    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const totalGST = orders.reduce((sum, o) => sum + o.gstAmount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalOrders = orders.length;

    const paymentBreakdown = { cash: 0, card: 0, upi: 0, split: 0 };
    orders.forEach(o => {
      if (paymentBreakdown[o.paymentMethod] !== undefined) {
        paymentBreakdown[o.paymentMethod] += o.total;
      }
    });

    const orderTypeBreakdown = { dine_in: 0, takeaway: 0, delivery: 0, external: 0 };
    orders.forEach(o => {
      if (orderTypeBreakdown[o.type] !== undefined) {
        orderTypeBreakdown[o.type]++;
      }
    });

    res.json({
      date: targetDate.toISOString().split('T')[0],
      totalSales,
      totalGST,
      totalExpenses,
      profit: totalSales - totalExpenses,
      totalOrders,
      paymentBreakdown,
      orderTypeBreakdown,
    });
  } catch (error) {
    next(error);
  }
};

exports.getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const pipeline = [
      { $match: { createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalSales: { $sum: '$total' },
          totalGST: { $sum: '$gstAmount' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const report = await Order.aggregate(pipeline);
    res.json({ report, startDate: start, endDate: end });
  } catch (error) {
    next(error);
  }
};

exports.getItemWiseSales = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const pipeline = [
      { $match: { createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$items.name',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ];

    const report = await Order.aggregate(pipeline);
    res.json({ report });
  } catch (error) {
    next(error);
  }
};

exports.getTaxReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const pipeline = [
      { $match: { createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$items.gstRate',
          taxableAmount: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          gstCollected: {
            $sum: {
              $multiply: [
                { $multiply: ['$items.price', '$items.quantity'] },
                { $divide: ['$items.gstRate', 100] },
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const report = await Order.aggregate(pipeline);
    const totalTaxable = report.reduce((s, r) => s + r.taxableAmount, 0);
    const totalGST = report.reduce((s, r) => s + r.gstCollected, 0);

    res.json({ report, totalTaxable, totalGST });
  } catch (error) {
    next(error);
  }
};

exports.getProfitLoss = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end },
      paymentStatus: 'paid',
    });

    const expenses = await Expense.find({
      date: { $gte: start, $lte: end },
    });

    const totalRevenue = orders.reduce((s, o) => s + o.subtotal, 0);
    const totalGST = orders.reduce((s, o) => s + o.gstAmount, 0);
    const totalDiscounts = orders.reduce((s, o) => s + o.discount, 0);

    const expenseByCategory = {};
    let totalExpenses = 0;
    expenses.forEach(e => {
      expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
      totalExpenses += e.amount;
    });

    res.json({
      totalRevenue,
      totalGST,
      totalDiscounts,
      totalExpenses,
      expenseByCategory,
      netProfit: totalRevenue - totalExpenses,
    });
  } catch (error) {
    next(error);
  }
};
