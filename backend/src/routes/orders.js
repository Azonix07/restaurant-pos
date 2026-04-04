const router = require('express').Router();
const ctrl = require('../controllers/orderController');
const { auth } = require('../middleware/auth');

router.get('/', auth, ctrl.getAll);
router.get('/active', auth, ctrl.getActive);
router.get('/kitchen', auth, ctrl.getKitchenOrders);
router.get('/:id', auth, ctrl.getById);
router.post('/', auth, ctrl.create);
router.patch('/:id/status', auth, ctrl.updateStatus);
router.patch('/:id/item-status', auth, ctrl.updateItemStatus);
router.post('/:id/items', auth, ctrl.addItems);
router.post('/:id/payment', auth, ctrl.processPayment);

module.exports = router;
