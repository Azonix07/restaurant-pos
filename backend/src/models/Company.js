const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  legalName: { type: String, trim: true },
  gstin: { type: String, trim: true },
  pan: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true },
  address: {
    street: String, line1: String, line2: String, city: String, state: String, pincode: String,
  },
  logo: { type: String },
  invoicePrefix: { type: String, default: 'INV' },
  financialYearStart: { type: Number, default: 4 }, // April
  currency: { type: String, default: 'INR' },
  removeBranding: { type: Boolean, default: false },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
