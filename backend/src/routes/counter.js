const router = require('express').Router();
const ctrl = require('../controllers/counterController');
const { auth, authorize } = require('../middleware/auth');

router.post('/open', auth, authorize('admin', 'manager', 'cashier'), ctrl.openSession);
router.get('/current', auth, ctrl.getCurrentSession);
router.post('/close', auth, authorize('admin', 'manager', 'cashier'), ctrl.closeSession);
router.get('/history', auth, authorize('admin', 'manager'), ctrl.getSessionHistory);
router.get('/financial-year', auth, authorize('admin', 'manager'), ctrl.getFinancialYearSummary);
router.patch('/:id/verify', auth, authorize('admin', 'manager'), ctrl.verifySession);

module.exports = router;
