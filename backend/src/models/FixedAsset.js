const mongoose = require('mongoose');

const fixedAssetSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, trim: true }, // Furniture, Equipment, Vehicle, etc.
  purchaseDate: { type: Date, required: true },
  purchasePrice: { type: Number, required: true, min: 0 },
  currentValue: { type: Number, default: 0 },
  depreciationRate: { type: Number, default: 10 }, // percentage per year
  depreciationMethod: { type: String, enum: ['straight_line', 'written_down'], default: 'straight_line' },
  salvageValue: { type: Number, default: 0 },
  location: { type: String, trim: true },
  serialNumber: { type: String, trim: true },
  status: { type: String, enum: ['active', 'sold', 'scrapped', 'disposed'], default: 'active' },
  disposalDate: { type: Date },
  disposalAmount: { type: Number },
  notes: { type: String, trim: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('FixedAsset', fixedAssetSchema);
