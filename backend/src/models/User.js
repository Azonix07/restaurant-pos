const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  // Legacy role field kept for backward compatibility
  role: {
    type: String,
    enum: ['admin', 'manager', 'cashier', 'waiter'],
    default: 'waiter',
  },
  // Dynamic role reference — takes priority over legacy role when set
  customRole: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  phone: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  // Legacy boolean permissions (backward compatible)
  permissions: {
    canEditPrice: { type: Boolean, default: false },
    canGiveDiscount: { type: Boolean, default: false },
    maxDiscountPercent: { type: Number, default: 0 },
    canCancelOrder: { type: Boolean, default: false },
    canDeleteKOT: { type: Boolean, default: false },
    canViewReports: { type: Boolean, default: false },
    canExportData: { type: Boolean, default: false },
    canModifyMenu: { type: Boolean, default: false },
    canManageInventory: { type: Boolean, default: false },
    canProcessRefund: { type: Boolean, default: false },
    canOpenCounter: { type: Boolean, default: false },
    canCloseCounter: { type: Boolean, default: false },
  },
  // Granular string-based permissions: ['billing.create', 'order.view', ...]
  // Used when customRole is set, or can be overridden per-user
  grantedPermissions: [{ type: String, trim: true }],
  // Daily operational limits
  limits: {
    maxOrderValue: { type: Number, default: 0 }, // 0 = unlimited
    maxDailyDiscount: { type: Number, default: 0 }, // max total discount per day
    maxSingleDiscount: { type: Number, default: 0 }, // max discount per order
  },
  // 4-digit PIN for authorizing sensitive operations
  pin: { type: String, select: false },
  // Token revocation: tokens issued before this date are invalid
  tokenRevokedAt: { type: Date },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.comparePin = async function (candidatePin) {
  if (!this.pin) return false;
  return bcrypt.compare(candidatePin, this.pin);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.pin;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
