const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const deliveryController = require('../controllers/deliveryController');

router.use(auth);

router.get('/estimate', deliveryController.getDeliveryEstimate);
router.get('/active', authorize('admin', 'manager', 'cashier'), deliveryController.getActiveDeliveries);
router.get('/config', deliveryController.getConfig);
router.patch('/:id/status', authorize('admin', 'manager', 'cashier'), deliveryController.updateDeliveryStatus);

module.exports = router;
