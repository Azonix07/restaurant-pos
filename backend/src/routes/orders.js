const router = require('express').Router();
const ctrl = require('../controllers/orderController');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, ctrl.getAll);
router.get('/active', auth, ctrl.getActive);
router.get('/kitchen', auth, ctrl.getKitchenOrders);
router.get('/completed', auth, ctrl.getCompleted);
router.get('/sales-history', auth, authorize('admin', 'manager'), ctrl.getSalesHistory);
router.get('/company-credit', auth, authorize('admin', 'manager'), ctrl.getCompanyCreditReport);
router.get('/:id', auth, ctrl.getById);
router.post('/', auth, ctrl.create);
router.put('/:id', auth, authorize('admin', 'manager'), ctrl.editOrder);
router.patch('/:id/status', auth, ctrl.updateStatus);
router.patch('/:id/item-status', auth, ctrl.updateItemStatus);
router.post('/:id/items', auth, ctrl.addItems);
router.post('/:id/payment', auth, ctrl.processPayment);
router.post('/:id/settle-credit', auth, authorize('admin', 'manager'), ctrl.settleCompanyCredit);
router.post('/:id/cancel-paid', auth, authorize('admin'), ctrl.cancelPaidOrder);

module.exports = router;
