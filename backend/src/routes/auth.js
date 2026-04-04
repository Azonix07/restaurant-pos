const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { auth, authorize } = require('../middleware/auth');

router.post('/register', auth, authorize('admin'), ctrl.register);
router.post('/login', ctrl.login);
router.get('/profile', auth, ctrl.getProfile);
router.get('/me', auth, ctrl.getProfile);
router.get('/users', auth, authorize('admin', 'manager'), ctrl.getUsers);
router.put('/users/:id', auth, authorize('admin'), ctrl.updateUser);

module.exports = router;
