const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  // Singleton — only one document
  _id: { type: String, default: 'system' },

  // Rush Mode
  rushMode: {
    enabled: { type: Boolean, default: false },
    enabledAt: Date,
    enabledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    autoKOT: { type: Boolean, default: true },
    autoAssignTables: { type: Boolean, default: true },
    disableImages: { type: Boolean, default: true },
    disableAnimations: { type: Boolean, default: true },
    disableEditOldBills: { type: Boolean, default: true },
    disableComplexDiscounts: { type: Boolean, default: true },
    disableReports: { type: Boolean, default: true },
    skipKOTConfirmation: { type: Boolean, default: true },
  },

  // Test Mode
  testMode: {
    enabled: { type: Boolean, default: false },
    enabledAt: Date,
    enabledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    autoDisableAt: Date, // auto-disable after 1 hour
    testDbPrefix: { type: String, default: 'test_' },
  },

  // UI Mode
  uiMode: {
    type: String,
    enum: ['beginner', 'advanced'],
    default: 'advanced',
  },

  // Smart Alerts Config
  alerts: {
    lowStockEnabled: { type: Boolean, default: true },
    noSalesAlertMinutes: { type: Number, default: 60 },
    highDiscountThreshold: { type: Number, default: 15 },
    deadStockDays: { type: Number, default: 30 },
  },

}, { timestamps: true });

// Get or create singleton
systemSettingsSchema.statics.getInstance = async function () {
  let settings = await this.findById('system');
  if (!settings) {
    settings = await this.create({ _id: 'system' });
  }
  return settings;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
