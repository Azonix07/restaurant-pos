const Production = require('../models/Production');
const Recipe = require('../models/Recipe');
const RawMaterial = require('../models/RawMaterial');
const StockMovement = require('../models/StockMovement');
const AuditLog = require('../models/AuditLog');

// Generate batch number
const generateBatchNumber = async (section) => {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const prefix = section.substring(0, 3).toUpperCase();
  const count = await Production.countDocuments({
    scheduledDate: {
      $gte: new Date(today.setHours(0, 0, 0, 0)),
      $lt: new Date(today.setHours(23, 59, 59, 999)),
    },
    section,
  });
  return `${prefix}-${dateStr}-${String(count + 1).padStart(3, '0')}`;
};

// Create production batch
exports.create = async (req, res, next) => {
  try {
    const { section, items, scheduledDate, notes } = req.body;
    const batchNumber = await generateBatchNumber(section || 'bakery');

    const production = await Production.create({
      batchNumber,
      section: section || 'bakery',
      items,
      scheduledDate: scheduledDate || new Date(),
      notes,
      createdBy: req.user._id,
    });

    await AuditLog.create({
      action: 'create',
      module: 'production',
      documentId: production._id,
      documentNumber: batchNumber,
      description: `Production batch created: ${batchNumber}`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.status(201).json({ production });
  } catch (error) {
    next(error);
  }
};

// Start production — deduct raw materials from recipes
exports.startProduction = async (req, res, next) => {
  try {
    const production = await Production.findById(req.params.id);
    if (!production) return res.status(404).json({ message: 'Production batch not found' });
    if (production.status !== 'planned') {
      return res.status(400).json({ message: 'Only planned batches can be started' });
    }

    const materialsConsumed = [];
    let totalCost = 0;

    for (const item of production.items) {
      if (item.status === 'cancelled') continue;
      const recipe = await Recipe.findOne({ menuItem: item.menuItem });
      if (!recipe) continue;

      for (const ing of recipe.ingredients) {
        const rm = await RawMaterial.findById(ing.rawMaterial);
        if (!rm) continue;

        const effectiveQty = ing.quantity * item.plannedQuantity * (1 + (ing.wastagePercent || 0) / 100);
        const cost = effectiveQty * rm.costPerUnit;

        // Check if enough stock
        if (rm.currentStock < effectiveQty) {
          return res.status(400).json({
            message: `Insufficient stock for ${rm.name}: need ${effectiveQty.toFixed(2)} ${rm.unit}, have ${rm.currentStock.toFixed(2)}`,
          });
        }

        const prevStock = rm.currentStock;
        rm.currentStock -= effectiveQty;
        await rm.save();

        await StockMovement.create({
          rawMaterial: rm._id,
          type: 'production',
          quantity: effectiveQty,
          unit: rm.unit,
          previousStock: prevStock,
          newStock: rm.currentStock,
          costPerUnit: rm.costPerUnit,
          totalCost: cost,
          reason: `Production: ${production.batchNumber}`,
          performedBy: req.user._id,
        });

        materialsConsumed.push({
          rawMaterial: rm._id,
          name: rm.name,
          quantity: effectiveQty,
          unit: rm.unit,
        });
        totalCost += cost;
      }

      item.status = 'in_progress';
      item.startedAt = new Date();
    }

    production.materialsConsumed = materialsConsumed;
    production.totalCost = totalCost;
    production.status = 'in_progress';
    production.startedAt = new Date();
    await production.save();

    res.json({ production });
  } catch (error) {
    next(error);
  }
};

// Complete production — update actual quantities
exports.completeProduction = async (req, res, next) => {
  try {
    const { items } = req.body; // [{ itemId, actualQuantity, wastageQuantity }]
    const production = await Production.findById(req.params.id);
    if (!production) return res.status(404).json({ message: 'Production batch not found' });

    if (items) {
      for (const update of items) {
        const item = production.items.id(update.itemId);
        if (item) {
          item.actualQuantity = update.actualQuantity;
          item.wastageQuantity = update.wastageQuantity || 0;
          item.status = 'completed';
          item.completedAt = new Date();
        }
      }
    }

    production.status = 'completed';
    production.completedAt = new Date();
    await production.save();

    await AuditLog.create({
      action: 'complete',
      module: 'production',
      documentId: production._id,
      documentNumber: production.batchNumber,
      description: `Production batch completed: ${production.batchNumber}`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.json({ production });
  } catch (error) {
    next(error);
  }
};

// Get all production batches
exports.getAll = async (req, res, next) => {
  try {
    const { status, section, date } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (section) filter.section = section;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 86400000);
      filter.scheduledDate = { $gte: start, $lt: end };
    }

    const productions = await Production.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ productions });
  } catch (error) {
    next(error);
  }
};

// Get single production
exports.getById = async (req, res, next) => {
  try {
    const production = await Production.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('items.menuItem', 'name image')
      .populate('materialsConsumed.rawMaterial', 'name unit');
    if (!production) return res.status(404).json({ message: 'Not found' });
    res.json({ production });
  } catch (error) {
    next(error);
  }
};
