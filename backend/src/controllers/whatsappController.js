const axios = require('axios');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const AuditLog = require('../models/AuditLog');

// WhatsApp Business API configuration (uses Meta Cloud API or third-party like Twilio)
const getWhatsAppConfig = () => ({
  apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  enabled: !!process.env.WHATSAPP_ACCESS_TOKEN,
});

const sendWhatsAppMessage = async (to, template, params = {}) => {
  const config = getWhatsAppConfig();
  if (!config.enabled) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  // Normalize phone number (add country code if missing)
  const phone = to.startsWith('+') ? to.replace('+', '') : to.startsWith('91') ? to : `91${to}`;

  try {
    const response = await axios.post(
      `${config.apiUrl}/${config.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: params.body || '' },
      },
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    return { success: true, messageId: response.data?.messages?.[0]?.id };
  } catch (err) {
    console.error('[WhatsApp] Send error:', err.response?.data || err.message);
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
};

// Format bill as text for WhatsApp
const formatBillMessage = (order, restaurantName = 'Restaurant') => {
  const items = order.items
    .filter(i => i.status !== 'cancelled')
    .map(i => `  ${i.name} × ${i.quantity} = ₹${(i.price * i.quantity).toFixed(0)}`)
    .join('\n');

  return `🧾 *${restaurantName}*\n` +
    `Bill: ${order.billNumber || order.orderNumber}\n` +
    `Date: ${new Date(order.createdAt).toLocaleString('en-IN')}\n` +
    `${order.tableNumber ? `Table: ${order.tableNumber}\n` : ''}` +
    `━━━━━━━━━━━━━━━━\n` +
    `${items}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `Subtotal: ₹${order.subtotal?.toFixed(0)}\n` +
    `GST: ₹${order.gstAmount?.toFixed(0)}\n` +
    `${order.discount > 0 ? `Discount: -₹${order.discount?.toFixed(0)}\n` : ''}` +
    `*Total: ₹${order.total?.toFixed(0)}*\n` +
    `Payment: ${(order.paymentMethod || 'N/A').toUpperCase()}\n\n` +
    `Thank you! Visit again 🙏`;
};

// Send bill via WhatsApp
exports.sendBill = async (req, res, next) => {
  try {
    const { orderId, phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ message: 'Phone number required' });

    const order = await Order.findById(orderId).populate('waiter', 'name');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const message = formatBillMessage(order);
    const result = await sendWhatsAppMessage(phoneNumber, 'bill', { body: message });

    if (result.success) {
      // Track that WhatsApp was sent
      order.whatsappSent = true;
      order.whatsappSentAt = new Date();
      await order.save();

      await AuditLog.create({
        action: 'whatsapp_bill',
        module: 'whatsapp',
        documentId: order._id,
        documentNumber: order.billNumber || order.orderNumber,
        description: `Bill sent via WhatsApp to ${phoneNumber}`,
        user: req.user?._id,
        userName: req.user?.name,
      });
    }

    res.json({ success: result.success, error: result.error, messageId: result.messageId });
  } catch (error) {
    next(error);
  }
};

// Send order confirmation
exports.sendOrderConfirmation = async (req, res, next) => {
  try {
    const { orderId, phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ message: 'Phone number required' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const itemList = order.items
      .filter(i => i.status !== 'cancelled')
      .map(i => `• ${i.name} × ${i.quantity}`)
      .join('\n');

    const message = `✅ *Order Confirmed*\n\n` +
      `Order: #${order.orderNumber}\n` +
      `${order.type === 'delivery' ? '🚗 Delivery Order' : order.type === 'takeaway' ? '📦 Takeaway' : `🍽️ Table ${order.tableNumber || ''}`}\n\n` +
      `${itemList}\n\n` +
      `Total: ₹${order.total?.toFixed(0)}\n\n` +
      `We'll notify you when your order is ready! 🎉`;

    const result = await sendWhatsAppMessage(phoneNumber, 'order_confirm', { body: message });
    res.json({ success: result.success, error: result.error });
  } catch (error) {
    next(error);
  }
};

// Send order ready notification
exports.sendReadyNotification = async (req, res, next) => {
  try {
    const { orderId, phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ message: 'Phone number required' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const message = `🔔 *Order Ready!*\n\n` +
      `Your order #${order.orderNumber} is ready for ${order.type === 'delivery' ? 'delivery' : 'pickup'}.\n\n` +
      `Thank you for your patience! 😊`;

    const result = await sendWhatsAppMessage(phoneNumber, 'order_ready', { body: message });
    res.json({ success: result.success, error: result.error });
  } catch (error) {
    next(error);
  }
};

// Get WhatsApp config status
exports.getStatus = async (req, res) => {
  const config = getWhatsAppConfig();
  res.json({
    enabled: config.enabled,
    phoneNumberId: config.phoneNumberId ? '***configured***' : 'not set',
  });
};
