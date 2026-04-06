const mongoose = require('mongoose');

const heldOrderSchema = new mongoose.Schema({
  holdNumber: { type: String, required: true, unique: true },
  // Snapshot of the order at time of hold
  items: [{
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    gstRate: { type: Number, default: 5 },
    notes: { type: String },
  }],
  table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
  tableNumber: { type: Number },
  type: { type: String, enum: ['dine_in', 'takeaway', 'delivery'], default: 'dine_in' },
  customerName: { type: String, trim: true },
  customerPhone: { type: String, trim: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  notes: { type: String, trim: true },
  holdReason: { type: String, trim: true },
  heldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  heldByName: { type: String },
  status: {
    type: String,
    enum: ['held', 'resumed', 'expired'],
    default: 'held',
  },
  resumedAt: { type: Date },
  resumedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, // linked order when resumed
  expiresAt: { type: Date }, // auto-expire after 24h
}, { timestamps: true });

heldOrderSchema.index({ status: 1, createdAt: -1 });
heldOrderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL

module.exports = mongoose.model('HeldOrder', heldOrderSchema);
