const mongoose = require('mongoose');

const wastageEntrySchema = new mongoose.Schema({
  rawMaterial: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },
  estimatedCost: { type: Number, default: 0 },
  reason: {
    type: String,
    enum: ['expired', 'damaged', 'spillage', 'overproduction', 'returned', 'quality_issue', 'other'],
    required: true,
  },
  description: { type: String, trim: true },
  // Approval chain
  supervisorPin: { type: String }, // hashed PIN
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  // Photo proof (base64 or file path for mobile)
  photoProof: { type: String },
  // Audit
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
}, { timestamps: true });

wastageEntrySchema.index({ createdAt: -1 });
wastageEntrySchema.index({ approvalStatus: 1 });
wastageEntrySchema.index({ rawMaterial: 1 });

module.exports = mongoose.model('WastageEntry', wastageEntrySchema);
