const router = require('express').Router();
const ctrl = require('../controllers/gstrController');
const { auth, authorize } = require('../middleware/auth');

router.get('/gstr1', auth, authorize('admin', 'manager'), ctrl.getGSTR1);
router.get('/gstr3b', auth, authorize('admin', 'manager'), ctrl.getGSTR3B);

module.exports = router;
