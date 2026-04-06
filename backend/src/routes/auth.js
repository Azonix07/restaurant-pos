const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { auth, authorize } = require('../middleware/auth');

router.post('/register', auth, authorize('admin'), ctrl.register);
router.post('/login', ctrl.login);
router.get('/profile', auth, ctrl.getProfile);
router.get('/me', auth, ctrl.getProfile);
router.get('/users', auth, authorize('admin', 'manager'), ctrl.getUsers);
router.put('/users/:id', auth, authorize('admin'), ctrl.updateUser);
router.post('/verify-pin', auth, ctrl.verifyPin);
router.get('/permission-templates', auth, authorize('admin'), ctrl.getPermissionTemplates);
router.post('/users/:id/apply-template', auth, authorize('admin'), ctrl.applyPermissionTemplate);
router.get('/users/:id/activity', auth, authorize('admin', 'manager'), ctrl.getUserActivity);

module.exports = router;
