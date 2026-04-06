const router = require('express').Router();
const ctrl = require('../controllers/fraudController');
const { auth, authorize } = require('../middleware/auth');

router.get('/alerts', auth, authorize('admin', 'manager'), ctrl.getAlerts);
router.get('/reconciliation', auth, authorize('admin', 'manager'), ctrl.getReconciliation);
router.get('/staff-analysis', auth, authorize('admin', 'manager'), ctrl.getStaffAnalysis);
router.get('/daily-summary', auth, authorize('admin', 'manager'), ctrl.getDailySummary);

module.exports = router;
