const router = require('express').Router();
const ctrl = require('../controllers/holdController');
const { auth } = require('../middleware/auth');

router.get('/', auth, ctrl.getHeldOrders);
router.post('/', auth, ctrl.holdOrder);
router.post('/:id/resume', auth, ctrl.resumeOrder);
router.delete('/:id', auth, ctrl.cancelHeld);

module.exports = router;
