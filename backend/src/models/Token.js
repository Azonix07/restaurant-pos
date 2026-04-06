const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  tokenNumber: { type: Number, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD for daily reset
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  orderNumber: { type: String },
  customerName: { type: String, trim: true },
  customerPhone: { type: String, trim: true },
  type: { type: String, enum: ['dine_in', 'takeaway', 'delivery'], default: 'takeaway' },
  status: {
    type: String,
    enum: ['waiting', 'preparing', 'ready', 'collected', 'cancelled'],
    default: 'waiting',
  },
  estimatedMinutes: { type: Number, default: 15 },
  calledAt: { type: Date },      // when "ready" was announced
  collectedAt: { type: Date },
  counter: { type: String, default: 'main' }, // which counter to collect from
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

tokenSchema.index({ date: 1, tokenNumber: 1 }, { unique: true });
tokenSchema.index({ status: 1, date: 1 });

// Static: get next token number for today
tokenSchema.statics.getNextToken = async function () {
  const today = new Date().toISOString().split('T')[0];
  const last = await this.findOne({ date: today }).sort({ tokenNumber: -1 });
  return { number: (last?.tokenNumber || 0) + 1, date: today };
};

module.exports = mongoose.model('Token', tokenSchema);
