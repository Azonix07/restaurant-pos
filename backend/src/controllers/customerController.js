const Customer = require('../models/Customer');
const Order = require('../models/Order');

exports.create = async (req, res, next) => {
  try {
    const { name, phone, email, address, gstin, dateOfBirth, anniversary, preferences } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number is required' });

    const existing = await Customer.findOne({ phone });
    if (existing) return res.status(409).json({ message: 'Customer with this phone already exists', customer: existing });

    const customer = await Customer.create({ name, phone, email, address, gstin, dateOfBirth, anniversary, preferences });
    res.status(201).json({ customer });
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const { search, tier, page = 1, limit = 50 } = req.query;
    const filter = { isActive: true };
    if (tier) filter.tier = tier;
    if (search) {
      // Escape regex special characters to prevent ReDoS
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const customers = await Customer.find(filter).sort({ lastVisit: -1 }).skip(skip).limit(parseInt(limit));
    const total = await Customer.countDocuments(filter);
    res.json({ customers, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

// Search by phone - used at billing to quickly find/create customer
exports.findByPhone = async (req, res, next) => {
  try {
    const { phone } = req.params;
    const customer = await Customer.findOne({ phone });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json({ customer });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json({ customer });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json({ customer });
  } catch (error) {
    next(error);
  }
};

// Get order history for a customer
exports.getOrderHistory = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const orders = await Order.find({ customerPhone: customer.phone })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ customer, orders });
  } catch (error) {
    next(error);
  }
};

// Add loyalty points (called after payment)
exports.addLoyaltyPoints = async (customerId, orderTotal) => {
  try {
    const customer = await Customer.findById(customerId);
    if (!customer) return;

    // 1 point per ₹100 spent
    const points = Math.floor(orderTotal / 100);
    customer.loyaltyPoints += points;
    customer.totalSpent += orderTotal;
    customer.totalOrders += 1;
    customer.lastVisit = new Date();
    customer.updateTier();
    await customer.save();
    return customer;
  } catch (error) {
    console.error('Loyalty points error:', error.message);
  }
};

// Redeem loyalty points
exports.redeemPoints = async (req, res, next) => {
  try {
    const { points } = req.body;
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    if (customer.loyaltyPoints < points) {
      return res.status(400).json({ message: 'Insufficient loyalty points' });
    }

    customer.loyaltyPoints -= points;
    await customer.save();

    // 1 point = ₹1 discount
    res.json({ customer, discountAmount: points });
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await Customer.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Customer deactivated' });
  } catch (error) {
    next(error);
  }
};
