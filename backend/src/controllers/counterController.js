const CounterSession = require('../models/CounterSession');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const AuditLog = require('../models/AuditLog');
const { triggerAutoBackup } = require('./backupController');

// Open a new counter session (shift)
exports.openSession = async (req, res, next) => {
  try {
    const { openingCash } = req.body;
    if (openingCash === undefined || openingCash < 0) {
      return res.status(400).json({ message: 'Opening cash amount is required' });
    }

    const today = new Date().toISOString().split('T')[0];

    // Check if there's already an open session
    const existing = await CounterSession.findOne({ status: 'open' });
    if (existing) {
      return res.status(400).json({ message: 'A counter session is already open. Close it first.' });
    }

    // Determine shift number for today
    const todaySessions = await CounterSession.countDocuments({ sessionDate: today });

    const session = await CounterSession.create({
      sessionDate: today,
      shiftNumber: todaySessions + 1,
      openedBy: req.user._id,
      openingCash,
      financialYear: CounterSession.getFinancialYear(new Date()),
    });

    await AuditLog.create({
      action: 'open',
      module: 'counter_session',
      documentId: session._id,
      description: `Counter opened with ₹${openingCash} cash`,
      user: req.user._id,
      userName: req.user.name,
    });

    const populated = await CounterSession.findById(session._id)
      .populate('openedBy', 'name');

    const io = req.app.get('io');
    if (io) io.emit('counter:open', populated);

    res.status(201).json({ session: populated });
  } catch (error) {
    next(error);
  }
};

