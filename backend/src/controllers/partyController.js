const Party = require('../models/Party');
const AuditLog = require('../models/AuditLog');
const RecycleBin = require('../models/RecycleBin');
const nodemailer = require('nodemailer');
const config = require('../config');

exports.getAll = async (req, res, next) => {
  try {
    const { type, search, page = 1, limit = 50 } = req.query;
    const filter = { isActive: true };
    if (type) filter.type = type;
    if (search) filter.$text = { $search: search };

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parties = await Party.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit, 10));
    const total = await Party.countDocuments(filter);
    res.json({ parties, total, page: parseInt(page, 10), pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ message: 'Party not found' });
    res.json({ party });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const party = await Party.create({ ...req.body, createdBy: req.user._id });
    await AuditLog.create({
      action: 'create', module: 'party', documentId: party._id,
      description: `Party created: ${party.name}`,
      user: req.user._id, userName: req.user.name,
    });
    res.status(201).json({ party });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const party = await Party.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!party) return res.status(404).json({ message: 'Party not found' });
    await AuditLog.create({
      action: 'update', module: 'party', documentId: party._id,
      description: `Party updated: ${party.name}`,
      user: req.user._id, userName: req.user.name,
    });
    res.json({ party });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ message: 'Party not found' });
    await RecycleBin.create({
      originalModel: 'Party', originalId: party._id,
      data: party.toObject(),
      deletedBy: req.user._id, deletedByName: req.user.name,
    });
    await Party.findByIdAndDelete(req.params.id);
    await AuditLog.create({
      action: 'delete', module: 'party', documentId: party._id,
      description: `Party deleted: ${party.name}`,
      user: req.user._id, userName: req.user.name,
    });
    res.json({ message: 'Party moved to recycle bin' });
  } catch (error) { next(error); }
};

exports.setCustomPricing = async (req, res, next) => {
  try {
    const { customPricing } = req.body;
    const party = await Party.findByIdAndUpdate(
      req.params.id,
      { customPricing },
      { new: true, runValidators: true }
    );
    if (!party) return res.status(404).json({ message: 'Party not found' });
    res.json({ party });
  } catch (error) { next(error); }
};

exports.setCreditLimit = async (req, res, next) => {
  try {
    const { creditLimit } = req.body;
    const party = await Party.findByIdAndUpdate(
      req.params.id,
      { creditLimit },
      { new: true }
    );
    if (!party) return res.status(404).json({ message: 'Party not found' });
    res.json({ party });
  } catch (error) { next(error); }
};

exports.sendPaymentReminder = async (req, res, next) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ message: 'Party not found' });
    if (party.currentBalance <= 0) {
      return res.json({ message: 'No outstanding balance' });
    }

    // If email configured, send reminder
    if (config.smtp.user && party.email) {
      const transporter = nodemailer.createTransport({
        host: config.smtp.host, port: config.smtp.port, secure: false,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
      });
      await transporter.sendMail({
        from: config.smtp.user, to: party.email,
        subject: 'Payment Reminder',
        html: `<p>Dear ${party.name},</p><p>This is a reminder that you have an outstanding balance of <strong>₹${party.currentBalance.toLocaleString('en-IN')}</strong>.</p><p>Please arrange for payment at your earliest convenience.</p>`,
      });
    }

    party.lastReminderSent = new Date();
    await party.save();
    res.json({ message: 'Payment reminder sent', party });
  } catch (error) { next(error); }
};

exports.importParties = async (req, res, next) => {
  try {
    const { parties } = req.body;
    if (!Array.isArray(parties) || parties.length === 0) {
      return res.status(400).json({ message: 'Provide an array of parties' });
    }

    const results = { created: 0, skipped: 0, errors: [] };
    for (const p of parties) {
      try {
        if (!p.name) { results.skipped++; continue; }
        const exists = await Party.findOne({ name: p.name, phone: p.phone });
        if (exists) { results.skipped++; continue; }
        await Party.create({ ...p, createdBy: req.user._id });
        results.created++;
      } catch (err) {
        results.errors.push({ name: p.name, error: err.message });
      }
    }

    await AuditLog.create({
      action: 'import', module: 'party',
      description: `Imported parties: ${results.created} created, ${results.skipped} skipped`,
      user: req.user._id, userName: req.user.name,
    });

    res.json({ message: 'Import complete', results });
  } catch (error) { next(error); }
};

exports.getOverdueParties = async (req, res, next) => {
  try {
    const parties = await Party.find({ currentBalance: { $gt: 0 }, isActive: true }).sort({ currentBalance: -1 });
    res.json({ parties });
  } catch (error) { next(error); }
};
