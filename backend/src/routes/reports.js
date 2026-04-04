const router = require('express').Router();
const ctrl = require('../controllers/reportController');
const { auth, authorize } = require('../middleware/auth');

router.get('/daily', auth, authorize('admin', 'manager', 'cashier'), ctrl.getDailySummary);
router.get('/sales', auth, authorize('admin', 'manager'), ctrl.getSalesReport);
router.get('/items', auth, authorize('admin', 'manager'), ctrl.getItemWiseSales);
router.get('/tax', auth, authorize('admin', 'manager'), ctrl.getTaxReport);
router.get('/profit-loss', auth, authorize('admin', 'manager'), ctrl.getProfitLoss);

module.exports = router;
