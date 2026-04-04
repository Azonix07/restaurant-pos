const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // create, update, delete, cancel, login, etc.
  module: { type: String, required: true }, // order, invoice, party, menu, etc.
  documentId: { type: mongoose.Schema.Types.ObjectId },
  documentNumber: { type: String },
  description: { type: String },
  changes: { type: mongoose.Schema.Types.Mixed }, // { field: { old, new } }
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String },
  ipAddress: { type: String },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ module: 1, action: 1 });
auditLogSchema.index({ user: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
