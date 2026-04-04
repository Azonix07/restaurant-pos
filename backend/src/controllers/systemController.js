const { createBackup, restoreBackup } = require('../utils/backup');
const nodemailer = require('nodemailer');
const config = require('../config');
const Order = require('../models/Order');
const Expense = require('../models/Expense');
const models = require('../models');

exports.createBackup = async (req, res, next) => {
  try {
    const backupPath = await createBackup();
    res.json({ message: 'Backup created', path: backupPath });
  } catch (error) {
    next(error);
  }
};

exports.restoreBackup = async (req, res, next) => {
  try {
    const { path } = req.body;
    if (!path) return res.status(400).json({ message: 'Backup path required' });
    await restoreBackup(path);
    res.json({ message: 'Database restored successfully' });
  } catch (error) {
    next(error);
  }
};

exports.sendDailyReport = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);
    const dateFilter = { createdAt: { $gte: today, $lt: tomorrow } };

    const orders = await Order.find({ ...dateFilter, paymentStatus: 'paid' });
    const expenses = await Expense.find({ date: { $gte: today, $lt: tomorrow } });

    const totalSales = orders.reduce((s, o) => s + o.total, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalOrders = orders.length;

    const reportHtml = `
      <h2>Daily Report - ${today.toDateString()}</h2>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><td><strong>Total Orders</strong></td><td>${totalOrders}</td></tr>
        <tr><td><strong>Total Sales</strong></td><td>₹${totalSales.toFixed(2)}</td></tr>
        <tr><td><strong>Total Expenses</strong></td><td>₹${totalExpenses.toFixed(2)}</td></tr>
        <tr><td><strong>Net Profit</strong></td><td>₹${(totalSales - totalExpenses).toFixed(2)}</td></tr>
      </table>
    `;

    if (!config.smtp.user || !config.notificationEmail) {
      return res.json({
        message: 'Email not configured. Report generated.',
        report: { totalOrders, totalSales, totalExpenses, profit: totalSales - totalExpenses },
      });
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: false,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });

    await transporter.sendMail({
      from: config.smtp.user,
      to: config.notificationEmail,
      subject: `Restaurant POS Daily Report - ${today.toDateString()}`,
      html: reportHtml,
    });

    res.json({ message: 'Daily report sent successfully' });
  } catch (error) {
    next(error);
  }
};

// ─── Data Export (JSON) ──────────────────────────────────
// Exports ALL collections as a single JSON file for migration / backup
exports.exportData = async (req, res, next) => {
  try {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      collections: {},
    };

    // Export every registered model
    for (const [name, Model] of Object.entries(models)) {
      try {
        const docs = await Model.find({}).lean();
        exportPayload.collections[name] = docs;
      } catch (_) {
        // Some models might fail if the collection doesn't exist yet
        exportPayload.collections[name] = [];
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="pos-data-${Date.now()}.json"`);
    res.json(exportPayload);
  } catch (error) {
    next(error);
  }
};

// ─── Data Import (JSON) ──────────────────────────────────
// Imports a previously exported JSON file — merges by _id (upsert)
exports.importData = async (req, res, next) => {
  try {
    const data = req.body;
    if (!data || !data.collections) {
      return res.status(400).json({ message: 'Invalid import file. Expected { collections: { ... } }' });
    }

    const results = {};
    for (const [name, docs] of Object.entries(data.collections)) {
      const Model = models[name];
      if (!Model || !Array.isArray(docs)) continue;

      let upserted = 0;
      for (const doc of docs) {
        try {
          await Model.updateOne(
            { _id: doc._id },
            { $set: doc },
            { upsert: true, setDefaultsOnInsert: true }
          );
          upserted++;
        } catch (_) { /* skip invalid docs */ }
      }
      results[name] = upserted;
    }

    res.json({ message: 'Data imported successfully', results });
  } catch (error) {
    next(error);
  }
};
