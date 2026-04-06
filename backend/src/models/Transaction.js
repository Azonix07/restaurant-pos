const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'split', 'company'],
    required: true,
  },
  splitDetails: [{
    method: { type: String, enum: ['cash', 'card', 'upi'] },
    amount: { type: Number },
  }],
  // Company credit details
  companyDetails: {
    companyName: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    referenceNumber: { type: String, trim: true },
  },
  denomination: {
    notes2000: { type: Number, default: 0 },
    notes500: { type: Number, default: 0 },
    notes200: { type: Number, default: 0 },
    notes100: { type: Number, default: 0 },
    notes50: { type: Number, default: 0 },
    notes20: { type: Number, default: 0 },
    notes10: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
    totalReceived: { type: Number, default: 0 },
    changeToReturn: { type: Number, default: 0 },
  },
  status: {
    type: String,
    enum: ['completed', 'refunded', 'failed'],
    default: 'completed',
  },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
