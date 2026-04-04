const mongoose = require('mongoose');

const kotItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  notes: { type: String, trim: true },
  status: {
    type: String,
    enum: ['pending', 'acknowledged', 'preparing', 'completed', 'cancelled'],
    default: 'pending',
  },
  // Track if this is a delta (additional items) KOT
  isDelta: { type: Boolean, default: false },
}, { _id: true });

const kotSchema = new mongoose.Schema({
  kotNumber: { type: String, required: true, unique: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNumber: { type: String, required: true },
  tableNumber: { type: Number },
  section: {
    type: String,
    enum: ['kitchen', 'bakery', 'bar', 'desserts'],
    required: true,
  },
  items: [kotItemSchema],
  status: {
    type: String,
    enum: ['pending', 'acknowledged', 'preparing', 'completed', 'cancelled'],
    default: 'pending',
  },
  isDelta: { type: Boolean, default: false }, // true if this is an addendum KOT
  printedAt: { type: Date },
  printerIp: { type: String },
  printCount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedAt: { type: Date },
}, { timestamps: true });

kotSchema.index({ order: 1, section: 1 });
kotSchema.index({ status: 1, section: 1 });
kotSchema.index({ kotNumber: 1 });

module.exports = mongoose.model('KOT', kotSchema);
