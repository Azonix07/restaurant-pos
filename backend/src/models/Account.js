const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    required: true,
    enum: ['asset', 'liability', 'equity', 'income', 'expense'],
  },
  subType: { type: String, trim: true }, // e.g., 'current_asset', 'fixed_asset', 'bank', 'cash'
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  description: { type: String, trim: true },
  openingBalance: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },
  isSystemAccount: { type: Boolean, default: false }, // prevent deletion
  isActive: { type: Boolean, default: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
}, { timestamps: true });

accountSchema.index({ type: 1, isActive: 1 });
accountSchema.index({ code: 1 });

module.exports = mongoose.model('Account', accountSchema);
