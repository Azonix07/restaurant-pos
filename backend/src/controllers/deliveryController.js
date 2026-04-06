const Order = require('../models/Order');
const Customer = require('../models/Customer');
const AuditLog = require('../models/AuditLog');

// Delivery configuration
const DELIVERY_CONFIG = {
  freeDeliveryRadiusKm: 5,
  baseDeliveryCharge: 30,    // charge beyond free radius
  perKmCharge: 8,             // per km beyond free radius
  maxDeliveryRadiusKm: 25,
  estimatedPrepTimeMins: 20,
  estimatedSpeedKmph: 25,     // avg delivery speed
};

// Calculate delivery charge based on distance
const calculateDeliveryCharge = (distanceKm) => {
  if (distanceKm <= DELIVERY_CONFIG.freeDeliveryRadiusKm) return 0;
  if (distanceKm > DELIVERY_CONFIG.maxDeliveryRadiusKm) return -1; // out of range

  const extraKm = distanceKm - DELIVERY_CONFIG.freeDeliveryRadiusKm;
  return Math.round(DELIVERY_CONFIG.baseDeliveryCharge + (extraKm * DELIVERY_CONFIG.perKmCharge));
};

// Estimate delivery time in minutes
const estimateDeliveryTime = (distanceKm) => {
  const travelMins = Math.ceil((distanceKm / DELIVERY_CONFIG.estimatedSpeedKmph) * 60);
  return DELIVERY_CONFIG.estimatedPrepTimeMins + travelMins;
};

// Get delivery charge estimate
exports.getDeliveryEstimate = async (req, res, next) => {
  try {
    const { distanceKm, latitude, longitude, address } = req.query;
    const distance = parseFloat(distanceKm);

    if (!distance || distance <= 0) {
      return res.status(400).json({ message: 'Valid distance in km required' });
    }

    if (distance > DELIVERY_CONFIG.maxDeliveryRadiusKm) {
      return res.json({
        deliverable: false,
        message: `Sorry, we only deliver within ${DELIVERY_CONFIG.maxDeliveryRadiusKm} km`,
        maxRadius: DELIVERY_CONFIG.maxDeliveryRadiusKm,
      });
    }

    const charge = calculateDeliveryCharge(distance);
    const estimatedTime = estimateDeliveryTime(distance);

    res.json({
      deliverable: true,
      distanceKm: distance,
      deliveryCharge: charge,
      freeDelivery: charge === 0,
      freeDeliveryRadius: DELIVERY_CONFIG.freeDeliveryRadiusKm,
      estimatedTimeMins: estimatedTime,
      message: charge === 0
        ? `Free delivery! Estimated ${estimatedTime} mins`
        : `Delivery charge: ₹${charge}. Estimated ${estimatedTime} mins`,
    });
  } catch (error) {
    next(error);
  }
};

// Create delivery order
exports.createDeliveryOrder = async (req, res, next) => {
  try {
    const {
      items, customerName, customerPhone, customerId,
      deliveryAddress, distanceKm, latitude, longitude, notes,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Items required' });
    }
    if (!deliveryAddress) {
      return res.status(400).json({ message: 'Delivery address required' });
    }
    if (!customerPhone) {
      return res.status(400).json({ message: 'Phone number required for delivery' });
    }

    const distance = parseFloat(distanceKm) || 0;
    if (distance > DELIVERY_CONFIG.maxDeliveryRadiusKm) {
      return res.status(400).json({ message: `Delivery not available beyond ${DELIVERY_CONFIG.maxDeliveryRadiusKm} km` });
    }

    const deliveryCharge = calculateDeliveryCharge(distance);
    const estimatedTime = estimateDeliveryTime(distance);

    // Forward to order create with delivery metadata
    req.body.type = 'delivery';
    req.body.deliveryInfo = {
      address: deliveryAddress,
      distanceKm: distance,
      latitude,
      longitude,
      deliveryCharge,
      estimatedTimeMins: estimatedTime,
      status: 'pending',        // pending → assigned → picked_up → delivered
      assignedTo: null,
      pickedUpAt: null,
      deliveredAt: null,
    };

    // Let the normal order controller handle the rest
    next();
  } catch (error) {
    next(error);
  }
};

// Update delivery status
exports.updateDeliveryStatus = async (req, res, next) => {
  try {
    const { status, assignedTo } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.type !== 'delivery') {
      return res.status(400).json({ message: 'Not a delivery order' });
    }

    const validStatuses = ['pending', 'assigned', 'picked_up', 'on_the_way', 'delivered', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be: ${validStatuses.join(', ')}` });
    }

    if (!order.deliveryInfo) order.deliveryInfo = {};
    order.deliveryInfo.status = status;

    if (status === 'assigned' && assignedTo) {
      order.deliveryInfo.assignedTo = assignedTo;
    }
    if (status === 'picked_up') {
      order.deliveryInfo.pickedUpAt = new Date();
    }
    if (status === 'delivered') {
      order.deliveryInfo.deliveredAt = new Date();
      order.status = 'completed';
      order.completedAt = new Date();
    }

    await order.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('delivery:statusUpdate', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        deliveryStatus: status,
      });
    }

    await AuditLog.create({
      action: 'delivery_update',
      module: 'delivery',
      documentId: order._id,
      documentNumber: order.orderNumber,
      description: `Delivery status → ${status}`,
      user: req.user?._id,
      userName: req.user?.name,
    });

    res.json({ order, message: `Delivery ${status}` });
  } catch (error) {
    next(error);
  }
};

// Get active delivery orders
exports.getActiveDeliveries = async (req, res, next) => {
  try {
    const orders = await Order.find({
      type: 'delivery',
      status: { $nin: ['completed', 'cancelled'] },
    })
      .populate('waiter', 'name')
      .sort({ createdAt: -1 });

    res.json({ orders });
  } catch (error) {
    next(error);
  }
};

// Get delivery config
exports.getConfig = async (req, res) => {
  res.json({ config: DELIVERY_CONFIG });
};
