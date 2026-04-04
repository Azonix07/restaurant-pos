const router = require('express').Router();
const ctrl = require('../controllers/customerController');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, ctrl.getAll);
router.get('/phone/:phone', auth, ctrl.findByPhone);
router.get('/:id', auth, ctrl.getById);
router.get('/:id/orders', auth, ctrl.getOrderHistory);
router.post('/', auth, ctrl.create);
router.post('/:id/redeem', auth, authorize('admin', 'manager', 'cashier'), ctrl.redeemPoints);
router.put('/:id', auth, authorize('admin', 'manager'), ctrl.update);
router.delete('/:id', auth, authorize('admin'), ctrl.remove);

module.exports = router;
