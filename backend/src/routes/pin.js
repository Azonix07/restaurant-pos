const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const pinController = require('../controllers/pinController');

router.use(auth);

router.post('/verify', authorize('admin', 'manager'), pinController.verifyPin);
router.post('/set', authorize('admin', 'manager'), pinController.setPin);

module.exports = router;
