const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Device = require('../models/Device');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.id).select('-password').populate('customRole');

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    // Token revocation check
    if (user.tokenRevokedAt && decoded.iat * 1000 < user.tokenRevokedAt.getTime()) {
      return res.status(401).json({ message: 'Token has been revoked. Please login again.' });
    }

    req.user = user;

    // Attach device info if device header is present
    const deviceId = req.headers['x-device-id'];
    if (deviceId) {
      const device = await Device.findOne({ deviceId, isApproved: true });
      if (device) {
        req.device = device;
        // Check if device is locked
        if (device.isLocked) {
          return res.status(403).json({
            message: 'Device is locked. Contact admin.',
            locked: true,
            reason: device.lockReason,
          });
        }
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Authorize by legacy role names OR dynamic role
const authorize = (...roles) => {
  return (req, res, next) => {
    // Admin always passes
    if (req.user.role === 'admin') return next();
    // Check legacy role
    if (roles.includes(req.user.role)) return next();
    // Check dynamic role name
    if (req.user.customRole && roles.includes(req.user.customRole.name)) return next();
    return res.status(403).json({ message: 'Insufficient permissions' });
  };
};

// Only allow master device to perform critical operations
const masterOnly = async (req, res, next) => {
  const deviceId = req.headers['x-device-id'];
  if (!deviceId) {
    // If no device header, check if user is admin (backward compatibility)
    if (req.user && req.user.role === 'admin') return next();
    return res.status(403).json({ message: 'This action requires master device access' });
  }
  const device = await Device.findOne({ deviceId });
  if (!device || !device.isMaster) {
    return res.status(403).json({ message: 'This action can only be performed from the master device' });
  }
  next();
};

// Validate that device is registered and approved
const requireDevice = async (req, res, next) => {
  const deviceId = req.headers['x-device-id'];
  if (!deviceId) {
    return res.status(400).json({ message: 'Device identification required (X-Device-Id header)' });
  }
  const device = await Device.findOne({ deviceId });
  if (!device) {
    return res.status(403).json({ message: 'Unregistered device. Please register with master.' });
  }
  if (!device.isApproved) {
    return res.status(403).json({ message: 'Device pending approval from admin.' });
  }
  if (device.isLocked) {
    return res.status(403).json({ message: 'Device is locked.', locked: true, reason: device.lockReason });
  }
  req.device = device;
  next();
};

// Check granular permission — supports both legacy boolean and dynamic string permissions
const checkPermission = (permission) => {
  return (req, res, next) => {
    // Admin always has all permissions
    if (req.user.role === 'admin') return next();

    // Check dynamic string-based permissions first
    // 1. User-level overrides
    if (req.user.grantedPermissions && req.user.grantedPermissions.includes(permission)) return next();
    // 2. Role-level permissions
    if (req.user.customRole && req.user.customRole.permissions && req.user.customRole.permissions.includes(permission)) return next();

    // 3. Legacy boolean permissions fallback
    if (req.user.permissions && req.user.permissions[permission]) return next();

    // 4. Map new string permissions to legacy boolean fields
    const legacyMap = {
      'menu.price_edit': 'canEditPrice',
      'billing.discount': 'canGiveDiscount',
      'order.cancel': 'canCancelOrder',
      'kot.delete': 'canDeleteKOT',
      'reports.view': 'canViewReports',
      'reports.export': 'canExportData',
      'menu.edit': 'canModifyMenu',
      'inventory.update': 'canManageInventory',
      'billing.refund': 'canProcessRefund',
      'counter.open': 'canOpenCounter',
      'counter.close': 'canCloseCounter',
    };
    const legacyField = legacyMap[permission];
    if (legacyField && req.user.permissions && req.user.permissions[legacyField]) return next();

    return res.status(403).json({ message: `Permission denied: ${permission}` });
  };
};

module.exports = { auth, authorize, masterOnly, requireDevice, checkPermission };
