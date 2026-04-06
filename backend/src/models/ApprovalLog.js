const mongoose = require('mongoose');

const approvalLogSchema = new mongoose.Schema({
  // What needs approval
  action: {
    type: String,
    required: true,
    enum: ['refund', 'bill_edit', 'bill_delete', 'wastage', 'expiry_write_off', 'discount_override', 'order_cancel', 'price_change'],
  },
  module: { type: String, required: true },
  documentId: { type: mongoose.Schema.Types.ObjectId },
  documentNumber: { type: String },
  description: { type: String, required: true },

  // Approval status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending',
  },

  // Who requested
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestedByName: { type: String },

  // Who approved/rejected
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedByName: { type: String },
  rejectionReason: { type: String, trim: true },

  // PIN verification
  pinVerified: { type: Boolean, default: false },
  failedPinAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },

  // Metadata — store any extra data about the request
  metadata: { type: mongoose.Schema.Types.Mixed },

  processedAt: { type: Date },
  expiresAt: { type: Date }, // auto-expire after 30 minutes
}, { timestamps: true });

approvalLogSchema.index({ status: 1, createdAt: -1 });
approvalLogSchema.index({ requestedBy: 1 });
approvalLogSchema.index({ action: 1, status: 1 });

module.exports = mongoose.model('ApprovalLog', approvalLogSchema);
