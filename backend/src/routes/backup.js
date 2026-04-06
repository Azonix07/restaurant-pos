const router = require('express').Router();
const ctrl = require('../controllers/backupController');
const { auth, authorize } = require('../middleware/auth');

router.post('/create', auth, authorize('admin'), ctrl.createBackup);
router.get('/list', auth, authorize('admin'), ctrl.listBackups);
router.post('/restore', auth, authorize('admin'), ctrl.restoreFromBackup);
router.delete('/cleanup', auth, authorize('admin'), ctrl.cleanupBackups);

module.exports = router;
