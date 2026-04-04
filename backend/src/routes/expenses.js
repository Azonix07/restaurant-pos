const router = require('express').Router();
const ctrl = require('../controllers/expenseController');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, authorize('admin', 'manager'), ctrl.getAll);
router.get('/summary', auth, authorize('admin', 'manager'), ctrl.getSummary);
router.post('/', auth, authorize('admin', 'manager'), ctrl.create);
router.put('/:id', auth, authorize('admin', 'manager'), ctrl.update);
router.delete('/:id', auth, authorize('admin'), ctrl.remove);

module.exports = router;
