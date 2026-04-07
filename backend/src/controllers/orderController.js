const Order = require('../models/Order');
const Table = require('../models/Table');
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const BillSequence = require('../models/BillSequence');
const AuditLog = require('../models/AuditLog');
const { generateOrderNumber } = require('../utils/orderNumber');
const { GST_RATES } = require('../../../shared/constants');
const kotController = require('./kotController');
const stockController = require('./stockController');
const customerController = require('./customerController');
const { eventBus, EVENTS } = require('../services/eventBus');

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

    // Event bus — non-blocking background processing
    eventBus.emitEvent(EVENTS.ORDER_CREATED, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      userId: req.user?._id,
      userName: req.user?.name,
      tableId: tableId,
      type: order.type,
      total: order.total,
      itemCount: order.items.length,
    });

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
      .populate('items.menuItem', 'name image kitchenSection')
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
          status: 'available',
          currentOrder: null,
        });
      }
    }
    await order.save();

    // Audit log for cancellations and critical status changes
    if (status === 'cancelled' || status === 'completed') {
      await AuditLog.create({
        action: status === 'cancelled' ? 'cancel' : 'complete',
        module: 'order',
        documentId: order._id,
        documentNumber: order.orderNumber,
        description: `Order ${order.orderNumber} marked ${status}`,
        user: req.user?._id,
        userName: req.user?.name,
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('order:statusChange', { orderId: order._id, status });
      io.emit('kitchen:update', order);
      if (order.table) {
        const updatedTable = await Table.findById(order.table._id);
        io.emit('table:update', updatedTable);
      }
    }

    // Event bus — status change (including cancellations)
    eventBus.emitEvent(
      status === 'cancelled' ? EVENTS.ORDER_CANCELLED : EVENTS.ORDER_STATUS_CHANGED,
      { orderId: order._id, orderNumber: order.orderNumber, status, userId: req.user?._id, userName: req.user?.name }
    );

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

// Edit order items (before payment)
exports.editOrder = async (req, res, next) => {
  try {
    const { items } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Cannot edit a paid order' });
    }

    // Update existing items or add new ones
    if (items && Array.isArray(items)) {
      order.items = items.map(item => ({
        ...item,
        gstRate: getGstRate(item.gstCategory || 'food_non_ac'),
      }));
    }

    order.calculateTotals();
    await order.save();

    const populated = await Order.findById(order._id).populate('table').populate('waiter', 'name');

    const io = req.app.get('io');
    if (io) {
      io.emit('order:update', populated);
      io.emit('kitchen:update', populated);
    }

    // Audit log
    await AuditLog.create({
      action: 'edit',
      module: 'order',
      documentId: order._id,
      documentNumber: order.orderNumber,
      description: `Order ${order.orderNumber} edited`,
      user: req.user?._id,
      userName: req.user?.name,
    });

    res.json({ order: populated });
  } catch (error) {
    next(error);
  }
};

// Get completed/paid orders (bills)
exports.getCompleted = async (req, res, next) => {
  try {
    const { date, page = 1, limit = 50 } = req.query;
    const filter = { paymentStatus: 'paid' };

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 86400000);
      filter.completedAt = { $gte: start, $lt: end };
    } else {
      // Default: today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 86400000);
      filter.completedAt = { $gte: today, $lt: tomorrow };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const orders = await Order.find(filter)
      .populate('table')
      .populate('waiter', 'name')
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Order.countDocuments(filter);
    res.json({ orders, total, page: parseInt(page, 10), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

exports.processPayment = async (req, res, next) => {
  try {
    const { paymentMethod, discount, splitDetails, customerId, denomination, companyName, companyContact, companyRef } = req.body;
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

    // Company credit billing
    if (paymentMethod === 'company') {
      if (!companyName) {
        return res.status(400).json({ message: 'Company name is required for company billing' });
      }
      order.companyName = companyName;
      order.companyCredit = {
        isCompanyBill: true,
        dueAmount: order.total,
        settledAmount: 0,
      };
    }

    // Auto-calculate denomination totals if provided
    if (denomination && paymentMethod === 'cash') {
      const totalReceived = 
        (denomination.notes2000 || 0) * 2000 +
        (denomination.notes500 || 0) * 500 +
        (denomination.notes200 || 0) * 200 +
        (denomination.notes100 || 0) * 100 +
        (denomination.notes50 || 0) * 50 +
        (denomination.notes20 || 0) * 20 +
        (denomination.notes10 || 0) * 10 +
        (denomination.coins || 0);
      denomination.totalReceived = totalReceived;
      denomination.changeToReturn = totalReceived - order.total;
    }

    await order.save();

    // Create transaction with denomination and company details
    const transactionData = {
      order: order._id,
      orderNumber: order.orderNumber,
      amount: order.total,
      paymentMethod,
      splitDetails: splitDetails || [],
      denomination: denomination || undefined,
      processedBy: req.user._id,
    };
    if (paymentMethod === 'company') {
      transactionData.companyDetails = {
        companyName,
        contactPerson: companyContact,
        referenceNumber: companyRef,
      };
    }
    await Transaction.create(transactionData);

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

    // Update table — automatically make it available after payment
    if (order.table) {
      await Table.findByIdAndUpdate(order.table._id, {
        status: 'available',
        currentOrder: null,
      });
      const updatedTable = await Table.findById(order.table._id);
      const io = req.app.get('io');
      if (io) io.emit('table:update', updatedTable);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('order:statusChange', { orderId: order._id, status: 'completed' });
      io.emit('order:paid', { order });
    }

    // Event bus — payment processed (triggers fraud, report, sync workers)
    eventBus.emitEvent(EVENTS.PAYMENT_PROCESSED, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      billNumber: order.billNumber,
      total: order.total,
      discount: order.discount,
      paymentMethod,
      userId: req.user._id,
      userName: req.user.name,
    });

    // Audit log for payment
    await AuditLog.create({
      action: 'payment',
      module: 'order',
      documentId: order._id,
      documentNumber: order.billNumber || order.orderNumber,
      description: `Payment ₹${order.total} via ${paymentMethod}${discount > 0 ? ` (discount: ₹${discount})` : ''}`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.json({ order, message: 'Payment processed successfully' });
  } catch (error) {
    next(error);
  }
};

// Get sales history with advanced filters
exports.getSalesHistory = async (req, res, next) => {
  try {
    const { date, startDate, endDate, staff, paymentMethod, type, page = 1, limit = 50 } = req.query;
    const filter = { paymentStatus: 'paid' };

    // Date filtering
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.completedAt = { $gte: start, $lte: end };
    } else if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 86400000);
      filter.completedAt = { $gte: start, $lt: end };
    }

    // Staff filter
    if (staff) filter.createdBy = staff;

    // Payment method filter
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Order type filter
    if (type) filter.type = type;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const orders = await Order.find(filter)
      .populate('table')
      .populate('waiter', 'name')
      .populate('createdBy', 'name')
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Order.countDocuments(filter);

    // Aggregate summary
    const summary = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$total' },
          totalDiscount: { $sum: '$discount' },
          totalGST: { $sum: '$gstAmount' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$total' },
          cashSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$total', 0] } },
          cardSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'card'] }, '$total', 0] } },
          upiSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'upi'] }, '$total', 0] } },
          companySales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'company'] }, '$total', 0] } },
        },
      },
    ]);

    res.json({
      orders,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / limit),
      summary: summary[0] || {
        totalSales: 0, totalDiscount: 0, totalGST: 0,
        orderCount: 0, avgOrderValue: 0,
        cashSales: 0, cardSales: 0, upiSales: 0, companySales: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get company credit report (pending payments)
exports.getCompanyCreditReport = async (req, res, next) => {
  try {
    const { companyName, settled } = req.query;
    const filter = {
      paymentMethod: 'company',
      'companyCredit.isCompanyBill': true,
    };

    if (companyName) {
      filter.companyName = { $regex: companyName, $options: 'i' };
    }

    if (settled === 'true') {
      filter['companyCredit.dueAmount'] = 0;
    } else if (settled === 'false') {
      filter['companyCredit.dueAmount'] = { $gt: 0 };
    }

    const orders = await Order.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    // Group by company name
    const companyMap = {};
    for (const order of orders) {
      const name = order.companyName || 'Unknown';
      if (!companyMap[name]) {
        companyMap[name] = { companyName: name, totalBilled: 0, totalDue: 0, totalSettled: 0, bills: [] };
      }
      companyMap[name].totalBilled += order.total;
      companyMap[name].totalDue += order.companyCredit?.dueAmount || 0;
      companyMap[name].totalSettled += order.companyCredit?.settledAmount || 0;
      companyMap[name].bills.push({
        orderId: order._id,
        billNumber: order.billNumber,
        amount: order.total,
        dueAmount: order.companyCredit?.dueAmount || 0,
        date: order.completedAt || order.createdAt,
      });
    }

    const companies = Object.values(companyMap);
    const totalDue = companies.reduce((s, c) => s + c.totalDue, 0);

    res.json({ companies, totalDue, totalCompanies: companies.length });
  } catch (error) {
    next(error);
  }
};

// Settle company credit
exports.settleCompanyCredit = async (req, res, next) => {
  try {
    const { amount, settlementRef } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.companyCredit?.isCompanyBill) {
      return res.status(400).json({ message: 'This is not a company credit bill' });
    }

    const settleAmount = Math.min(amount || order.companyCredit.dueAmount, order.companyCredit.dueAmount);
    order.companyCredit.settledAmount += settleAmount;
    order.companyCredit.dueAmount -= settleAmount;
    if (order.companyCredit.dueAmount <= 0) {
      order.companyCredit.dueAmount = 0;
      order.companyCredit.settlementDate = new Date();
    }
    if (settlementRef) order.companyCredit.settlementRef = settlementRef;
    await order.save();

    await AuditLog.create({
      action: 'settlement',
      module: 'company_credit',
      documentId: order._id,
      documentNumber: order.billNumber,
      description: `Company credit ₹${settleAmount} settled for ${order.companyName}. Remaining: ₹${order.companyCredit.dueAmount}`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.json({ order, message: `₹${settleAmount} settled. Remaining due: ₹${order.companyCredit.dueAmount}` });
  } catch (error) {
    next(error);
  }
};

// Cancel order after payment (requires admin PIN)
exports.cancelPaidOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id).populate('table');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Only admin/manager can cancel paid orders
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Only admin/manager can cancel paid orders' });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'Order is not paid. Use regular cancel.' });
    }

    order.status = 'cancelled';
    order.paymentStatus = 'refunded';
    await order.save();

    // Create refund transaction
    await Transaction.create({
      order: order._id,
      orderNumber: order.orderNumber,
      amount: -order.total,
      paymentMethod: order.paymentMethod,
      processedBy: req.user._id,
      status: 'refunded',
    });

    await AuditLog.create({
      action: 'cancel_paid',
      module: 'order',
      documentId: order._id,
      documentNumber: order.billNumber || order.orderNumber,
      description: `Paid order cancelled by ${req.user.name}. Reason: ${reason || 'No reason'}. Amount: ₹${order.total}`,
      user: req.user._id,
      userName: req.user.name,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('order:statusChange', { orderId: order._id, status: 'cancelled' });
    }

    res.json({ order, message: 'Paid order cancelled and refund logged' });
  } catch (error) {
    next(error);
  }
};
