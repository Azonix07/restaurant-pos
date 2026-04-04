const router = require('express').Router();
const ctrl = require('../controllers/invoiceController');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, ctrl.getAll);
router.get('/:id', auth, ctrl.getById);
router.post('/', auth, authorize('admin', 'manager', 'cashier'), ctrl.create);
router.put('/:id', auth, authorize('admin', 'manager'), ctrl.update);
router.delete('/:id', auth, authorize('admin'), ctrl.remove);

// Combine orders
router.post('/combine-orders', auth, authorize('admin', 'manager', 'cashier'), ctrl.combineOrders);

// Cancel
router.post('/:id/cancel', auth, authorize('admin', 'manager'), ctrl.cancelInvoice);

// E-Invoice & E-Way Bill
router.post('/:id/e-invoice', auth, authorize('admin', 'manager'), ctrl.generateEInvoice);
router.post('/:id/e-way-bill', auth, authorize('admin', 'manager'), ctrl.generateEWayBill);

// WhatsApp
router.post('/:id/whatsapp', auth, ctrl.sendWhatsAppInvoice);

// Payment
router.post('/:id/payment', auth, authorize('admin', 'manager', 'cashier'), ctrl.recordPayment);

module.exports = router;
