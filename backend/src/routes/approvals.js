const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/approvalController');

router.use(auth);

// Any authenticated user can request approval
router.post('/request', ctrl.requestApproval);

// Only admin/manager can approve or reject
router.post('/:id/approve', authorize('admin', 'manager'), ctrl.approve);
router.post('/:id/reject', authorize('admin', 'manager'), ctrl.reject);

// Pending approvals (manager/admin dashboard)
router.get('/pending', authorize('admin', 'manager'), ctrl.getPending);

// Approval history
router.get('/history', authorize('admin', 'manager'), ctrl.getHistory);

module.exports = router;
