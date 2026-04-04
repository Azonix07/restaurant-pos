const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  prices: {
    retail: { type: Number },
    wholesale: { type: Number },
    online: { type: Number },
    special: { type: Number },
  },
  description: { type: String, trim: true },
  image: { type: String },
  hsn: { type: String, trim: true },
  sku: { type: String, trim: true },
  barcode: { type: String, trim: true },
  unit: { type: String, default: 'pcs', trim: true },
  gstCategory: {
    type: String,
    enum: ['food_non_ac', 'food_ac', 'beverage', 'alcohol'],
    default: 'food_non_ac',
  },
  isVeg: { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: true },
  preparationTime: { type: Number, default: 15 }, // minutes
  kitchenSection: {
    type: String,
    enum: ['kitchen', 'bakery', 'bar', 'desserts'],
    default: 'kitchen',
  },
  stock: { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 10 },
  tags: [{ type: String, trim: true }],
  customFields: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

menuItemSchema.index({ category: 1, isAvailable: 1 });
menuItemSchema.index({ name: 'text', tags: 'text' });

module.exports = mongoose.model('MenuItem', menuItemSchema);
