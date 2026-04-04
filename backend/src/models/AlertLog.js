const mongoose = require('mongoose');

const alertLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['device_disconnect', 'low_stock', 'high_wastage', 'bill_mismatch', 'no_sales_activity', 'fraud_attempt'],
    required: true,
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'warning',
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  // Context
  device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  relatedDocument: { type: mongoose.Schema.Types.ObjectId, refPath: 'relatedModel' },
  relatedModel: { type: String, enum: ['Device', 'Order', 'RawMaterial', 'WastageEntry', 'BillSequence', null] },
  metadata: { type: mongoose.Schema.Types.Mixed },
  // Resolution
  isResolved: { type: Boolean, default: false },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
  resolution: { type: String },
}, { timestamps: true });

alertLogSchema.index({ type: 1, isResolved: 1 });
alertLogSchema.index({ createdAt: -1 });
alertLogSchema.index({ severity: 1 });

module.exports = mongoose.model('AlertLog', alertLogSchema);
