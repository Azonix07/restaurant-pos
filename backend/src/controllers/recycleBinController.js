const RecycleBin = require('../models/RecycleBin');
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');

exports.getAll = async (req, res, next) => {
  try {
    const { model } = req.query;
    const filter = {};
    if (model) filter.originalModel = model;
    const items = await RecycleBin.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ items });
  } catch (error) { next(error); }
};

exports.restore = async (req, res, next) => {
  try {
    const item = await RecycleBin.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found in recycle bin' });

    const Model = mongoose.model(item.originalModel);
    const { _id, ...restData } = item.data;

    // Check if original still exists (soft-deleted)
    const existing = await Model.findById(item.originalId);
    if (existing) {
      // Restore soft-deleted
      existing.isDeleted = false;
      existing.isActive = true;
      existing.deletedAt = undefined;
      await existing.save();
    } else {
      // Re-create
      await Model.create({ ...restData, _id: item.originalId });
    }

    await RecycleBin.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: 'restore', module: item.originalModel.toLowerCase(),
      documentId: item.originalId,
      description: `Restored ${item.originalModel} from recycle bin`,
      user: req.user._id, userName: req.user.name,
    });

    res.json({ message: `${item.originalModel} restored successfully` });
  } catch (error) { next(error); }
};

exports.permanentDelete = async (req, res, next) => {
  try {
    const item = await RecycleBin.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    await AuditLog.create({
      action: 'permanent_delete', module: item.originalModel.toLowerCase(),
      documentId: item.originalId,
      description: `Permanently deleted ${item.originalModel}`,
      user: req.user._id, userName: req.user.name,
    });

    res.json({ message: 'Permanently deleted' });
  } catch (error) { next(error); }
};

exports.emptyBin = async (req, res, next) => {
  try {
    const result = await RecycleBin.deleteMany({});
    await AuditLog.create({
      action: 'empty_bin', module: 'recycle_bin',
      description: `Emptied recycle bin: ${result.deletedCount} items removed`,
      user: req.user._id, userName: req.user.name,
    });
    res.json({ message: `Recycle bin emptied. ${result.deletedCount} items removed.` });
  } catch (error) { next(error); }
};
