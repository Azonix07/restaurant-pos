const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  // Granular string-based permissions: e.g. 'billing.create', 'billing.refund', 'inventory.update'
  permissions: [{ type: String, trim: true }],
  // Daily operational limits for users with this role
  limits: {
    maxOrderValue: { type: Number, default: 0 },
    maxDailyDiscount: { type: Number, default: 0 },
    maxSingleDiscount: { type: Number, default: 0 },
    maxDiscountPercent: { type: Number, default: 0 },
  },
  isSystem: { type: Boolean, default: false }, // true for 'admin' — cannot be deleted
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// All available permissions in the system
roleSchema.statics.ALL_PERMISSIONS = [
  // Billing
  'billing.create', 'billing.edit', 'billing.refund', 'billing.discount',
  'billing.cancel', 'billing.reprint', 'billing.split', 'billing.hold',
  // Orders
  'order.create', 'order.edit', 'order.cancel', 'order.view',
  // KOT
  'kot.create', 'kot.edit', 'kot.delete', 'kot.view',
  // Menu
  'menu.view', 'menu.create', 'menu.edit', 'menu.delete', 'menu.price_edit',
  // Inventory
  'inventory.view', 'inventory.update', 'inventory.purchase', 'inventory.wastage',
  // Stock
  'stock.view', 'stock.in', 'stock.out', 'stock.adjust',
  // Reports
  'reports.view', 'reports.export', 'reports.sales', 'reports.inventory', 'reports.staff',
  // Customers
  'customer.view', 'customer.create', 'customer.edit',
  // Counter
  'counter.open', 'counter.close', 'counter.view',
  // Tables
  'table.view', 'table.manage', 'table.transfer',
  // Users
  'user.view', 'user.create', 'user.edit', 'user.deactivate',
  // Settings
  'settings.view', 'settings.edit',
  // Devices
  'device.view', 'device.manage', 'device.lock',
  // Expenses
  'expense.view', 'expense.create', 'expense.approve',
  // Delivery
  'delivery.view', 'delivery.manage', 'delivery.assign',
  // System
  'system.backup', 'system.restore', 'system.mode_change', 'system.lock',
];

module.exports = mongoose.model('Role', roleSchema);
