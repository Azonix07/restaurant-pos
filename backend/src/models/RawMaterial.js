const mongoose = require('mongoose');

const rawMaterialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  unit: { type: String, required: true, default: 'kg', trim: true }, // kg, litre, pcs, etc.
  currentStock: { type: Number, default: 0, min: 0 },
  minStock: { type: Number, default: 0 },
  maxStock: { type: Number },
  costPerUnit: { type: Number, default: 0, min: 0 },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Party' },
  hsn: { type: String, trim: true },
  barcode: { type: String, trim: true },
  gstRate: { type: Number, default: 5 },
  lastPurchaseDate: { type: Date },
  lastPurchasePrice: { type: Number },
  expiryDate: { type: Date },
  storageLocation: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

rawMaterialSchema.index({ name: 'text', category: 'text' });
rawMaterialSchema.index({ currentStock: 1, minStock: 1 });
rawMaterialSchema.index({ barcode: 1 });

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);
