const router = require('express').Router();
const ctrl = require('../controllers/tableController');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, ctrl.getAll);
router.post('/', auth, authorize('admin', 'manager'), ctrl.create);
router.put('/:id', auth, authorize('admin', 'manager'), ctrl.update);
router.patch('/:id/status', auth, ctrl.updateStatus);
router.delete('/:id', auth, authorize('admin', 'manager'), ctrl.remove);
router.get('/:id/qr', auth, ctrl.generateQR);

module.exports = router;
