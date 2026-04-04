const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'split'],
    required: true,
  },
  splitDetails: [{
    method: { type: String, enum: ['cash', 'card', 'upi'] },
    amount: { type: Number },
  }],
  status: {
    type: String,
    enum: ['completed', 'refunded', 'failed'],
    default: 'completed',
  },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
