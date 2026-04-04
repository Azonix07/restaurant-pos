const router = require('express').Router();
const ctrl = require('../controllers/recycleBinController');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, authorize('admin', 'manager'), ctrl.getAll);
router.post('/:id/restore', auth, authorize('admin'), ctrl.restore);
router.delete('/:id', auth, authorize('admin'), ctrl.permanentDelete);
router.delete('/', auth, authorize('admin'), ctrl.emptyBin);

module.exports = router;
