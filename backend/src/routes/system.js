const router = require('express').Router();
const ctrl = require('../controllers/systemController');
const { auth, authorize } = require('../middleware/auth');

router.post('/backup', auth, authorize('admin'), ctrl.createBackup);
router.post('/restore', auth, authorize('admin'), ctrl.restoreBackup);
router.post('/send-report', auth, authorize('admin', 'manager'), ctrl.sendDailyReport);
router.get('/export', auth, authorize('admin'), ctrl.exportData);
router.post('/import', auth, authorize('admin'), ctrl.importData);

module.exports = router;
