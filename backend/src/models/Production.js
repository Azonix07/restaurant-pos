const mongoose = require('mongoose');

const productionItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
  name: { type: String, required: true },
  plannedQuantity: { type: Number, required: true, min: 1 },
  actualQuantity: { type: Number, default: 0 },
  wastageQuantity: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['planned', 'in_progress', 'completed', 'cancelled'],
    default: 'planned',
  },
  startedAt: { type: Date },
  completedAt: { type: Date },
  notes: { type: String, trim: true },
}, { _id: true });

const productionSchema = new mongoose.Schema({
  batchNumber: { type: String, required: true, unique: true },
  section: {
    type: String,
    enum: ['kitchen', 'bakery', 'bar', 'desserts'],
    default: 'bakery',
  },
  items: [productionItemSchema],
  status: {
    type: String,
    enum: ['planned', 'in_progress', 'completed', 'cancelled'],
    default: 'planned',
  },
  scheduledDate: { type: Date, required: true },
  startedAt: { type: Date },
  completedAt: { type: Date },
  // Raw materials consumed (auto from recipes)
  materialsConsumed: [{
    rawMaterial: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
    name: { type: String },
    quantity: { type: Number },
    unit: { type: String },
  }],
  totalCost: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, trim: true },
}, { timestamps: true });

productionSchema.index({ scheduledDate: 1, section: 1 });
productionSchema.index({ status: 1 });

module.exports = mongoose.model('Production', productionSchema);
