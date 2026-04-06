const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
  refundNumber: { type: String, required: true, unique: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNumber: { type: String, required: true },
  billNumber: { type: String },
  type: {
    type: String,
    enum: ['full', 'partial'],
    required: true,
  },
  // For partial refunds — which items are being refunded
  items: [{
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name: { type: String },
    quantity: { type: Number },
    price: { type: Number },
    refundAmount: { type: Number },
  }],
  originalAmount: { type: Number, required: true },
  refundAmount: { type: Number, required: true },
  reason: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending',
  },
  // Approval chain
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestedByName: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedByName: { type: String },
  approvalPin: { type: Boolean, default: false }, // was PIN used to approve
  rejectionReason: { type: String },
  // Payment
  refundMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'original'],
    default: 'original',
  },
  processedAt: { type: Date },
}, { timestamps: true });

refundSchema.index({ order: 1 });
refundSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Refund', refundSchema);
