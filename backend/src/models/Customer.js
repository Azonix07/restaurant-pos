const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  address: { type: String, trim: true },
  gstin: { type: String, trim: true },
  // Loyalty
  loyaltyPoints: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  tier: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum'],
    default: 'bronze',
  },
  // Preferences
  preferences: {
    isVeg: { type: Boolean },
    allergies: [{ type: String }],
    favoriteItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }],
    notes: { type: String },
  },
  // Dates
  dateOfBirth: { type: Date },
  anniversary: { type: Date },
  lastVisit: { type: Date },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

customerSchema.index({ phone: 1 });
customerSchema.index({ name: 'text', phone: 'text' });

// Update tier based on totalSpent
customerSchema.methods.updateTier = function () {
  if (this.totalSpent >= 100000) this.tier = 'platinum';
  else if (this.totalSpent >= 50000) this.tier = 'gold';
  else if (this.totalSpent >= 20000) this.tier = 'silver';
  else this.tier = 'bronze';
};

module.exports = mongoose.model('Customer', customerSchema);
