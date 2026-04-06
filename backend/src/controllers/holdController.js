const HeldOrder = require('../models/HeldOrder');
const Order = require('../models/Order');
const Table = require('../models/Table');
const AuditLog = require('../models/AuditLog');
const BillSequence = require('../models/BillSequence');
const { generateOrderNumber } = require('../utils/orderNumber');

// Hold current bill
exports.holdOrder = async (req, res, next) => {
  try {
    const { items, tableId, tableNumber, type, customerName, customerPhone, customerId, discount, notes, holdReason } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items to hold' });
    }

    const holdNum = await BillSequence.getNextNumber('HOLD');
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const held = await HeldOrder.create({
      holdNumber: `HOLD-${dateStr}-${String(holdNum).padStart(4, '0')}`,
      items,
      table: tableId || undefined,
      tableNumber,
      type: type || 'dine_in',
      customerName,
      customerPhone,
      customer: customerId || undefined,
      subtotal,
      discount: discount || 0,
      notes,
      holdReason: holdReason || '',
      heldBy: req.user._id,
      heldByName: req.user.name,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
    });

    // Free the table if it was occupied
    if (tableId) {
      await Table.findByIdAndUpdate(tableId, { status: 'available', currentOrder: null });
      const io = req.app.get('io');
      if (io) {
        const table = await Table.findById(tableId);
        io.emit('table:update', table);
      }
    }

    await AuditLog.create({
      action: 'hold',
      module: 'order',
      documentId: held._id,
      documentNumber: held.holdNumber,
      description: `Bill held: ${held.holdNumber} (${items.length} items, ₹${subtotal})${holdReason ? ` Reason: ${holdReason}` : ''}`,
      user: req.user._id,
      userName: req.user.name,
    });

    const io = req.app.get('io');
    if (io) io.emit('hold:new', { held });

    res.status(201).json({ held, message: 'Bill held successfully' });
  } catch (error) {
    next(error);
  }
};

// Resume held bill → creates a new order from it
exports.resumeOrder = async (req, res, next) => {
  try {
    const held = await HeldOrder.findById(req.params.id);
    if (!held) return res.status(404).json({ message: 'Held order not found' });
    if (held.status !== 'held') {
      return res.status(400).json({ message: `Order already ${held.status}` });
    }

    const { tableId } = req.body;
    const orderNumber = await generateOrderNumber();

    // Create new order from held items
    const order = new Order({
      orderNumber,
      table: tableId || held.table || undefined,
      tableNumber: held.tableNumber,
      type: held.type,
      items: held.items,
      customerName: held.customerName,
      customerPhone: held.customerPhone,
      customer: held.customer || undefined,
      discount: held.discount,
      notes: held.notes,
      createdBy: req.user._id,
      waiter: req.user._id,
    });
    order.calculateTotals();
    await order.save();

    // Occupy the table
    if (tableId || held.table) {
      const tid = tableId || held.table;
      await Table.findByIdAndUpdate(tid, { status: 'occupied', currentOrder: order._id });
    }

    // Mark held order as resumed
    held.status = 'resumed';
    held.resumedAt = new Date();
    held.resumedOrder = order._id;
    await held.save();

    const populated = await Order.findById(order._id).populate('table').populate('waiter', 'name');
    const io = req.app.get('io');
    if (io) {
      io.emit('order:new', populated);
      io.emit('hold:resumed', { holdId: held._id, order: populated });
    }

    res.json({ order: populated, message: 'Order resumed from held bill' });
  } catch (error) {
    next(error);
  }
};

// Cancel held bill
exports.cancelHeld = async (req, res, next) => {
  try {
    const held = await HeldOrder.findById(req.params.id);
    if (!held) return res.status(404).json({ message: 'Held order not found' });
    if (held.status !== 'held') {
      return res.status(400).json({ message: `Order already ${held.status}` });
    }

    held.status = 'expired';
    await held.save();

    await AuditLog.create({
      action: 'cancel_hold',
      module: 'order',
      documentId: held._id,
      documentNumber: held.holdNumber,
      description: `Held bill ${held.holdNumber} cancelled by ${req.user.name}`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.json({ message: 'Held order cancelled' });
  } catch (error) {
    next(error);
  }
};

// List held orders
exports.getHeldOrders = async (req, res, next) => {
  try {
    const held = await HeldOrder.find({ status: 'held' })
      .populate('table')
      .populate('heldBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ heldOrders: held, total: held.length });
  } catch (error) {
    next(error);
  }
};
