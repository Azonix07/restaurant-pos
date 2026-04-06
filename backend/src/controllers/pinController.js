const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Verify admin/manager PIN for sensitive operations
exports.verifyPin = async (req, res, next) => {
  try {
    const { pin, action, orderId } = req.body;
    if (!pin || pin.length !== 4) {
      return res.status(400).json({ message: '4-digit PIN required', verified: false });
    }

    const user = await User.findById(req.user._id).select('+pin');
    if (!user) return res.status(404).json({ message: 'User not found', verified: false });

    if (!user.pin) {
      return res.status(400).json({ message: 'PIN not set. Go to Settings to set your PIN.', verified: false });
    }

    const match = await user.comparePin(pin);
    if (!match) {
      await AuditLog.create({
        action: 'pin_failed',
        module: 'security',
        description: `Failed PIN attempt for "${action || 'unknown'}" by ${user.name}`,
        user: user._id,
        userName: user.name,
      });
      return res.status(401).json({ message: 'Invalid PIN', verified: false });
    }

    await AuditLog.create({
      action: 'pin_verified',
      module: 'security',
      documentId: orderId || undefined,
      description: `PIN verified for "${action || 'operation'}" by ${user.name}`,
      user: user._id,
      userName: user.name,
    });

    res.json({ verified: true, message: 'PIN verified' });
  } catch (error) {
    next(error);
  }
};

// Set or update PIN
exports.setPin = async (req, res, next) => {
  try {
    const { pin, currentPassword } = req.body;
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ message: 'PIN must be exactly 4 digits' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Require current password to set PIN
    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password required to set PIN' });
    }
    const passwordOk = await user.comparePassword(currentPassword);
    if (!passwordOk) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    const bcrypt = require('bcryptjs');
    user.pin = await bcrypt.hash(pin, 10);
    await user.save();

    await AuditLog.create({
      action: 'pin_set',
      module: 'security',
      description: `PIN ${user.pin ? 'updated' : 'set'} by ${user.name}`,
      user: user._id,
      userName: user.name,
    });

    res.json({ message: 'PIN set successfully' });
  } catch (error) {
    next(error);
  }
};
