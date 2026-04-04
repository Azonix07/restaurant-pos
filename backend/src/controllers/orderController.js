const Order = require('../models/Order');
const Table = require('../models/Table');
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const BillSequence = require('../models/BillSequence');
const { generateOrderNumber } = require('../utils/orderNumber');
const { GST_RATES } = require('../../../shared/constants');
const kotController = require('./kotController');
const stockController = require('./stockController');
const customerController = require('./customerController');

const getGstRate = (gstCategory) => {
  const map = {
    food_non_ac: GST_RATES.FOOD_NON_AC,
    food_ac: GST_RATES.FOOD_AC,
    beverage: GST_RATES.BEVERAGE,
    alcohol: GST_RATES.ALCOHOL,
  };
  return map[gstCategory] || GST_RATES.DEFAULT;
};

exports.create = async (req, res, next) => {
  try {
    const { tableId, items, type, customerName, customerPhone, notes, customerId } = req.body;
    const orderNumber = await generateOrderNumber();

    let table = null;
    if (tableId) {
      table = await Table.findById(tableId);
      if (!table) return res.status(404).json({ message: 'Table not found' });
    }

    const orderItems = items.map(item => ({
      ...item,
      gstRate: getGstRate(item.gstCategory || 'food_non_ac'),
    }));

    const order = new Order({
      orderNumber,
      table: tableId || undefined,
      tableNumber: table ? table.number : undefined,
      type: type || 'dine_in',
      items: orderItems,
      customerName,
      customerPhone,
      customer: customerId || undefined,
      notes,
      createdBy: req.user ? req.user._id : undefined,
      waiter: req.user ? req.user._id : undefined,
    });

    order.calculateTotals();
    await order.save();

    if (table) {
      table.status = 'occupied';
      table.currentOrder = order._id;
      await table.save();
    }

    const populated = await Order.findById(order._id).populate('table').populate('waiter', 'name');

    const io = req.app.get('io');

    // Generate KOTs split by kitchen section
    let kots = [];
    try {
      kots = await kotController.generateKOTs(order, req.user?._id, io);
    } catch (kotErr) {
      console.error('KOT generation error:', kotErr.message);
    }

    if (io) {
      io.emit('order:new', populated);
      io.emit('kitchen:update', populated);
      if (table) io.emit('table:update', table);
    }

    res.status(201).json({ order: populated, kots });
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const { status, type, date, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 86400000);
      filter.createdAt = { $gte: start, $lt: end };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const orders = await Order.find(filter)
      .populate('table')
      .populate('waiter', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Order.countDocuments(filter);
    res.json({ orders, total, page: parseInt(page, 10), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('table')
      .populate('waiter', 'name')
      .populate('items.menuItem');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ order });
  } catch (error) {
    next(error);
  }
};

exports.getActive = async (req, res, next) => {
  try {
    const orders = await Order.find({
      status: { $nin: ['completed', 'cancelled'] },
    })
      .populate('table')
      .populate('waiter', 'name')
      .sort({ createdAt: -1 });
    res.json({ orders });
  } catch (error) {
    next(error);
  }
};

exports.getKitchenOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({
      status: { $in: ['placed', 'confirmed', 'preparing'] },
    })
      .populate('table')
      .sort({ createdAt: 1 });
    res.json({ orders });
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id).populate('table');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = status;
    if (status === 'completed') {
      order.completedAt = new Date();
      if (order.table) {
        await Table.findByIdAndUpdate(order.table._id, {
          status: 'cleaning',
          currentOrder: null,
        });
      }
    }
    await order.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('order:statusChange', { orderId: order._id, status });
      io.emit('kitchen:update', order);
      if (order.table) {
        const updatedTable = await Table.findById(order.table._id);
        io.emit('table:update', updatedTable);
      }
    }

    res.json({ order });
  } catch (error) {
    next(error);
  }
};

exports.updateItemStatus = async (req, res, next) => {
  try {
    const { itemId, status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = order.items.id(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.status = status;

    // Auto-update order status based on items
    const itemStatuses = order.items.map(i => i.status);
    if (itemStatuses.every(s => s === 'ready' || s === 'served')) {
      order.status = 'ready';
    } else if (itemStatuses.some(s => s === 'preparing')) {
      order.status = 'preparing';
    } else if (itemStatuses.every(s => s === 'confirmed' || s === 'placed')) {
      order.status = 'confirmed';
    }

    order.calculateTotals();
    await order.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('order:itemStatus', { orderId: order._id, itemId, status });
      io.emit('kitchen:update', order);
    }

    res.json({ order });
  } catch (error) {
    next(error);
  }
};

exports.addItems = async (req, res, next) => {
  try {
    const { items } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const newItems = items.map(item => ({
      ...item,
      gstRate: getGstRate(item.gstCategory || 'food_non_ac'),
    }));

    order.items.push(...newItems);
    order.calculateTotals();
    await order.save();

    const populated = await Order.findById(order._id).populate('table').populate('waiter', 'name');

    const io = req.app.get('io');

    // Generate delta KOTs for the new items only
    let kots = [];
    try {
      kots = await kotController.generateDeltaKOT(order, newItems, req.user?._id, io);
    } catch (kotErr) {
      console.error('Delta KOT error:', kotErr.message);
    }

    if (io) {
      io.emit('order:update', populated);
      io.emit('kitchen:update', populated);
    }

    res.json({ order: populated, kots });
  } catch (error) {
    next(error);
  }
};

exports.processPayment = async (req, res, next) => {
  try {
    const { paymentMethod, discount, splitDetails, customerId } = req.body;
    const order = await Order.findById(req.params.id).populate('table');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Prevent double payment
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Order already paid', billNumber: order.billNumber });
    }

    if (discount !== undefined) {
      order.discount = discount;
      order.calculateTotals();
    }

    // Generate continuous bill number from master
    const billNum = await BillSequence.getNextNumber('BILL');
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    order.billNumber = `BILL-${dateStr}-${String(billNum).padStart(4, '0')}`;

    order.paymentMethod = paymentMethod;
    order.paymentStatus = 'paid';
    order.status = 'completed';
    order.completedAt = new Date();
    if (customerId) order.customer = customerId;
    await order.save();

    // Create transaction
    await Transaction.create({
      order: order._id,
      orderNumber: order.orderNumber,
      amount: order.total,
      paymentMethod,
      splitDetails: splitDetails || [],
      processedBy: req.user._id,
    });

    // Auto-deduct stock based on recipes
    try {
      await stockController.deductStockForOrder(order.items, req.user._id);
    } catch (stockErr) {
      console.error('Stock deduction error:', stockErr.message);
    }

    // Add loyalty points if customer is linked
    if (customerId || order.customer) {
      try {
        await customerController.addLoyaltyPoints(customerId || order.customer, order.total);
      } catch (loyaltyErr) {
        console.error('Loyalty error:', loyaltyErr.message);
      }
    }

    // Update table
    if (order.table) {
      await Table.findByIdAndUpdate(order.table._id, {
        status: 'cleaning',
        currentOrder: null,
      });
      const updatedTable = await Table.findById(order.table._id);
      const io = req.app.get('io');
      if (io) io.emit('table:update', updatedTable);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('order:statusChange', { orderId: order._id, status: 'completed' });
    }

    res.json({ order, message: 'Payment processed successfully' });
  } catch (error) {
    next(error);
  }
};
