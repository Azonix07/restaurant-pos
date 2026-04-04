const QRCode = require('qrcode');
const Table = require('../models/Table');

exports.getAll = async (req, res, next) => {
  try {
    const tables = await Table.find().populate('currentOrder').sort({ number: 1 });
    res.json({ tables });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const table = await Table.create(req.body);
    res.status(201).json({ table });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const table = await Table.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!table) return res.status(404).json({ message: 'Table not found' });
    res.json({ table });
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!table) return res.status(404).json({ message: 'Table not found' });

    const io = req.app.get('io');
    if (io) io.emit('table:update', table);

    res.json({ table });
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const table = await Table.findByIdAndDelete(req.params.id);
    if (!table) return res.status(404).json({ message: 'Table not found' });
    res.json({ message: 'Table deleted' });
  } catch (error) {
    next(error);
  }
};

exports.generateQR = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Table not found' });

    const serverIP = req.query.ip || req.hostname;
    const port = req.app.get('port') || 5000;
    const qrUrl = `http://${serverIP}:${port}/qr-order/${table.number}`;

    const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2 });
    table.qrCode = qrDataUrl;
    await table.save();

    res.json({ qrCode: qrDataUrl, url: qrUrl, table });
  } catch (error) {
    next(error);
  }
};
