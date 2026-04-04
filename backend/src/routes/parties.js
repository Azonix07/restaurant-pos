const router = require('express').Router();
const ctrl = require('../controllers/partyController');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, ctrl.getAll);
router.get('/overdue', auth, authorize('admin', 'manager'), ctrl.getOverdueParties);
router.get('/:id', auth, ctrl.getById);
router.post('/', auth, authorize('admin', 'manager'), ctrl.create);
router.post('/import', auth, authorize('admin'), ctrl.importParties);
router.put('/:id', auth, authorize('admin', 'manager'), ctrl.update);
router.put('/:id/pricing', auth, authorize('admin', 'manager'), ctrl.setCustomPricing);
router.put('/:id/credit-limit', auth, authorize('admin', 'manager'), ctrl.setCreditLimit);
router.post('/:id/reminder', auth, authorize('admin', 'manager'), ctrl.sendPaymentReminder);
router.delete('/:id', auth, authorize('admin'), ctrl.remove);

module.exports = router;
