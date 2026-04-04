const router = require('express').Router();
const ctrl = require('../controllers/accountingController');
const { auth, authorize } = require('../middleware/auth');

// Chart of Accounts
router.get('/accounts', auth, authorize('admin', 'manager'), ctrl.getAccounts);
router.post('/accounts', auth, authorize('admin'), ctrl.createAccount);
router.put('/accounts/:id', auth, authorize('admin'), ctrl.updateAccount);
router.delete('/accounts/:id', auth, authorize('admin'), ctrl.deleteAccount);

// Journal Entries
router.get('/journal', auth, authorize('admin', 'manager'), ctrl.getJournalEntries);
router.post('/journal', auth, authorize('admin', 'manager'), ctrl.createJournalEntry);

// Account Statement
router.get('/statement/:accountId', auth, authorize('admin', 'manager'), ctrl.getAccountStatement);

// Financial Reports
router.get('/balance-sheet', auth, authorize('admin', 'manager'), ctrl.getBalanceSheet);
router.get('/trial-balance', auth, authorize('admin', 'manager'), ctrl.getTrialBalance);
router.get('/profit-loss', auth, authorize('admin', 'manager'), ctrl.getProfitAndLoss);

module.exports = router;
