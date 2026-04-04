const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  category: {
    type: String,
    required: true,
    enum: ['ingredients', 'salary', 'rent', 'utilities', 'maintenance', 'marketing', 'equipment', 'other'],
  },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  description: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

expenseSchema.index({ date: -1, category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
