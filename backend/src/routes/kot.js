const router = require('express').Router();
const ctrl = require('../controllers/kotController');
const { auth, authorize } = require('../middleware/auth');

router.get('/active', auth, ctrl.getActive);
router.get('/section/:section', auth, ctrl.getBySection);
router.get('/order/:orderId', auth, ctrl.getByOrder);
router.get('/verify/:orderId', auth, authorize('admin', 'manager'), ctrl.verifyBilling);
router.patch('/:id/status', auth, ctrl.updateStatus);
router.patch('/:id/item-status', auth, ctrl.updateItemStatus);
router.patch('/:id/edit-item', auth, authorize('admin', 'manager'), ctrl.editItemQuantity);
router.patch('/:id/cancel-item', auth, authorize('admin', 'manager'), ctrl.cancelItem);
router.patch('/:id/cancel', auth, authorize('admin', 'manager'), ctrl.cancelKOT);
router.post('/:id/print', auth, ctrl.printKOT);

module.exports = router;
