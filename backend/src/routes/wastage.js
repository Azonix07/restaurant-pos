const router = require('express').Router();
const ctrl = require('../controllers/wastageController');
const { auth, authorize, masterOnly } = require('../middleware/auth');

router.get('/', auth, authorize('admin', 'manager'), ctrl.getAll);
router.get('/analytics', auth, authorize('admin', 'manager'), ctrl.getAnalytics);
router.post('/', auth, ctrl.create); // any staff can report wastage
router.patch('/:id/approve', auth, authorize('admin', 'manager'), masterOnly, ctrl.approve);
router.patch('/:id/reject', auth, authorize('admin', 'manager'), masterOnly, ctrl.reject);

module.exports = router;
