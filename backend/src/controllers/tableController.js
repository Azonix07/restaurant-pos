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

// Transfer order from one table to another
exports.transferOrder = async (req, res, next) => {
  try {
    const { targetTableId } = req.body;
    const sourceTable = await Table.findById(req.params.id).populate('currentOrder');
    const targetTable = await Table.findById(targetTableId);

    if (!sourceTable) return res.status(404).json({ message: 'Source table not found' });
    if (!targetTable) return res.status(404).json({ message: 'Target table not found' });
    if (!sourceTable.currentOrder) return res.status(400).json({ message: 'Source table has no order' });
    if (targetTable.status === 'occupied') return res.status(400).json({ message: 'Target table is occupied' });

    const Order = require('../models/Order');
    const order = await Order.findById(sourceTable.currentOrder._id || sourceTable.currentOrder);
    if (order) {
      order.table = targetTable._id;
      await order.save();
    }

    targetTable.status = 'occupied';
    targetTable.currentOrder = sourceTable.currentOrder._id || sourceTable.currentOrder;
    await targetTable.save();

    sourceTable.status = 'available';
    sourceTable.currentOrder = null;
    await sourceTable.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('table:update', sourceTable);
      io.emit('table:update', targetTable);
    }

    res.json({ message: `Order transferred from Table ${sourceTable.number} to Table ${targetTable.number}` });
  } catch (error) {
    next(error);
  }
};

// Merge tables (move items from source to target order)
exports.mergeTables = async (req, res, next) => {
  try {
    const { targetTableId } = req.body;
    const sourceTable = await Table.findById(req.params.id);
    const targetTable = await Table.findById(targetTableId);

    if (!sourceTable || !targetTable) return res.status(404).json({ message: 'Table not found' });
    if (!sourceTable.currentOrder) return res.status(400).json({ message: 'Source table has no order' });
    if (!targetTable.currentOrder) return res.status(400).json({ message: 'Target table has no order' });

    const Order = require('../models/Order');
    const sourceOrder = await Order.findById(sourceTable.currentOrder);
    const targetOrder = await Order.findById(targetTable.currentOrder);

    if (!sourceOrder || !targetOrder) return res.status(404).json({ message: 'Order not found' });

    // Move items from source to target
    targetOrder.items.push(...sourceOrder.items);
    targetOrder.calculateTotals();
    await targetOrder.save();

    // Cancel source order
    sourceOrder.status = 'cancelled';
    sourceOrder.items = [];
    await sourceOrder.save();

    // Free source table
    sourceTable.status = 'available';
    sourceTable.currentOrder = null;
    await sourceTable.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('table:update', sourceTable);
      io.emit('table:update', targetTable);
      io.emit('order:updated', targetOrder);
    }

    res.json({ message: `Table ${sourceTable.number} merged into Table ${targetTable.number}`, order: targetOrder });
  } catch (error) {
    next(error);
  }
};
