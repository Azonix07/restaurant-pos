const mongoose = require('mongoose');

const partyPricingSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  itemName: { type: String },
  customPrice: { type: Number, required: true, min: 0 },
});

const partySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['customer', 'supplier', 'both'], default: 'customer' },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  gstin: { type: String, trim: true },
  pan: { type: String, trim: true },
  billingAddress: {
    line1: String, line2: String, city: String, state: String, pincode: String,
  },
  shippingAddress: {
    line1: String, line2: String, city: String, state: String, pincode: String,
  },
  creditLimit: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 }, // positive = they owe us, negative = we owe them
  customPricing: [partyPricingSchema],
  paymentTermDays: { type: Number, default: 30 },
  lastReminderSent: { type: Date },
  notes: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

partySchema.index({ name: 'text', phone: 'text', email: 'text' });
partySchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model('Party', partySchema);
