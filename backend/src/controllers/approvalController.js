const ApprovalLog = require('../models/ApprovalLog');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const MAX_PIN_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 15;
const APPROVAL_EXPIRY_MINUTES = 30;

// Request approval for a sensitive action
exports.requestApproval = async (req, res, next) => {
  try {
    const { action, module, documentId, documentNumber, description, metadata } = req.body;
    if (!action || !module || !description) {
      return res.status(400).json({ message: 'action, module, and description are required' });
    }

    const approval = await ApprovalLog.create({
      action,
      module,
      documentId,
      documentNumber,
      description,
      metadata,
      requestedBy: req.user._id,
      requestedByName: req.user.name,
      expiresAt: new Date(Date.now() + APPROVAL_EXPIRY_MINUTES * 60 * 1000),
    });

    // Notify managers/admins via socket
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('approval:new', { approval });
      io.to('manager').emit('approval:new', { approval });
    }

    res.status(201).json({ approval, message: 'Approval requested. Awaiting manager/admin PIN.' });
  } catch (error) {
    next(error);
  }
};

// Approve with PIN verification (3-attempt lockout)
exports.approve = async (req, res, next) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ message: 'PIN is required' });

    const approval = await ApprovalLog.findById(req.params.id);
    if (!approval) return res.status(404).json({ message: 'Approval request not found' });
    if (approval.status !== 'pending') {
      return res.status(400).json({ message: `Already ${approval.status}` });
    }

    // Check if approval has expired
    if (approval.expiresAt && new Date() > approval.expiresAt) {
      approval.status = 'expired';
      await approval.save();
      return res.status(400).json({ message: 'Approval request has expired' });
    }

    // Check PIN lockout on the approval
    if (approval.lockedUntil && new Date() < approval.lockedUntil) {
      const minsLeft = Math.ceil((approval.lockedUntil - Date.now()) / 60000);
      return res.status(423).json({ message: `Locked due to failed attempts. Try again in ${minsLeft} minutes.` });
    }

    // Verify PIN against the approving user (must be admin/manager)
    const approver = await User.findById(req.user._id).select('+pin');
    if (!approver || !approver.pin) {
      return res.status(400).json({ message: 'No PIN set for your account' });
    }

    // Check user-level PIN lockout
    if (approver.pinLockedUntil && new Date() < approver.pinLockedUntil) {
      const minsLeft = Math.ceil((approver.pinLockedUntil - Date.now()) / 60000);
      return res.status(423).json({ message: `Your PIN is locked. Try again in ${minsLeft} minutes.` });
    }

    const pinValid = await approver.comparePin(pin);
    if (!pinValid) {
      approval.failedPinAttempts += 1;
      approver.failedPinAttempts = (approver.failedPinAttempts || 0) + 1;

      // Lock after MAX_PIN_ATTEMPTS
      if (approval.failedPinAttempts >= MAX_PIN_ATTEMPTS) {
        approval.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      }
      if (approver.failedPinAttempts >= MAX_PIN_ATTEMPTS) {
        approver.pinLockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      }

      await approval.save();
      await approver.save();

      const remaining = MAX_PIN_ATTEMPTS - approval.failedPinAttempts;
      if (remaining <= 0) {
        return res.status(423).json({ message: `PIN locked for ${LOCKOUT_MINUTES} minutes after ${MAX_PIN_ATTEMPTS} failed attempts` });
      }
      return res.status(403).json({ message: `Invalid PIN. ${remaining} attempt(s) remaining.` });
    }

    // PIN valid — approve
    approver.failedPinAttempts = 0;
    approver.pinLockedUntil = null;
    await approver.save();

    approval.status = 'approved';
    approval.approvedBy = req.user._id;
    approval.approvedByName = req.user.name;
    approval.pinVerified = true;
    approval.processedAt = new Date();
    approval.failedPinAttempts = 0;
    approval.lockedUntil = null;
    await approval.save();

    await AuditLog.create({
      action: 'approval_granted',
      module: approval.module,
      documentId: approval.documentId,
      documentNumber: approval.documentNumber,
      description: `${approval.action} approved by ${req.user.name} (PIN verified)`,
      user: req.user._id,
      userName: req.user.name,
    });

    const io = req.app.get('io');
    if (io) io.emit('approval:resolved', { approval });

    res.json({ approval, message: 'Approved successfully' });
  } catch (error) {
    next(error);
  }
};

// Reject approval
exports.reject = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const approval = await ApprovalLog.findById(req.params.id);
    if (!approval) return res.status(404).json({ message: 'Approval request not found' });
    if (approval.status !== 'pending') {
      return res.status(400).json({ message: `Already ${approval.status}` });
    }

    approval.status = 'rejected';
    approval.approvedBy = req.user._id;
    approval.approvedByName = req.user.name;
    approval.rejectionReason = reason || 'No reason provided';
    approval.processedAt = new Date();
    await approval.save();

    await AuditLog.create({
      action: 'approval_rejected',
      module: approval.module,
      documentId: approval.documentId,
      description: `${approval.action} rejected by ${req.user.name}. Reason: ${reason || 'None'}`,
      user: req.user._id,
      userName: req.user.name,
    });

    const io = req.app.get('io');
    if (io) io.emit('approval:resolved', { approval });

    res.json({ approval, message: 'Rejected' });
  } catch (error) {
    next(error);
  }
};

// Get pending approvals (for manager/admin dashboard)
exports.getPending = async (req, res, next) => {
  try {
    // Auto-expire old requests
    await ApprovalLog.updateMany(
      { status: 'pending', expiresAt: { $lt: new Date() } },
      { $set: { status: 'expired' } }
    );

    const approvals = await ApprovalLog.find({ status: 'pending' })
      .populate('requestedBy', 'name role')
      .sort({ createdAt: -1 });

    res.json({ approvals, count: approvals.length });
  } catch (error) {
    next(error);
  }
};

// Get approval history
exports.getHistory = async (req, res, next) => {
  try {
    const { action, status, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const approvals = await ApprovalLog.find(filter)
      .populate('requestedBy', 'name role')
      .populate('approvedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ApprovalLog.countDocuments(filter);
    res.json({ approvals, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};
