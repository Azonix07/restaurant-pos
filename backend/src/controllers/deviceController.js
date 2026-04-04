const Device = require('../models/Device');
const AlertLog = require('../models/AlertLog');

// Register a new device
exports.register = async (req, res, next) => {
  try {
    const { deviceId, name, type, ipAddress, macAddress, kitchenSection, printerConfig } = req.body;
    if (!deviceId || !name) {
      return res.status(400).json({ message: 'deviceId and name are required' });
    }

    let device = await Device.findOne({ deviceId });
    if (device) {
      // Update existing registration
      device.name = name;
      device.ipAddress = ipAddress || req.ip;
      if (macAddress) device.macAddress = macAddress;
      if (type) device.type = type;
      if (kitchenSection) device.kitchenSection = kitchenSection;
      if (printerConfig) device.printerConfig = printerConfig;
      await device.save();
      return res.json({ device, message: 'Device updated' });
    }

    device = await Device.create({
      deviceId,
      name,
      type: type || 'cashier_terminal',
      ipAddress: ipAddress || req.ip,
      macAddress,
      kitchenSection,
      printerConfig,
      registeredBy: req.user._id,
      isApproved: false, // requires admin approval
    });

    res.status(201).json({ device, message: 'Device registered. Awaiting admin approval.' });
  } catch (error) {
    next(error);
  }
};

// Admin approves a device
exports.approve = async (req, res, next) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) return res.status(404).json({ message: 'Device not found' });

    device.isApproved = true;
    device.status = 'offline';
    await device.save();
    res.json({ device, message: 'Device approved' });
  } catch (error) {
    next(error);
  }
};

// Get all devices
exports.getAll = async (req, res, next) => {
  try {
    const devices = await Device.find()
      .populate('registeredBy', 'name')
      .populate('assignedUser', 'name')
      .sort({ isMaster: -1, name: 1 });
    res.json({ devices });
  } catch (error) {
    next(error);
  }
};

// Get device status dashboard
exports.getStatus = async (req, res, next) => {
  try {
    const devices = await Device.find({ isApproved: true })
      .populate('assignedUser', 'name role');

    const now = Date.now();
    const staleThreshold = 15000; // 15 seconds
    const statusMap = devices.map(d => ({
      _id: d._id,
      deviceId: d.deviceId,
      name: d.name,
      type: d.type,
      isMaster: d.isMaster,
      status: d.isLocked ? 'locked' :
        (d.lastHeartbeat && (now - d.lastHeartbeat.getTime() < staleThreshold)) ? 'online' : 'offline',
      ipAddress: d.ipAddress,
      lastHeartbeat: d.lastHeartbeat,
      lastSyncAt: d.lastSyncAt,
      assignedUser: d.assignedUser,
      kitchenSection: d.kitchenSection,
      isLocked: d.isLocked,
      lockReason: d.lockReason,
    }));

    const online = statusMap.filter(d => d.status === 'online').length;
    const offline = statusMap.filter(d => d.status === 'offline').length;
    const locked = statusMap.filter(d => d.status === 'locked').length;

    res.json({ devices: statusMap, summary: { total: devices.length, online, offline, locked } });
  } catch (error) {
    next(error);
  }
};

// Lock a device
exports.lock = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const device = await Device.findById(req.params.id);
    if (!device) return res.status(404).json({ message: 'Device not found' });
    if (device.isMaster) return res.status(400).json({ message: 'Cannot lock master device' });

    device.isLocked = true;
    device.lockReason = reason || 'Locked by admin';
    device.status = 'locked';
    await device.save();

    // Emit lock event
    const io = req.app.get('io');
    if (io) io.emit('device:locked', { deviceId: device.deviceId, reason: device.lockReason });

    await AlertLog.create({
      type: 'fraud_attempt',
      severity: 'critical',
      title: `Device locked: ${device.name}`,
      message: reason || 'Device locked by admin',
      device: device._id,
      user: req.user._id,
    });

    res.json({ device, message: 'Device locked' });
  } catch (error) {
    next(error);
  }
};

// Unlock a device
exports.unlock = async (req, res, next) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) return res.status(404).json({ message: 'Device not found' });

    device.isLocked = false;
    device.lockReason = null;
    device.status = 'offline'; // will go online on next heartbeat
    await device.save();

    const io = req.app.get('io');
    if (io) io.emit('device:unlocked', { deviceId: device.deviceId });

    res.json({ device, message: 'Device unlocked' });
  } catch (error) {
    next(error);
  }
};

// Set master device
exports.setMaster = async (req, res, next) => {
  try {
    // Remove master from all devices first
    await Device.updateMany({}, { isMaster: false });

    const device = await Device.findById(req.params.id);
    if (!device) return res.status(404).json({ message: 'Device not found' });

    device.isMaster = true;
    device.isApproved = true;
    device.type = 'master';
    await device.save();

    res.json({ device, message: 'Device set as master' });
  } catch (error) {
    next(error);
  }
};

// Update device
exports.update = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'type', 'kitchenSection', 'printerConfig', 'assignedUser'];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const device = await Device.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!device) return res.status(404).json({ message: 'Device not found' });
    res.json({ device });
  } catch (error) {
    next(error);
  }
};

// Delete device
exports.remove = async (req, res, next) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) return res.status(404).json({ message: 'Device not found' });
    if (device.isMaster) return res.status(400).json({ message: 'Cannot delete master device' });
    await device.deleteOne();
    res.json({ message: 'Device removed' });
  } catch (error) {
    next(error);
  }
};
