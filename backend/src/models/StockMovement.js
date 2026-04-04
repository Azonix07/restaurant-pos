const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  rawMaterial: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
  type: {
    type: String,
    enum: ['in', 'out', 'wastage', 'production', 'adjustment', 'sale'],
    required: true,
  },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  previousStock: { type: Number, required: true },
  newStock: { type: Number, required: true },
  costPerUnit: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  // References
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
  wastageEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'WastageEntry' },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Party' },
  // Tracking
  reason: { type: String, trim: true },
  invoiceNumber: { type: String, trim: true },
  batchNumber: { type: String, trim: true },
  expiryDate: { type: Date },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

stockMovementSchema.index({ rawMaterial: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
