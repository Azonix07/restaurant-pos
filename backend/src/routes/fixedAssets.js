const router = require('express').Router();
const ctrl = require('../controllers/fixedAssetController');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, authorize('admin', 'manager'), ctrl.getAll);
router.post('/', auth, authorize('admin'), ctrl.create);
router.put('/:id', auth, authorize('admin'), ctrl.update);
router.post('/:id/dispose', auth, authorize('admin'), ctrl.dispose);
router.delete('/:id', auth, authorize('admin'), ctrl.remove);

module.exports = router;
