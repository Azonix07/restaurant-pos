const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true }, // generated fingerprint
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['master', 'cashier_terminal', 'waiter_app', 'kitchen_display', 'bar_display'],
    default: 'cashier_terminal',
  },
  isMaster: { type: Boolean, default: false },
  ipAddress: { type: String, trim: true },
  macAddress: { type: String, trim: true },
  status: {
    type: String,
    enum: ['online', 'offline', 'locked'],
    default: 'offline',
  },
  isApproved: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  lockReason: { type: String },
  lastHeartbeat: { type: Date },
  lastSyncAt: { type: Date },
  socketId: { type: String },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Kitchen section assignment for display devices
  kitchenSection: { type: String, enum: ['kitchen', 'veg_kitchen', 'nonveg_kitchen', 'bakery', 'bar', 'juice_counter', 'desserts', null], default: null },
  // LAN printer config for this device
  printerConfig: {
    ip: { type: String },
    port: { type: Number, default: 9100 },
    enabled: { type: Boolean, default: false },
  },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

deviceSchema.index({ status: 1 });
deviceSchema.index({ isMaster: 1 });
deviceSchema.index({ lastHeartbeat: 1 });

module.exports = mongoose.model('Device', deviceSchema);
