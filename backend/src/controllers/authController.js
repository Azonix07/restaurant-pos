const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const signToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, customRole } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const userData = { name, email, password, role, phone };
    if (customRole) userData.customRole = customRole;

    const user = await User.create(userData);
    const token = signToken(user);
    const populated = await User.findById(user._id).select('-password').populate('customRole');
    res.status(201).json({ token, user: populated });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    const token = signToken(user);
    const populated = await User.findById(user._id).select('-password').populate('customRole');
    res.json({ token, user: populated });
  } catch (error) {
    next(error);
  }
};

exports.getProfile = async (req, res) => {
  res.json({ user: req.user });
};

exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').populate('customRole').sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { name, role, phone, isActive, permissions, limits, pin, customRole, grantedPermissions, revokeTokens } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (phone !== undefined) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (limits !== undefined) updateData.limits = limits;
    if (customRole !== undefined) updateData.customRole = customRole || null;
    if (grantedPermissions !== undefined) updateData.grantedPermissions = grantedPermissions;
    if (pin !== undefined) {
      const bcrypt = require('bcryptjs');
      updateData.pin = await bcrypt.hash(pin, 12);
    }
    // Revoke all existing tokens for this user
    if (revokeTokens) {
      updateData.tokenRevokedAt = new Date();
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password').populate('customRole');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

// Verify admin/manager PIN for sensitive operations
exports.verifyPin = async (req, res, next) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ message: 'PIN is required' });

    // Find any admin or manager with a matching PIN
    const managers = await User.find({ role: { $in: ['admin', 'manager'] }, isActive: true }).select('+pin');
    let verified = false;
    let verifiedUser = null;
    for (const user of managers) {
      if (user.pin && await user.comparePin(pin)) {
        verified = true;
        verifiedUser = { id: user._id, name: user.name, role: user.role };
        break;
      }
    }

    if (!verified) return res.status(403).json({ message: 'Invalid PIN' });
    res.json({ verified: true, authorizedBy: verifiedUser });
  } catch (error) {
    next(error);
  }
};

// Get permission templates by role
exports.getPermissionTemplates = async (req, res) => {
  const templates = {
    admin: {
      canEditPrice: true, canGiveDiscount: true, maxDiscountPercent: 100,
      canCancelOrder: true, canDeleteKOT: true, canViewReports: true,
      canExportData: true, canModifyMenu: true, canManageInventory: true,
      canProcessRefund: true, canOpenCounter: true, canCloseCounter: true,
    },
    manager: {
      canEditPrice: true, canGiveDiscount: true, maxDiscountPercent: 50,
      canCancelOrder: true, canDeleteKOT: true, canViewReports: true,
      canExportData: true, canModifyMenu: true, canManageInventory: true,
      canProcessRefund: true, canOpenCounter: true, canCloseCounter: true,
    },
    cashier: {
      canEditPrice: false, canGiveDiscount: true, maxDiscountPercent: 10,
      canCancelOrder: false, canDeleteKOT: false, canViewReports: false,
      canExportData: false, canModifyMenu: false, canManageInventory: false,
      canProcessRefund: false, canOpenCounter: true, canCloseCounter: true,
    },
    waiter: {
      canEditPrice: false, canGiveDiscount: false, maxDiscountPercent: 0,
      canCancelOrder: false, canDeleteKOT: false, canViewReports: false,
      canExportData: false, canModifyMenu: false, canManageInventory: false,
      canProcessRefund: false, canOpenCounter: false, canCloseCounter: false,
    },
  };
  res.json({ templates });
};

// Apply permission template to a user
exports.applyPermissionTemplate = async (req, res, next) => {
  try {
    const { role } = req.body;
    const templates = {
      admin: { canEditPrice: true, canGiveDiscount: true, maxDiscountPercent: 100, canCancelOrder: true, canDeleteKOT: true, canViewReports: true, canExportData: true, canModifyMenu: true, canManageInventory: true, canProcessRefund: true, canOpenCounter: true, canCloseCounter: true },
      manager: { canEditPrice: true, canGiveDiscount: true, maxDiscountPercent: 50, canCancelOrder: true, canDeleteKOT: true, canViewReports: true, canExportData: true, canModifyMenu: true, canManageInventory: true, canProcessRefund: true, canOpenCounter: true, canCloseCounter: true },
      cashier: { canEditPrice: false, canGiveDiscount: true, maxDiscountPercent: 10, canCancelOrder: false, canDeleteKOT: false, canViewReports: false, canExportData: false, canModifyMenu: false, canManageInventory: false, canProcessRefund: false, canOpenCounter: true, canCloseCounter: true },
      waiter: { canEditPrice: false, canGiveDiscount: false, maxDiscountPercent: 0, canCancelOrder: false, canDeleteKOT: false, canViewReports: false, canExportData: false, canModifyMenu: false, canManageInventory: false, canProcessRefund: false, canOpenCounter: false, canCloseCounter: false },
    };

    const template = templates[role];
    if (!template) return res.status(400).json({ message: 'Invalid role template' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { permissions: template },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user, message: `Applied ${role} template` });
  } catch (error) {
    next(error);
  }
};

// Get user activity log
exports.getUserActivity = async (req, res, next) => {
  try {
    const AuditLog = require('../models/AuditLog');
    const { startDate, endDate, limit: queryLimit = 50 } = req.query;
    const filter = { user: req.params.id };

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    const activities = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(queryLimit, 10));

    res.json({ activities, count: activities.length });
  } catch (error) {
    next(error);
  }
};
