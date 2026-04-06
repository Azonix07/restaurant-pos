const Refund = require('../models/Refund');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const BillSequence = require('../models/BillSequence');

// Request a refund (cashier/manager can request, manager/admin must approve)
exports.requestRefund = async (req, res, next) => {
  try {
    const { orderId, type, items, reason, refundMethod } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'Can only refund paid orders' });
    }

    // Check for existing pending/completed refund
    const existingRefund = await Refund.findOne({
      order: orderId,
      status: { $in: ['pending', 'completed'] },
      type: 'full',
    });
    if (existingRefund && type === 'full') {
      return res.status(400).json({ message: 'A full refund already exists for this order' });
    }

    let refundAmount = order.total;
    let refundItems = [];

    if (type === 'partial') {
      if (!items || items.length === 0) {
        return res.status(400).json({ message: 'Items required for partial refund' });
      }
      refundItems = items.map(item => ({
        menuItem: item.menuItem,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        refundAmount: item.price * item.quantity,
      }));
      refundAmount = refundItems.reduce((sum, item) => sum + item.refundAmount, 0);
    }

    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ message: 'Reason is required (min 3 characters)' });
    }

    const refundNum = await BillSequence.getNextNumber('RFD');
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const refund = await Refund.create({
      refundNumber: `RFD-${dateStr}-${String(refundNum).padStart(4, '0')}`,
      order: order._id,
      orderNumber: order.orderNumber,
      billNumber: order.billNumber,
      type,
      items: refundItems,
      originalAmount: order.total,
      refundAmount,
      reason: reason.trim(),
      status: 'pending',
      requestedBy: req.user._id,
      requestedByName: req.user.name,
      refundMethod: refundMethod || 'original',
    });

    await AuditLog.create({
      action: 'refund_request',
      module: 'refund',
      documentId: refund._id,
      documentNumber: refund.refundNumber,
      description: `${type} refund ₹${refundAmount} requested for ${order.billNumber}. Reason: ${reason}`,
      user: req.user._id,
      userName: req.user.name,
    });

    const io = req.app.get('io');
    if (io) io.emit('refund:new', { refund });

    res.status(201).json({ refund, message: 'Refund request created. Awaiting approval.' });
  } catch (error) {
    next(error);
  }
};

// Approve refund (manager/admin with PIN)
exports.approveRefund = async (req, res, next) => {
  try {
    const { pin } = req.body;
    const refund = await Refund.findById(req.params.id);
    if (!refund) return res.status(404).json({ message: 'Refund not found' });
    if (refund.status !== 'pending') {
      return res.status(400).json({ message: `Refund is already ${refund.status}` });
    }

    // Verify manager/admin PIN
    if (pin) {
      const user = await User.findById(req.user._id).select('+pin');
      if (!user.pin) return res.status(400).json({ message: 'No PIN set for your account' });
      const pinValid = await user.comparePin(pin);
      if (!pinValid) return res.status(403).json({ message: 'Invalid PIN' });
      refund.approvalPin = true;
    }

    refund.status = 'completed';
    refund.approvedBy = req.user._id;
    refund.approvedByName = req.user.name;
    refund.processedAt = new Date();
    await refund.save();

    // Update order payment status
    const order = await Order.findById(refund.order);
    if (order) {
      if (refund.type === 'full') {
        order.paymentStatus = 'refunded';
      }
      await order.save();
    }

    // Create refund transaction
    await Transaction.create({
      order: refund.order,
      orderNumber: refund.orderNumber,
      amount: -refund.refundAmount,
      paymentMethod: refund.refundMethod === 'original' ? (order?.paymentMethod || 'cash') : refund.refundMethod,
      processedBy: req.user._id,
      status: 'refunded',
    });

    await AuditLog.create({
      action: 'refund_approved',
      module: 'refund',
      documentId: refund._id,
      documentNumber: refund.refundNumber,
      description: `Refund ₹${refund.refundAmount} approved by ${req.user.name}${pin ? ' (PIN verified)' : ''}`,
      user: req.user._id,
      userName: req.user.name,
    });

    const io = req.app.get('io');
    if (io) io.emit('refund:approved', { refund });

    res.json({ refund, message: 'Refund approved and processed' });
  } catch (error) {
    next(error);
  }
};

// Reject refund
exports.rejectRefund = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const refund = await Refund.findById(req.params.id);
    if (!refund) return res.status(404).json({ message: 'Refund not found' });
    if (refund.status !== 'pending') {
      return res.status(400).json({ message: `Refund is already ${refund.status}` });
    }

    refund.status = 'rejected';
    refund.rejectionReason = reason || 'No reason provided';
    refund.approvedBy = req.user._id;
    refund.approvedByName = req.user.name;
    await refund.save();

    await AuditLog.create({
      action: 'refund_rejected',
      module: 'refund',
      documentId: refund._id,
      documentNumber: refund.refundNumber,
      description: `Refund rejected by ${req.user.name}. Reason: ${reason || 'None'}`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.json({ refund, message: 'Refund rejected' });
  } catch (error) {
    next(error);
  }
};

// List refunds
exports.getRefunds = async (req, res, next) => {
  try {
    const { status, date, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      filter.createdAt = { $gte: start, $lt: new Date(start.getTime() + 86400000) };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const refunds = await Refund.find(filter)
      .populate('order', 'orderNumber billNumber total')
      .populate('requestedBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Refund.countDocuments(filter);
    const summary = await Refund.aggregate([
      { $match: { ...filter, status: 'completed' } },
      { $group: { _id: null, totalRefunded: { $sum: '$refundAmount' }, count: { $sum: 1 } } },
    ]);

    res.json({
      refunds,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / limit),
      summary: summary[0] || { totalRefunded: 0, count: 0 },
    });
  } catch (error) {
    next(error);
  }
};
