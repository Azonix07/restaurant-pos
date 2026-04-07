const WastageEntry = require('../models/WastageEntry');
const RawMaterial = require('../models/RawMaterial');
const StockMovement = require('../models/StockMovement');
const AlertLog = require('../models/AlertLog');
const Order = require('../models/Order');
const bcrypt = require('bcryptjs');
const { eventBus, EVENTS } = require('../services/eventBus');

// Report wastage
exports.create = async (req, res, next) => {
  try {
    const { rawMaterial, menuItem, itemName, quantity, unit, reason, description, supervisorPin, photoProof } = req.body;

    if (!supervisorPin && !photoProof) {
      return res.status(400).json({ message: 'Supervisor PIN or photo proof is required for wastage entry' });
    }

    // Estimate cost
    let estimatedCost = 0;
    if (rawMaterial) {
      const rm = await RawMaterial.findById(rawMaterial);
      if (rm) estimatedCost = quantity * rm.costPerUnit;
    }

    const entry = await WastageEntry.create({
      rawMaterial,
      menuItem,
      itemName,
      quantity,
      unit,
      estimatedCost,
      reason,
      description,
      supervisorPin: supervisorPin ? await bcrypt.hash(supervisorPin, 10) : undefined,
      photoProof,
      reportedBy: req.user._id,
      approvalStatus: supervisorPin ? 'pending' : 'pending', // always needs approval
    });

    res.status(201).json({ entry, message: 'Wastage reported. Awaiting approval.' });
  } catch (error) {
    next(error);
  }
};

// Approve wastage (admin/manager only)
exports.approve = async (req, res, next) => {
  try {
    const entry = await WastageEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Wastage entry not found' });

    entry.approvalStatus = 'approved';
    entry.approvedBy = req.user._id;
    entry.reviewedAt = new Date();
    await entry.save();

    // Deduct from stock
    if (entry.rawMaterial) {
      const rm = await RawMaterial.findById(entry.rawMaterial);
      if (rm) {
        const prev = rm.currentStock;
        rm.currentStock = Math.max(0, rm.currentStock - entry.quantity);
        await rm.save();

        await StockMovement.create({
          rawMaterial: rm._id,
          type: 'wastage',
          quantity: entry.quantity,
          unit: entry.unit,
          previousStock: prev,
          newStock: rm.currentStock,
          costPerUnit: rm.costPerUnit,
          totalCost: entry.estimatedCost,
          wastageEntry: entry._id,
          reason: `Wastage: ${entry.reason} - ${entry.description || ''}`,
          performedBy: req.user._id,
        });
      }
    }

    res.json({ entry, message: 'Wastage approved and stock deducted' });

    // Emit wastage event for background fraud + stock workers
    eventBus.emitEvent(EVENTS.WASTAGE_LOGGED, {
      entryId: entry._id,
      materialId: entry.rawMaterial,
      quantity: entry.quantity,
      cost: entry.estimatedCost,
      userId: req.user._id,
      userName: req.user.name,
    });
  } catch (error) {
    next(error);
  }
};

// Reject wastage
exports.reject = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const entry = await WastageEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Wastage entry not found' });

    entry.approvalStatus = 'rejected';
    entry.approvedBy = req.user._id;
    entry.reviewedAt = new Date();
    entry.description = (entry.description || '') + ` [REJECTED: ${reason || 'No reason'}]`;
    await entry.save();

    res.json({ entry, message: 'Wastage rejected' });
  } catch (error) {
    next(error);
  }
};

// Get all wastage entries
exports.getAll = async (req, res, next) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.approvalStatus = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const entries = await WastageEntry.find(filter)
      .populate('rawMaterial', 'name unit')
      .populate('reportedBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await WastageEntry.countDocuments(filter);
    res.json({ entries, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

// Wastage analytics - detect high wastage
exports.getAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000);
    const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();

    const filter = {
      createdAt: { $gte: start, $lte: end },
      approvalStatus: 'approved',
    };

    // Total wastage cost
    const wastagePipeline = await WastageEntry.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCost: { $sum: '$estimatedCost' },
          totalEntries: { $sum: 1 },
          byReason: {
            $push: {
              reason: '$reason',
              cost: '$estimatedCost',
            },
          },
        },
      },
    ]);

    // Total sales in same period
    const salesPipeline = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          paymentStatus: 'paid',
        },
      },
      { $group: { _id: null, totalSales: { $sum: '$total' } } },
    ]);

    const totalWastage = wastagePipeline[0]?.totalCost || 0;
    const totalSales = salesPipeline[0]?.totalSales || 0;
    const wastagePercent = totalSales > 0 ? ((totalWastage / totalSales) * 100).toFixed(2) : 0;

    // Wastage by reason
    const byReason = await WastageEntry.aggregate([
      { $match: filter },
      { $group: { _id: '$reason', totalCost: { $sum: '$estimatedCost' }, count: { $sum: 1 } } },
      { $sort: { totalCost: -1 } },
    ]);

    // Check threshold (5%)
    const thresholdExceeded = parseFloat(wastagePercent) > 5;
    if (thresholdExceeded) {
      const io = req.app.get('io');
      const alert = await AlertLog.create({
        type: 'high_wastage',
        severity: 'critical',
        title: 'High wastage detected',
        message: `Wastage is ${wastagePercent}% of sales (threshold: 5%). Period: ${start.toDateString()} - ${end.toDateString()}`,
        metadata: { wastagePercent, totalWastage, totalSales },
      });
      if (io) io.emit('alert:new', alert);
    }

    res.json({
      totalWastage,
      totalSales,
      wastagePercent: parseFloat(wastagePercent),
      thresholdExceeded,
      totalEntries: wastagePipeline[0]?.totalEntries || 0,
      byReason,
      period: { start, end },
    });
  } catch (error) {
    next(error);
  }
};
