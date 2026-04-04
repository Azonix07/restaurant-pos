const mongoose = require('mongoose');

const counterSessionSchema = new mongoose.Schema({
  // Session identification
  sessionDate: { type: String, required: true }, // YYYY-MM-DD
  shiftNumber: { type: Number, default: 1 },
  
  // Opening
  openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  openedAt: { type: Date, default: Date.now },
  openingCash: { type: Number, required: true, min: 0 },
  
  // System-tracked totals (auto-calculated)
  systemCash: { type: Number, default: 0 },
  systemCard: { type: Number, default: 0 },
  systemUPI: { type: Number, default: 0 },
  systemTotal: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  totalRefunds: { type: Number, default: 0 },
  totalDiscounts: { type: Number, default: 0 },
  totalExpenses: { type: Number, default: 0 },
  gstCollected: { type: Number, default: 0 },
  
  // Manual closing declaration
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  closedAt: { type: Date },
  declaredCash: { type: Number },
  declaredCard: { type: Number },
  declaredUPI: { type: Number },
  
  // Variance / discrepancy
  cashVariance: { type: Number, default: 0 }, // declaredCash - (openingCash + systemCash)
  varianceNote: { type: String, trim: true },
  
  // Status
  status: {
    type: String,
    enum: ['open', 'closing', 'closed', 'verified'],
    default: 'open',
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  
  // Financial year (April to March for India)
  financialYear: { type: String }, // e.g., "2024-25"
  
  notes: { type: String, trim: true },
}, { timestamps: true });

counterSessionSchema.index({ sessionDate: 1, shiftNumber: 1 }, { unique: true });
counterSessionSchema.index({ status: 1 });
counterSessionSchema.index({ financialYear: 1 });

// Calculate the financial year string from a date
counterSessionSchema.statics.getFinancialYear = function (date) {
  const d = date || new Date();
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  if (month >= 3) { // April onwards
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
};

module.exports = mongoose.model('CounterSession', counterSessionSchema);
