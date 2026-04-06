const router = require('express').Router();
const ctrl = require('../controllers/tokenController');
const { auth } = require('../middleware/auth');

router.get('/', auth, ctrl.getTodayTokens);
router.get('/display', ctrl.getDisplayBoard); // No auth — public customer display
router.post('/', auth, ctrl.createToken);
router.patch('/:id/status', auth, ctrl.updateStatus);
router.post('/:id/call', auth, ctrl.callToken);

module.exports = router;
