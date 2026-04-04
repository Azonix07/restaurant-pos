const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  number: { type: Number, required: true, unique: true },
  name: { type: String, trim: true },
  capacity: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['available', 'occupied', 'reserved', 'cleaning'],
    default: 'available',
  },
  section: { type: String, trim: true, default: 'Main' },
  currentOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  qrCode: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Table', tableSchema);
