const router = require('express').Router();
const ctrl = require('../controllers/companyController');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, authorize('admin'), ctrl.getAll);
router.get('/:id', auth, authorize('admin'), ctrl.getById);
router.post('/', auth, authorize('admin'), ctrl.create);
router.put('/:id', auth, authorize('admin'), ctrl.update);
router.patch('/:id/default', auth, authorize('admin'), ctrl.setDefault);
router.delete('/:id', auth, authorize('admin'), ctrl.remove);

module.exports = router;
