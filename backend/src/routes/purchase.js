const router = require('express').Router();
const ctrl = require('../controllers/supplierController');
const { auth, authorize } = require('../middleware/auth');

// Suppliers
router.get('/suppliers', auth, ctrl.getSuppliers);
router.post('/suppliers', auth, authorize('admin', 'manager'), ctrl.createSupplier);
router.put('/suppliers/:id', auth, authorize('admin', 'manager'), ctrl.updateSupplier);

// Purchase Orders
router.get('/orders', auth, ctrl.getPurchaseOrders);
router.post('/orders', auth, authorize('admin', 'manager'), ctrl.createPurchaseOrder);
router.post('/orders/:id/receive', auth, authorize('admin', 'manager'), ctrl.receiveGoods);
router.post('/orders/:id/payment', auth, authorize('admin', 'manager'), ctrl.recordPayment);

module.exports = router;
