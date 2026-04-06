const router = require('express').Router();
const ctrl = require('../controllers/refundController');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, ctrl.getRefunds);
router.post('/', auth, ctrl.requestRefund);
router.post('/:id/approve', auth, authorize('admin', 'manager'), ctrl.approveRefund);
router.post('/:id/reject', auth, authorize('admin', 'manager'), ctrl.rejectRefund);

module.exports = router;
