const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const whatsappController = require('../controllers/whatsappController');

// Webhook endpoints (no auth — called by Facebook)
router.get('/webhook', whatsappController.webhookVerify);
router.post('/webhook', whatsappController.webhookHandler);

// Authenticated endpoints
router.use(auth);

router.post('/send-bill', authorize('admin', 'manager', 'cashier'), whatsappController.sendBill);
router.post('/send-confirmation', authorize('admin', 'manager', 'cashier'), whatsappController.sendOrderConfirmation);
router.post('/send-ready', authorize('admin', 'manager', 'cashier', 'waiter'), whatsappController.sendReadyNotification);
router.post('/send-message', authorize('admin', 'manager'), whatsappController.sendCustomMessage);
router.post('/send-template', authorize('admin', 'manager'), whatsappController.sendTemplate);
router.get('/status', authorize('admin', 'manager'), whatsappController.getStatus);

module.exports = router;
