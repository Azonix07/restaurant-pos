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
  // Batch-wise stock tracking
  batches: [{
    batchNumber: { type: String, trim: true },
    quantity: { type: Number, default: 0 },
    costPerUnit: { type: Number, default: 0 },
    expiryDate: { type: Date },
    receivedDate: { type: Date, default: Date.now },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Party' },
    invoiceNumber: { type: String, trim: true },
  }],
  // Dead stock flag — no movement for 30+ days
  lastMovementDate: { type: Date, default: Date.now },
}, { timestamps: true });

rawMaterialSchema.index({ name: 'text', category: 'text' });
rawMaterialSchema.index({ currentStock: 1, minStock: 1 });
rawMaterialSchema.index({ barcode: 1 });

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);
