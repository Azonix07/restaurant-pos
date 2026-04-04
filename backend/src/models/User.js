const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role: {
    type: String,
    enum: ['admin', 'manager', 'cashier', 'waiter'],
    default: 'waiter',
  },
  phone: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  // Granular permissions managed by admin
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
  // Daily operational limits
  limits: {
    maxOrderValue: { type: Number, default: 0 }, // 0 = unlimited
    maxDailyDiscount: { type: Number, default: 0 }, // max total discount per day
    maxSingleDiscount: { type: Number, default: 0 }, // max discount per order
  },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
