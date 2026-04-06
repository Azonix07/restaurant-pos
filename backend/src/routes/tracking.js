const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/trackingController');

// Public routes — no auth required
// Customer-facing order tracking
router.get('/:orderNumber', ctrl.trackOrder);

module.exports = router;
