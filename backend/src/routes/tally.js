const router = require('express').Router();
const ctrl = require('../controllers/tallyController');
const { auth, authorize } = require('../middleware/auth');

router.post('/export', auth, authorize('admin'), ctrl.exportToTally);
router.post('/import', auth, authorize('admin'), ctrl.importFromTally);

module.exports = router;
