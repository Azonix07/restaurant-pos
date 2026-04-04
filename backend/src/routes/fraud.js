const router = require('express').Router();
const ctrl = require('../controllers/fraudController');
const { auth, authorize } = require('../middleware/auth');

router.get('/alerts', auth, authorize('admin', 'manager'), ctrl.getAlerts);
router.get('/reconciliation', auth, authorize('admin', 'manager'), ctrl.getReconciliation);

module.exports = router;
