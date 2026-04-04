const mongoose = require('mongoose');

const recycleBinSchema = new mongoose.Schema({
  originalModel: { type: String, required: true }, // 'Invoice', 'Party', 'MenuItem', etc.
  originalId: { type: mongoose.Schema.Types.ObjectId, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedByName: { type: String },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 86400000) }, // 30 days
}, { timestamps: true });

recycleBinSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
recycleBinSchema.index({ originalModel: 1, createdAt: -1 });

module.exports = mongoose.model('RecycleBin', recycleBinSchema);
