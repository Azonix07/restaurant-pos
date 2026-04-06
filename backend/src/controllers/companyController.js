const Company = require('../models/Company');
const AuditLog = require('../models/AuditLog');

exports.getAll = async (req, res, next) => {
  try {
    const companies = await Company.find({ isActive: true }).sort({ isDefault: -1, name: 1 });
    res.json(companies);
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.json({ company });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const company = await Company.create({ ...req.body, createdBy: req.user._id });
    await AuditLog.create({
      action: 'create', module: 'company', documentId: company._id,
      description: `Company created: ${company.name}`,
      user: req.user._id, userName: req.user.name,
    });
    res.status(201).json({ company });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!company) return res.status(404).json({ message: 'Company not found' });
    await AuditLog.create({
      action: 'update', module: 'company', documentId: company._id,
      description: `Company updated: ${company.name}`,
      user: req.user._id, userName: req.user.name,
    });
    res.json({ company });
  } catch (error) { next(error); }
};

exports.setDefault = async (req, res, next) => {
  try {
    await Company.updateMany({}, { isDefault: false });
    const company = await Company.findByIdAndUpdate(req.params.id, { isDefault: true }, { new: true });
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.json({ company, message: 'Default company set' });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (company.isDefault) return res.status(400).json({ message: 'Cannot delete default company' });
    company.isActive = false;
    await company.save();
    res.json({ message: 'Company deactivated' });
  } catch (error) { next(error); }
};
