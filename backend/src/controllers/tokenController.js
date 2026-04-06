const Token = require('../models/Token');
const AuditLog = require('../models/AuditLog');

// Generate a new token
exports.createToken = async (req, res, next) => {
  try {
    const { orderId, orderNumber, customerName, customerPhone, type, estimatedMinutes, counter } = req.body;
    const { number, date } = await Token.getNextToken();

    const token = await Token.create({
      tokenNumber: number,
      date,
      order: orderId || undefined,
      orderNumber,
      customerName,
      customerPhone,
      type: type || 'takeaway',
      estimatedMinutes: estimatedMinutes || 15,
      counter: counter || 'main',
      createdBy: req.user._id,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('token:new', { token });
      io.emit('display:update'); // trigger customer display refresh
    }

    res.status(201).json({ token });
  } catch (error) {
    next(error);
  }
};

// Update token status (preparing → ready → collected)
exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const token = await Token.findById(req.params.id);
    if (!token) return res.status(404).json({ message: 'Token not found' });

    token.status = status;
    if (status === 'ready') token.calledAt = new Date();
    if (status === 'collected') token.collectedAt = new Date();
    await token.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('token:update', { token });
      io.emit('display:update');
      // Sound alert for "ready" tokens
      if (status === 'ready') {
        io.emit('token:ready', { tokenNumber: token.tokenNumber, counter: token.counter });
      }
    }

    res.json({ token });
  } catch (error) {
    next(error);
  }
};

// Get today's tokens
exports.getTodayTokens = async (req, res, next) => {
  try {
    const { status } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const filter = { date: today };
    if (status) filter.status = status;

    const tokens = await Token.find(filter)
      .populate('order', 'orderNumber total items')
      .sort({ tokenNumber: 1 });

    const stats = {
      total: tokens.length,
      waiting: tokens.filter(t => t.status === 'waiting').length,
      preparing: tokens.filter(t => t.status === 'preparing').length,
      ready: tokens.filter(t => t.status === 'ready').length,
      collected: tokens.filter(t => t.status === 'collected').length,
    };

    res.json({ tokens, stats });
  } catch (error) {
    next(error);
  }
};

// Customer display — simplified view (no auth required)
exports.getDisplayBoard = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tokens = await Token.find({
      date: today,
      status: { $in: ['preparing', 'ready'] },
    }).sort({ tokenNumber: 1 });

    const preparing = tokens.filter(t => t.status === 'preparing').map(t => ({
      number: t.tokenNumber,
      counter: t.counter,
    }));
    const ready = tokens.filter(t => t.status === 'ready').map(t => ({
      number: t.tokenNumber,
      counter: t.counter,
      calledAt: t.calledAt,
    }));

    res.json({ preparing, ready });
  } catch (error) {
    next(error);
  }
};

// Call / announce a token (re-call ready token)
exports.callToken = async (req, res, next) => {
  try {
    const token = await Token.findById(req.params.id);
    if (!token) return res.status(404).json({ message: 'Token not found' });

    token.calledAt = new Date();
    if (token.status !== 'ready') token.status = 'ready';
    await token.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('token:ready', { tokenNumber: token.tokenNumber, counter: token.counter });
      io.emit('display:update');
    }

    res.json({ token, message: `Token #${token.tokenNumber} called` });
  } catch (error) {
    next(error);
  }
};
