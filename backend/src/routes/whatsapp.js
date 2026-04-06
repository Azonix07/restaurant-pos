const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const whatsappController = require('../controllers/whatsappController');

router.use(auth);

router.post('/send-bill', authorize('admin', 'manager', 'cashier'), whatsappController.sendBill);
router.post('/send-confirmation', authorize('admin', 'manager', 'cashier'), whatsappController.sendOrderConfirmation);
router.post('/send-ready', authorize('admin', 'manager', 'cashier', 'waiter'), whatsappController.sendReadyNotification);
router.get('/status', authorize('admin', 'manager'), whatsappController.getStatus);

module.exports = router;
