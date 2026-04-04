const router = require('express').Router();
const ctrl = require('../controllers/externalController');
const { auth, authorize } = require('../middleware/auth');

router.post('/simulate', auth, authorize('admin', 'manager'), ctrl.simulateOrder);
router.get('/', auth, ctrl.getExternalOrders);

module.exports = router;
