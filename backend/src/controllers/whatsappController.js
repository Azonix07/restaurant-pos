const axios = require('axios');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const AuditLog = require('../models/AuditLog');

// WhatsApp Business API configuration (Meta Cloud API)
const getWhatsAppConfig = () => ({
  apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v16.0',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
  enabled: !!process.env.WHATSAPP_ACCESS_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID,
});

// Normalize phone number to E.164 without +
const normalizePhone = (phone) => {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) return cleaned.slice(1);
  if (cleaned.startsWith('91') && cleaned.length >= 12) return cleaned;
  return `91${cleaned}`;
};

// Send a text message via WhatsApp
const sendTextMessage = async (to, body) => {
  const config = getWhatsAppConfig();
  if (!config.enabled) {
    return { success: false, error: 'WhatsApp not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.' };
  }

  const phone = normalizePhone(to);

  try {
    const response = await axios.post(
      `${config.apiUrl}/${config.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body },
      },
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    return { success: true, messageId: response.data?.messages?.[0]?.id };
  } catch (err) {
    console.error('[WhatsApp] Send text error:', err.response?.data || err.message);
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
};

// Send a template message via WhatsApp (pre-approved templates)
const sendTemplateMessage = async (to, templateName, languageCode = 'en_US', components = []) => {
  const config = getWhatsAppConfig();
  if (!config.enabled) {
    return { success: false, error: 'WhatsApp not configured.' };
  }

  const phone = normalizePhone(to);

  try {
    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };

    if (components.length > 0) {
      payload.template.components = components;
    }

    const response = await axios.post(
      `${config.apiUrl}/${config.phoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    return { success: true, messageId: response.data?.messages?.[0]?.id };
  } catch (err) {
    console.error('[WhatsApp] Send template error:', err.response?.data || err.message);
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
};

// Send a media message (image/document) via media ID
const sendMediaMessage = async (to, type, mediaId, caption = '') => {
  const config = getWhatsAppConfig();
  if (!config.enabled) {
    return { success: false, error: 'WhatsApp not configured.' };
  }

  const phone = normalizePhone(to);
  const mediaPayload = { id: mediaId };
  if (caption) mediaPayload.caption = caption;

  try {
    const response = await axios.post(
      `${config.apiUrl}/${config.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type,
        [type]: mediaPayload,
      },
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    return { success: true, messageId: response.data?.messages?.[0]?.id };
  } catch (err) {
    console.error('[WhatsApp] Send media error:', err.response?.data || err.message);
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
    const { orderId, phoneNumber, useTemplate } = req.body;
    if (!phoneNumber) return res.status(400).json({ message: 'Phone number required' });

    const order = await Order.findById(orderId).populate('waiter', 'name');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let result;

    if (useTemplate) {
      // Use pre-approved template message (for first contact / 24h window expired)
      result = await sendTemplateMessage(phoneNumber, 'bill_notification', 'en_US', [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: order.billNumber || order.orderNumber },
            { type: 'text', text: `₹${order.total?.toFixed(0)}` },
          ],
        },
      ]);
    } else {
      // Send as text message (within 24h conversation window)
      const message = formatBillMessage(order);
      result = await sendTextMessage(phoneNumber, message);
    }

    if (result.success) {
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
    const { orderId, phoneNumber, useTemplate } = req.body;
    if (!phoneNumber) return res.status(400).json({ message: 'Phone number required' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let result;

    if (useTemplate) {
      result = await sendTemplateMessage(phoneNumber, 'order_confirmation', 'en_US', [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: order.orderNumber },
            { type: 'text', text: `₹${order.total?.toFixed(0)}` },
          ],
        },
      ]);
    } else {
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

      result = await sendTextMessage(phoneNumber, message);
    }

    res.json({ success: result.success, error: result.error });
  } catch (error) {
    next(error);
  }
};

// Send order ready notification
exports.sendReadyNotification = async (req, res, next) => {
  try {
    const { orderId, phoneNumber, useTemplate } = req.body;
    if (!phoneNumber) return res.status(400).json({ message: 'Phone number required' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let result;

    if (useTemplate) {
      result = await sendTemplateMessage(phoneNumber, 'order_ready', 'en_US', [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: order.orderNumber },
          ],
        },
      ]);
    } else {
      const message = `🔔 *Order Ready!*\n\n` +
        `Your order #${order.orderNumber} is ready for ${order.type === 'delivery' ? 'delivery' : 'pickup'}.\n\n` +
        `Thank you for your patience! 😊`;

      result = await sendTextMessage(phoneNumber, message);
    }

    res.json({ success: result.success, error: result.error });
  } catch (error) {
    next(error);
  }
};

// Send a custom text message
exports.sendCustomMessage = async (req, res, next) => {
  try {
    const { phoneNumber, message } = req.body;
    if (!phoneNumber || !message) {
      return res.status(400).json({ message: 'Phone number and message required' });
    }

    const result = await sendTextMessage(phoneNumber, message);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// Send a template message
exports.sendTemplate = async (req, res, next) => {
  try {
    const { phoneNumber, templateName, languageCode, components } = req.body;
    if (!phoneNumber || !templateName) {
      return res.status(400).json({ message: 'Phone number and template name required' });
    }

    const result = await sendTemplateMessage(
      phoneNumber,
      templateName,
      languageCode || 'en_US',
      components || []
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// Webhook verification (GET) — Facebook sends a challenge during setup
exports.webhookVerify = (req, res) => {
  const config = getWhatsAppConfig();
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.webhookVerifyToken) {
    console.log('[WhatsApp] Webhook verified');
    return res.status(200).send(challenge);
  }

  console.warn('[WhatsApp] Webhook verification failed');
  res.sendStatus(403);
};

// Webhook handler (POST) — receives messages and status updates from WhatsApp
exports.webhookHandler = async (req, res) => {
  // Always respond 200 quickly to acknowledge receipt
  res.sendStatus(200);

  try {
    const body = req.body;
    if (!body?.entry?.[0]?.changes?.[0]?.value) return;

    const value = body.entry[0].changes[0].value;

    // Handle incoming messages
    if (value.messages && value.messages.length > 0) {
      for (const msg of value.messages) {
        const from = msg.from; // sender phone
        const text = msg.text?.body || '';
        const msgType = msg.type;
        const timestamp = msg.timestamp;

        console.log(`[WhatsApp] Incoming ${msgType} from ${from}: ${text.substring(0, 100)}`);

        // Try to find matching customer
        const customer = await Customer.findOne({
          $or: [{ phone: from }, { phone: `+${from}` }],
        });

        // Log incoming message
        await AuditLog.create({
          action: 'whatsapp_received',
          module: 'whatsapp',
          description: `Message from ${from}${customer ? ` (${customer.name})` : ''}: ${text.substring(0, 200)}`,
          metadata: { from, type: msgType, timestamp, customerId: customer?._id },
        });
      }
    }

    // Handle status updates (sent, delivered, read)
    if (value.statuses && value.statuses.length > 0) {
      for (const status of value.statuses) {
        console.log(`[WhatsApp] Status: ${status.id} → ${status.status}`);
      }
    }
  } catch (err) {
    console.error('[WhatsApp] Webhook processing error:', err.message);
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
