const FixedAsset = require('../models/FixedAsset');
const AuditLog = require('../models/AuditLog');
const RecycleBin = require('../models/RecycleBin');

exports.getAll = async (req, res, next) => {
  try {
    const { status, category } = req.query;
    const filter = { isDeleted: false };
    if (status) filter.status = status;
    if (category) filter.category = category;
    const assets = await FixedAsset.find(filter).sort({ purchaseDate: -1 });

    // Calculate current depreciated value for each
    const assetsWithDepreciation = assets.map(a => {
      const obj = a.toObject();
      const years = (Date.now() - new Date(a.purchaseDate).getTime()) / (365.25 * 86400000);
      if (a.depreciationMethod === 'straight_line') {
        const annualDep = (a.purchasePrice - a.salvageValue) * (a.depreciationRate / 100);
        obj.currentValue = Math.max(a.salvageValue, a.purchasePrice - annualDep * years);
        obj.accumulatedDepreciation = a.purchasePrice - obj.currentValue;
      } else {
        // Written down value
        obj.currentValue = a.purchasePrice * Math.pow(1 - a.depreciationRate / 100, years);
        obj.currentValue = Math.max(a.salvageValue, obj.currentValue);
        obj.accumulatedDepreciation = a.purchasePrice - obj.currentValue;
      }
      return obj;
    });

    res.json({ assets: assetsWithDepreciation });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const asset = await FixedAsset.create({ ...req.body, createdBy: req.user._id });
    await AuditLog.create({
      action: 'create', module: 'fixed_asset', documentId: asset._id,
      description: `Fixed asset created: ${asset.name}`,
      user: req.user._id, userName: req.user.name,
    });
    res.status(201).json({ asset });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const asset = await FixedAsset.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    res.json({ asset });
  } catch (error) { next(error); }
};

exports.dispose = async (req, res, next) => {
  try {
    const { status, disposalAmount } = req.body;
    const asset = await FixedAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    asset.status = status || 'disposed';
    asset.disposalDate = new Date();
    asset.disposalAmount = disposalAmount || 0;
    await asset.save();

    await AuditLog.create({
      action: 'dispose', module: 'fixed_asset', documentId: asset._id,
      description: `Fixed asset disposed: ${asset.name} (${asset.status})`,
      user: req.user._id, userName: req.user.name,
    });
    res.json({ asset, message: 'Asset disposed' });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    const asset = await FixedAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    await RecycleBin.create({
      originalModel: 'FixedAsset', originalId: asset._id,
      data: asset.toObject(),
      deletedBy: req.user._id, deletedByName: req.user.name,
    });
    asset.isDeleted = true;
    await asset.save();
    res.json({ message: 'Asset moved to recycle bin' });
  } catch (error) { next(error); }
};
