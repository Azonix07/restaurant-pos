const Order = require('../models/Order');

const generateOrderNumber = async () => {
  const today = new Date();
  const prefix = `ORD${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86400000);

  const count = await Order.countDocuments({
    createdAt: { $gte: startOfDay, $lt: endOfDay },
  });

  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
};

module.exports = { generateOrderNumber };
