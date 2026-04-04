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
    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
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

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
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

// Check granular permission
const checkPermission = (permission) => {
  return (req, res, next) => {
    // Admin always has all permissions
    if (req.user.role === 'admin') return next();
    if (req.user.permissions && req.user.permissions[permission]) return next();
    return res.status(403).json({ message: `Permission denied: ${permission}` });
  };
};

module.exports = { auth, authorize, masterOnly, requireDevice, checkPermission };
