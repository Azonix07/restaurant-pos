const AuditLog = require('../models/AuditLog');

exports.getAll = async (req, res, next) => {
  try {
    const { module, action, userId, startDate, endDate, page = 1, limit = 100 } = req.query;
    const filter = {};
    if (module) filter.module = module;
    if (action) filter.action = action;
    if (userId) filter.user = userId;
    if (startDate && endDate) {
      const start = new Date(startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(endDate); end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const logs = await AuditLog.find(filter)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));
    const total = await AuditLog.countDocuments(filter);
    res.json({ logs, total, page: parseInt(page, 10), pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
};

// Share audit trail with CA (export)
exports.exportForCA = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);

    const logs = await AuditLog.find({ createdAt: { $gte: start, $lte: end } })
      .populate('user', 'name email')
      .sort({ createdAt: 1 });

    const csvRows = ['Date,Time,User,Module,Action,Description'];
    for (const log of logs) {
      const d = new Date(log.createdAt);
      csvRows.push(`${d.toLocaleDateString('en-IN')},${d.toLocaleTimeString('en-IN')},${log.userName || ''},${log.module},${log.action},"${(log.description || '').replace(/"/g, '""')}"`);
    }

    res.json({ csv: csvRows.join('\n'), totalEntries: logs.length });
  } catch (error) { next(error); }
};
