const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/exportController');

// Daily Summary
router.get('/reports/daily/pdf', auth, ctrl.dailySummaryPdf);
router.get('/reports/daily/excel', auth, ctrl.dailySummaryExcel);

// Sales Report
router.get('/reports/sales/pdf', auth, ctrl.salesReportPdf);
router.get('/reports/sales/excel', auth, ctrl.salesReportExcel);

// Item-wise Sales
router.get('/reports/items/pdf', auth, ctrl.itemSalesPdf);
router.get('/reports/items/excel', auth, ctrl.itemSalesExcel);

// Tax Report
router.get('/reports/tax/pdf', auth, ctrl.taxReportPdf);
router.get('/reports/tax/excel', auth, ctrl.taxReportExcel);

// Invoices
router.get('/invoices/pdf', auth, ctrl.invoicesPdf);
router.get('/invoices/excel', auth, ctrl.invoicesExcel);

// GST Reports
router.get('/gst/pdf', auth, ctrl.gstReportPdf);
router.get('/gst/excel', auth, ctrl.gstReportExcel);

// Bills
router.get('/bills/pdf', auth, ctrl.billsPdf);
router.get('/bills/excel', auth, ctrl.billsExcel);

// Counter History
router.get('/counter/pdf', auth, ctrl.counterHistoryPdf);
router.get('/counter/excel', auth, ctrl.counterHistoryExcel);

module.exports = router;
