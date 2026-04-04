const router = require('express').Router();
const ctrl = require('../controllers/auditController');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, authorize('admin'), ctrl.getAll);
router.get('/export', auth, authorize('admin'), ctrl.exportForCA);

module.exports = router;
