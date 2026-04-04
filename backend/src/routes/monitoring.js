const router = require('express').Router();
const ctrl = require('../controllers/monitoringController');
const { auth, authorize } = require('../middleware/auth');

router.get('/dashboard', auth, authorize('admin', 'manager'), ctrl.getDashboard);
router.get('/alerts', auth, authorize('admin', 'manager'), ctrl.getAlerts);
router.patch('/alerts/:id/resolve', auth, authorize('admin', 'manager'), ctrl.resolveAlert);
router.get('/bill-gaps', auth, authorize('admin', 'manager'), ctrl.detectBillGaps);

module.exports = router;
