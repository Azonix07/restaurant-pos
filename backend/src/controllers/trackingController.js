const Order = require('../models/Order');

// Public endpoint — no auth required
// Customer tracks their order by order number or a short tracking token
exports.trackOrder = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    if (!orderNumber) {
      return res.status(400).json({ message: 'Order number is required' });
    }

    const order = await Order.findOne({
      orderNumber: orderNumber.toUpperCase(),
    }).select('orderNumber status type items.name items.quantity items.status deliveryInfo createdAt tableNumber');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Build customer-friendly status timeline
    const timeline = buildTimeline(order);

    res.json({
      orderNumber: order.orderNumber,
      status: order.status,
      type: order.type,
      tableNumber: order.tableNumber,
      items: order.items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        status: i.status,
      })),
      delivery: order.type === 'delivery' ? {
        status: order.deliveryInfo?.status,
        estimatedTime: order.deliveryInfo?.estimatedTimeMins,
        assignedTo: order.deliveryInfo?.assignedTo,
      } : undefined,
      timeline,
      placedAt: order.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

function buildTimeline(order) {
  const steps = [];
  const statusOrder = ['placed', 'confirmed', 'preparing', 'ready'];

  if (order.type === 'delivery') {
    statusOrder.push('out_for_delivery', 'delivered');
  } else {
    statusOrder.push('served');
  }
  statusOrder.push('completed');

  const currentIdx = statusOrder.indexOf(order.status);

  for (let i = 0; i < statusOrder.length; i++) {
    const label = getStatusLabel(statusOrder[i], order.type);
    steps.push({
      status: statusOrder[i],
      label,
      completed: i <= currentIdx && order.status !== 'cancelled',
      current: i === currentIdx,
    });
  }

  if (order.status === 'cancelled') {
    steps.push({ status: 'cancelled', label: 'Cancelled', completed: true, current: true });
  }

  return steps;
}

function getStatusLabel(status, type) {
  const labels = {
    placed: 'Order Placed',
    confirmed: 'Order Confirmed',
    preparing: 'Being Prepared',
    ready: type === 'delivery' ? 'Ready for Pickup' : 'Ready to Serve',
    served: 'Served',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    completed: 'Completed',
  };
  return labels[status] || status;
}
