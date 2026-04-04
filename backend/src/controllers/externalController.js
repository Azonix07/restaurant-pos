const Order = require('../models/Order');
const { generateOrderNumber } = require('../utils/orderNumber');
const { EXTERNAL_PLATFORMS } = require('../../../shared/constants');

// Mock external order data for Swiggy/Zomato integration
const generateMockExternalOrder = (platform) => {
  const items = [
    { name: 'Butter Chicken', price: 350, quantity: 1 },
    { name: 'Naan', price: 60, quantity: 2 },
    { name: 'Dal Makhani', price: 250, quantity: 1 },
    { name: 'Biryani', price: 300, quantity: 1 },
    { name: 'Paneer Tikka', price: 280, quantity: 1 },
  ];

  const selectedItems = items
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(Math.random() * 3) + 1);

  return {
    platform,
    externalOrderId: `${platform.toUpperCase()}-${Date.now()}`,
    customerName: `${platform} Customer`,
    customerPhone: '9999999999',
    items: selectedItems.map(item => ({
      ...item,
      gstCategory: 'food_non_ac',
      gstRate: 5,
      status: 'placed',
    })),
  };
};

exports.simulateOrder = async (req, res, next) => {
  try {
    const { platform } = req.body;
    if (!Object.values(EXTERNAL_PLATFORMS).includes(platform)) {
      return res.status(400).json({ message: 'Invalid platform' });
    }

    const mockData = generateMockExternalOrder(platform);
    const orderNumber = await generateOrderNumber();

    const order = new Order({
      orderNumber,
      type: 'external',
      externalPlatform: platform,
      externalOrderId: mockData.externalOrderId,
      customerName: mockData.customerName,
      customerPhone: mockData.customerPhone,
      items: mockData.items.map(item => ({
        ...item,
        menuItem: undefined,
      })),
      status: 'placed',
      createdBy: req.user._id,
    });

    order.calculateTotals();
    await order.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('external:order', order);
      io.emit('order:new', order);
      io.emit('kitchen:update', order);
    }

    res.status(201).json({ order });
  } catch (error) {
    next(error);
  }
};

exports.getExternalOrders = async (req, res, next) => {
  try {
    const { platform } = req.query;
    const filter = { type: 'external' };
    if (platform) filter.externalPlatform = platform;

    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json({ orders });
  } catch (error) {
    next(error);
  }
};