// Get current open session
exports.getCurrentSession = async (req, res, next) => {
  try {
    const session = await CounterSession.findOne({ status: 'open' })
      .populate('openedBy', 'name');

    if (!session) {
      return res.json({ session: null, message: 'No open counter session' });
    }

    // Calculate live totals from orders during this session
    const dateFilter = { createdAt: { $gte: session.openedAt } };
    const orders = await Order.find({ ...dateFilter, paymentStatus: 'paid' });
    const expenses = await Expense.find({ date: { $gte: session.openedAt } });

    let systemCash = 0, systemCard = 0, systemUPI = 0, totalDiscounts = 0, gstCollected = 0;
    orders.forEach(o => {
      if (o.paymentMethod === 'cash') systemCash += o.total;
      else if (o.paymentMethod === 'card') systemCard += o.total;
      else if (o.paymentMethod === 'upi') systemUPI += o.total;
      totalDiscounts += o.discount || 0;
      gstCollected += o.gstAmount || 0;
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Update session with live data
    session.systemCash = systemCash;
    session.systemCard = systemCard;
    session.systemUPI = systemUPI;
    session.systemTotal = systemCash + systemCard + systemUPI;
    session.totalOrders = orders.length;
    session.totalDiscounts = totalDiscounts;
    session.totalExpenses = totalExpenses;
    session.gstCollected = gstCollected;

    res.json({ session });
  } catch (error) {
    next(error);
  }
};

// Close counter session
exports.closeSession = async (req, res, next) => {
  try {
    const { declaredCash, declaredCard, declaredUPI, varianceNote, denomination } = req.body;

    const session = await CounterSession.findOne({ status: 'open' });
    if (!session) {
      return res.status(400).json({ message: 'No open counter session to close' });
    }

    // Calculate system totals for the session period
    const dateFilter = { createdAt: { $gte: session.openedAt } };
    const orders = await Order.find({ ...dateFilter, paymentStatus: 'paid' });
    const expenses = await Expense.find({ date: { $gte: session.openedAt } });

    let systemCash = 0, systemCard = 0, systemUPI = 0, totalDiscounts = 0, gstCollected = 0, totalRefunds = 0;
    orders.forEach(o => {
      if (o.paymentMethod === 'cash') systemCash += o.total;
      else if (o.paymentMethod === 'card') systemCard += o.total;
      else if (o.paymentMethod === 'upi') systemUPI += o.total;
      totalDiscounts += o.discount || 0;
      gstCollected += o.gstAmount || 0;
      if (o.paymentStatus === 'refunded') totalRefunds += o.total;
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const expectedCash = session.openingCash + systemCash - totalExpenses;

    // Calculate declared cash from denomination if provided
    let finalDeclaredCash = declaredCash;
    if (denomination) {
      const denomTotal =
        (denomination.notes2000 || 0) * 2000 +
        (denomination.notes500 || 0) * 500 +
        (denomination.notes200 || 0) * 200 +
        (denomination.notes100 || 0) * 100 +
        (denomination.notes50 || 0) * 50 +
        (denomination.notes20 || 0) * 20 +
        (denomination.notes10 || 0) * 10 +
        (denomination.coins || 0);
      finalDeclaredCash = denomTotal;
      session.closingDenomination = denomination;
    }

    const cashVariance = (finalDeclaredCash || 0) - expectedCash;

    session.systemCash = systemCash;
    session.systemCard = systemCard;
    session.systemUPI = systemUPI;
    session.systemTotal = systemCash + systemCard + systemUPI;
    session.totalOrders = orders.length;
    session.totalDiscounts = totalDiscounts;
    session.totalExpenses = totalExpenses;
    session.totalRefunds = totalRefunds;
    session.gstCollected = gstCollected;
    session.declaredCash = finalDeclaredCash;
    session.declaredCard = declaredCard;
    session.declaredUPI = declaredUPI;
    session.cashVariance = cashVariance;
    session.varianceNote = varianceNote;
    session.closedBy = req.user._id;
    session.closedAt = new Date();
    session.status = 'closed';
    await session.save();

    await AuditLog.create({
      action: 'close',
      module: 'counter_session',
      documentId: session._id,
      description: `Counter closed. Cash variance: ₹${cashVariance.toFixed(2)}`,
      user: req.user._id,
      userName: req.user.name,
    });

    const populated = await CounterSession.findById(session._id)
      .populate('openedBy', 'name')
      .populate('closedBy', 'name');

    const io = req.app.get('io');
    if (io) io.emit('counter:close', populated);

    // Auto-backup on counter close
    triggerAutoBackup().catch(() => {});

    res.json({ session: populated });
  } catch (error) {
    next(error);
  }
};

// Get session history
exports.getSessionHistory = async (req, res, next) => {
  try {
    const { startDate, endDate, financialYear } = req.query;
    const filter = {};

    if (financialYear) {
      filter.financialYear = financialYear;
    } else if (startDate && endDate) {
      filter.sessionDate = { $gte: startDate, $lte: endDate };
    }

    const sessions = await CounterSession.find(filter)
      .populate('openedBy', 'name')
      .populate('closedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
};

// Financial year summary
exports.getFinancialYearSummary = async (req, res, next) => {
  try {
    const fy = req.query.fy || CounterSession.getFinancialYear(new Date());

    const sessions = await CounterSession.find({
      financialYear: fy,
      status: { $in: ['closed', 'verified'] },
    });

    const summary = {
      financialYear: fy,
      totalSessions: sessions.length,
      totalSales: sessions.reduce((s, sess) => s + sess.systemTotal, 0),
      totalCash: sessions.reduce((s, sess) => s + sess.systemCash, 0),
      totalCard: sessions.reduce((s, sess) => s + sess.systemCard, 0),
      totalUPI: sessions.reduce((s, sess) => s + sess.systemUPI, 0),
      totalExpenses: sessions.reduce((s, sess) => s + sess.totalExpenses, 0),
      totalGST: sessions.reduce((s, sess) => s + sess.gstCollected, 0),
      totalVariance: sessions.reduce((s, sess) => s + sess.cashVariance, 0),
      totalOrders: sessions.reduce((s, sess) => s + sess.totalOrders, 0),
    };
    summary.netProfit = summary.totalSales - summary.totalExpenses;

    res.json(summary);
  } catch (error) {
    next(error);
  }
};

// Verify a closed session (admin/manager sign-off)
exports.verifySession = async (req, res, next) => {
  try {
    const session = await CounterSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.status !== 'closed') {
      return res.status(400).json({ message: 'Only closed sessions can be verified' });
    }

    session.status = 'verified';
    session.verifiedBy = req.user._id;
    session.verifiedAt = new Date();
    await session.save();

    await AuditLog.create({
      action: 'verify',
      module: 'counter_session',
      documentId: session._id,
      description: 'Counter session verified',
      user: req.user._id,
      userName: req.user.name,
    });

    res.json({ session });
  } catch (error) {
    next(error);
  }
};

// Get denomination report for a session
exports.getDenominationReport = async (req, res, next) => {
  try {
    const session = await CounterSession.findById(req.params.id)
      .populate('openedBy', 'name')
      .populate('closedBy', 'name');
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const denom = session.closingDenomination || {};
    const denomBreakdown = [
      { note: '₹2000', count: denom.notes2000 || 0, value: (denom.notes2000 || 0) * 2000 },
      { note: '₹500', count: denom.notes500 || 0, value: (denom.notes500 || 0) * 500 },
      { note: '₹200', count: denom.notes200 || 0, value: (denom.notes200 || 0) * 200 },
      { note: '₹100', count: denom.notes100 || 0, value: (denom.notes100 || 0) * 100 },
      { note: '₹50', count: denom.notes50 || 0, value: (denom.notes50 || 0) * 50 },
      { note: '₹20', count: denom.notes20 || 0, value: (denom.notes20 || 0) * 20 },
      { note: '₹10', count: denom.notes10 || 0, value: (denom.notes10 || 0) * 10 },
      { note: 'Coins', count: 1, value: denom.coins || 0 },
    ];
    const denomTotal = denomBreakdown.reduce((s, d) => s + d.value, 0);

    res.json({
      sessionDate: session.sessionDate,
      shiftNumber: session.shiftNumber,
      openingCash: session.openingCash,
      declaredCash: session.declaredCash,
      systemCash: session.systemCash,
      cashVariance: session.cashVariance,
      denomBreakdown,
      denomTotal,
    });
  } catch (error) {
    next(error);
  }
};
