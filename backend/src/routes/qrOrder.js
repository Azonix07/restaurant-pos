const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const { generateOrderNumber } = require('../utils/orderNumber');

// QR ordering routes — no auth required (customer-facing)
const router = require('express').Router();

// Get menu for QR ordering
router.get('/menu', async (req, res, next) => {
  try {
    const items = await MenuItem.find({ isAvailable: true }).sort({ category: 1, name: 1 });
    const categories = await MenuItem.distinct('category', { isAvailable: true });
    res.json({ items, categories });
  } catch (error) {
    next(error);
  }
});

// Place order via QR
router.post('/order', async (req, res, next) => {
  try {
    const { tableNumber, items, customerName } = req.body;

    if (!tableNumber || !items || items.length === 0) {
      return res.status(400).json({ message: 'Table number and items are required' });
    }

    const Table = require('../models/Table');
    const table = await Table.findOne({ number: parseInt(tableNumber, 10) });
    if (!table) return res.status(404).json({ message: 'Table not found' });

    const orderNumber = await generateOrderNumber();

    const orderItems = [];
    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem || !menuItem.isAvailable) continue;
      orderItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        quantity: item.quantity,
        price: menuItem.price,
        gstRate: 5,
        notes: item.notes || '',
      });
    }

    if (orderItems.length === 0) {
      return res.status(400).json({ message: 'No valid items in order' });
    }

    const order = new Order({
      orderNumber,
      table: table._id,
      tableNumber: table.number,
      type: 'dine_in',
      items: orderItems,
      customerName: customerName || 'Walk-in Customer',
      status: 'placed',
    });

    order.calculateTotals();
    await order.save();

    table.status = 'occupied';
    table.currentOrder = order._id;
    await table.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('order:new', order);
      io.emit('kitchen:update', order);
      io.emit('table:update', table);
    }

    res.status(201).json({ order: { orderNumber: order.orderNumber, total: order.total } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
