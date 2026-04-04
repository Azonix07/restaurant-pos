const router = require('express').Router();
const ctrl = require('../controllers/deviceController');
const { auth, authorize, masterOnly } = require('../middleware/auth');

// Any authenticated user can register their device
router.post('/register', auth, ctrl.register);

// Admin only
router.get('/', auth, authorize('admin', 'manager'), ctrl.getAll);
router.get('/status', auth, authorize('admin', 'manager'), ctrl.getStatus);
router.patch('/:id/approve', auth, authorize('admin'), masterOnly, ctrl.approve);
router.patch('/:id/lock', auth, authorize('admin'), masterOnly, ctrl.lock);
router.patch('/:id/unlock', auth, authorize('admin'), masterOnly, ctrl.unlock);
router.patch('/:id/set-master', auth, authorize('admin'), ctrl.setMaster);
router.put('/:id', auth, authorize('admin'), ctrl.update);
router.delete('/:id', auth, authorize('admin'), masterOnly, ctrl.remove);

module.exports = router;
