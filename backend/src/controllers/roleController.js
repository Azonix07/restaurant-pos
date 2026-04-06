const Role = require('../models/Role');
const User = require('../models/User');

// Get all roles
exports.getAll = async (req, res, next) => {
  try {
    const roles = await Role.find({ isActive: true }).sort({ isSystem: -1, name: 1 });
    res.json({ roles });
  } catch (error) {
    next(error);
  }
};

// Get all available permissions
exports.getPermissions = async (req, res) => {
  res.json({ permissions: Role.ALL_PERMISSIONS });
};

// Create a new role
exports.create = async (req, res, next) => {
  try {
    const { name, displayName, description, permissions, limits } = req.body;
    if (!name || !displayName) {
      return res.status(400).json({ message: 'Name and displayName are required' });
    }

    // Validate permissions against allowed list
    if (permissions && permissions.length > 0) {
      const invalid = permissions.filter(p => !Role.ALL_PERMISSIONS.includes(p));
      if (invalid.length > 0) {
        return res.status(400).json({ message: `Invalid permissions: ${invalid.join(', ')}` });
      }
    }

    const role = await Role.create({ name, displayName, description, permissions, limits });
    res.status(201).json({ role });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Role name already exists' });
    }
    next(error);
  }
};

// Update role
exports.update = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: 'Role not found' });
    if (role.isSystem && role.name === 'admin') {
      return res.status(403).json({ message: 'Cannot modify the admin system role' });
    }

    const { displayName, description, permissions, limits, isActive } = req.body;
    if (displayName !== undefined) role.displayName = displayName;
    if (description !== undefined) role.description = description;
    if (permissions !== undefined) {
      const invalid = permissions.filter(p => !Role.ALL_PERMISSIONS.includes(p));
      if (invalid.length > 0) {
        return res.status(400).json({ message: `Invalid permissions: ${invalid.join(', ')}` });
      }
      role.permissions = permissions;
    }
    if (limits !== undefined) role.limits = { ...role.limits, ...limits };
    if (isActive !== undefined) role.isActive = isActive;

    await role.save();
    res.json({ role });
  } catch (error) {
    next(error);
  }
};

// Delete role (soft — deactivate)
exports.remove = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: 'Role not found' });
    if (role.isSystem) {
      return res.status(403).json({ message: 'Cannot delete system roles' });
    }

    // Check if any users are assigned this role
    const usersWithRole = await User.countDocuments({ customRole: role._id });
    if (usersWithRole > 0) {
      return res.status(400).json({ message: `Cannot delete: ${usersWithRole} user(s) assigned to this role. Reassign them first.` });
    }

    role.isActive = false;
    await role.save();
    res.json({ message: 'Role deactivated' });
  } catch (error) {
    next(error);
  }
};

// Assign role to user
exports.assignToUser = async (req, res, next) => {
  try {
    const { userId, roleId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (roleId) {
      const role = await Role.findById(roleId);
      if (!role || !role.isActive) return res.status(404).json({ message: 'Role not found or inactive' });
      user.customRole = role._id;
    } else {
      user.customRole = undefined;
    }

    await user.save();
    const populated = await User.findById(user._id).select('-password').populate('customRole');
    res.json({ user: populated });
  } catch (error) {
    next(error);
  }
};

// Seed default system roles (called once on setup)
exports.seedDefaults = async () => {
  const defaults = [
    {
      name: 'admin',
      displayName: 'Administrator',
      description: 'Full system access',
      permissions: Role.ALL_PERMISSIONS,
      isSystem: true,
    },
    {
      name: 'manager',
      displayName: 'Manager',
      description: 'Manage operations, staff, reports',
      permissions: Role.ALL_PERMISSIONS.filter(p => !p.startsWith('system.') && p !== 'user.deactivate'),
    },
    {
      name: 'cashier',
      displayName: 'Cashier',
      description: 'Billing, counter, basic order management',
      permissions: [
        'billing.create', 'billing.edit', 'billing.discount', 'billing.reprint', 'billing.split', 'billing.hold',
        'order.create', 'order.edit', 'order.view',
        'kot.create', 'kot.view',
        'menu.view',
        'counter.open', 'counter.close', 'counter.view',
        'customer.view', 'customer.create',
        'table.view',
      ],
      limits: { maxDiscountPercent: 10 },
    },
    {
      name: 'waiter',
      displayName: 'Waiter',
      description: 'Take orders, manage tables',
      permissions: [
        'order.create', 'order.edit', 'order.view',
        'kot.create', 'kot.view',
        'menu.view',
        'table.view', 'table.manage',
        'customer.view',
      ],
    },
  ];

  for (const def of defaults) {
    await Role.findOneAndUpdate(
      { name: def.name },
      { $setOnInsert: def },
      { upsert: true, new: true }
    );
  }
};
