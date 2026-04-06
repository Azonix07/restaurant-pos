const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  gstin: { type: String, trim: true },
  address: { type: String, trim: true },
  contactPerson: { type: String, trim: true },
  category: {
    type: String,
    enum: ['vegetables', 'dairy', 'meat', 'spices', 'bakery', 'beverages', 'packaging', 'cleaning', 'other'],
    default: 'other',
  },
  paymentTerms: { type: String, trim: true }, // e.g. "Net 30"
  currentBalance: { type: Number, default: 0 }, // positive = we owe them
  isActive: { type: Boolean, default: true },
  notes: { type: String, trim: true },
  // Performance tracking
  rating: { type: Number, min: 1, max: 5, default: 3 },
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  lastOrderDate: { type: Date },
}, { timestamps: true });

supplierSchema.index({ name: 'text' });
supplierSchema.index({ isActive: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
