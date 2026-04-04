const router = require('express').Router();
const ctrl = require('../controllers/kotController');
const { auth, authorize } = require('../middleware/auth');

router.get('/active', auth, ctrl.getActive);
router.get('/section/:section', auth, ctrl.getBySection);
router.get('/order/:orderId', auth, ctrl.getByOrder);
router.get('/verify/:orderId', auth, authorize('admin', 'manager'), ctrl.verifyBilling);
router.patch('/:id/status', auth, ctrl.updateStatus);
router.patch('/:id/item-status', auth, ctrl.updateItemStatus);
router.post('/:id/print', auth, ctrl.printKOT);

module.exports = router;
