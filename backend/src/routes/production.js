const router = require('express').Router();
const ctrl = require('../controllers/productionController');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, authorize('admin', 'manager'), ctrl.getAll);
router.post('/', auth, authorize('admin', 'manager'), ctrl.create);
router.get('/:id', auth, authorize('admin', 'manager'), ctrl.getById);
router.post('/:id/start', auth, authorize('admin', 'manager'), ctrl.startProduction);
router.post('/:id/complete', auth, authorize('admin', 'manager'), ctrl.completeProduction);

module.exports = router;
