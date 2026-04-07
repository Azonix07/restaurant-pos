const RawMaterial = require('../models/RawMaterial');
const Recipe = require('../models/Recipe');
const StockMovement = require('../models/StockMovement');
const AlertLog = require('../models/AlertLog');
const { eventBus, EVENTS } = require('../services/eventBus');

// ============ RAW MATERIALS ============

exports.getAllMaterials = async (req, res, next) => {
  try {
    const { category, search, lowStock } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { barcode: search }];
    if (lowStock === 'true') filter.$expr = { $lte: ['$currentStock', '$minStock'] };

    const materials = await RawMaterial.find(filter).populate('supplier', 'name').sort({ name: 1 });
    res.json({ materials });
  } catch (error) {
    next(error);
  }
};

exports.createMaterial = async (req, res, next) => {
  try {
    const material = await RawMaterial.create(req.body);
    res.status(201).json({ material });
  } catch (error) {
    next(error);
  }
};

exports.updateMaterial = async (req, res, next) => {
  try {
    const material = await RawMaterial.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!material) return res.status(404).json({ message: 'Material not found' });
    res.json({ material });
  } catch (error) {
    next(error);
  }
};

// Stock IN (purchase/receipt)
exports.stockIn = async (req, res, next) => {
  try {
    const { materialId, quantity, costPerUnit, supplier, invoiceNumber, batchNumber, expiryDate, reason } = req.body;
    const material = await RawMaterial.findById(materialId);
    if (!material) return res.status(404).json({ message: 'Material not found' });

    const previousStock = material.currentStock;
    material.currentStock += quantity;
    material.lastMovementDate = new Date();
    if (costPerUnit) {
      material.costPerUnit = costPerUnit;
      material.lastPurchasePrice = costPerUnit;
      material.lastPurchaseDate = new Date();
    }
    if (supplier) material.supplier = supplier;

    // Add batch record
    material.batches.push({
      batchNumber: batchNumber || `B-${Date.now()}`,
      quantity,
      costPerUnit: costPerUnit || material.costPerUnit,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      receivedDate: new Date(),
      supplier,
      invoiceNumber,
    });

    await material.save();

    await StockMovement.create({
      rawMaterial: materialId,
      type: 'in',
      quantity,
      unit: material.unit,
      previousStock,
      newStock: material.currentStock,
      costPerUnit: costPerUnit || material.costPerUnit,
      totalCost: quantity * (costPerUnit || material.costPerUnit),
      supplier,
      invoiceNumber,
      batchNumber,
      expiryDate,
      reason: reason || 'Purchase',
      performedBy: req.user._id,
    });

    res.json({ material, message: 'Stock added' });
  } catch (error) {
    next(error);
  }
};

// Stock OUT (manual)
exports.stockOut = async (req, res, next) => {
  try {
    const { materialId, quantity, reason } = req.body;
    const material = await RawMaterial.findById(materialId);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    if (material.currentStock < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    const previousStock = material.currentStock;
    // Use atomic operation to prevent race conditions
    const updated = await RawMaterial.findOneAndUpdate(
      { _id: materialId, currentStock: { $gte: quantity } },
      { $inc: { currentStock: -quantity } },
      { new: true }
    );
    if (!updated) {
      return res.status(400).json({ message: 'Insufficient stock or concurrent update' });
    }

    await StockMovement.create({
      rawMaterial: materialId,
      type: 'out',
      quantity,
      unit: material.unit,
      previousStock,
      newStock: updated.currentStock,
      costPerUnit: material.costPerUnit,
      totalCost: quantity * material.costPerUnit,
      reason: reason || 'Manual stock out',
      performedBy: req.user._id,
    });

    // Check low stock alert
    if (updated.currentStock <= material.minStock) {
      const io = req.app.get('io');
      const alert = await AlertLog.create({
        type: 'low_stock',
        severity: 'warning',
        title: `Low stock: ${material.name}`,
        message: `${material.name} stock is ${updated.currentStock} ${material.unit} (minimum: ${material.minStock})`,
        metadata: { materialId: material._id, currentStock: updated.currentStock, minStock: material.minStock },
      });
      if (io) io.emit('alert:new', alert);
    }

    res.json({ material: updated, message: 'Stock removed' });
  } catch (error) {
    next(error);
  }
};

// Auto-deduct stock on sale (called from order processing)
exports.deductStockForOrder = async (orderItems, userId) => {
  const movements = [];
  for (const item of orderItems) {
    if (item.status === 'cancelled') continue;
    const recipe = await Recipe.findOne({ menuItem: item.menuItem }).populate('ingredients.rawMaterial');
    if (!recipe) continue;

    for (const ing of recipe.ingredients) {
      const rm = await RawMaterial.findById(ing.rawMaterial);
      if (!rm) continue;

      const totalQty = ing.quantity * item.quantity * (1 + (ing.wastagePercent || 0) / 100);
      const previousStock = rm.currentStock;

      // Prevent negative stock — only deduct what's available
      const actualDeduct = Math.min(totalQty, rm.currentStock);
      if (actualDeduct <= 0) {
        // Out of stock — log critical alert but don't block sale
        await AlertLog.create({
          type: 'out_of_stock',
          severity: 'critical',
          title: `Out of stock: ${rm.name}`,
          message: `${rm.name} needed ${totalQty} ${rm.unit} for ${item.name} but has 0 in stock`,
          metadata: { materialId: rm._id, needed: totalQty, available: 0 },
        });
        continue;
      }

      // Use atomic update with $gte guard to prevent race conditions
      const updated = await RawMaterial.findOneAndUpdate(
        { _id: rm._id, currentStock: { $gte: actualDeduct } },
        {
          $inc: { currentStock: -actualDeduct },
          $set: { lastMovementDate: new Date() },
        },
        { new: true }
      );

      if (!updated) {
        // Concurrent update — skip silently, will catch on next check
        continue;
      }

      movements.push(await StockMovement.create({
        rawMaterial: rm._id,
        type: 'sale',
        quantity: actualDeduct,
        unit: rm.unit,
        previousStock,
        newStock: updated.currentStock,
        costPerUnit: rm.costPerUnit,
        totalCost: actualDeduct * rm.costPerUnit,
        recipe: recipe._id,
        reason: `Sale: ${item.name} x${item.quantity}`,
        performedBy: userId,
      }));

      // Low stock alert
      if (updated.currentStock <= rm.minStock) {
        await AlertLog.create({
          type: 'low_stock',
          severity: updated.currentStock === 0 ? 'critical' : 'warning',
          title: `Low stock: ${rm.name}`,
          message: `${rm.name}: ${updated.currentStock} ${rm.unit} remaining (min: ${rm.minStock})`,
          metadata: { materialId: rm._id, currentStock: updated.currentStock },
        });
      }
    }
  }
  // Emit stock deduction event for background workers
  if (movements.length > 0) {
    eventBus.emitEvent(EVENTS.STOCK_DEDUCTED, { movementCount: movements.length, userId });
  }
  return movements;
};

// Get stock alerts (low stock items)
exports.getStockAlerts = async (req, res, next) => {
  try {
    const alerts = await RawMaterial.find({
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minStock'] },
    }).sort({ currentStock: 1 });
    res.json({ alerts, count: alerts.length });
  } catch (error) {
    next(error);
  }
};

// Get stock movement history
exports.getMovements = async (req, res, next) => {
  try {
    const { materialId, type, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (materialId) filter.rawMaterial = materialId;
    if (type) filter.type = type;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const movements = await StockMovement.find(filter)
      .populate('rawMaterial', 'name unit')
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await StockMovement.countDocuments(filter);
    res.json({ movements, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

// ============ RECIPES / BOM ============

exports.getAllRecipes = async (req, res, next) => {
  try {
    const recipes = await Recipe.find({ isActive: true })
      .populate('menuItem', 'name category price')
      .populate('ingredients.rawMaterial', 'name unit costPerUnit');
    res.json({ recipes });
  } catch (error) {
    next(error);
  }
};

exports.createRecipe = async (req, res, next) => {
  try {
    const recipe = await Recipe.create(req.body);
    await recipe.calculateCost();
    await recipe.save();
    res.status(201).json({ recipe });
  } catch (error) {
    next(error);
  }
};

exports.updateRecipe = async (req, res, next) => {
  try {
    const recipe = await Recipe.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    await recipe.calculateCost();
    await recipe.save();
    res.json({ recipe });
  } catch (error) {
    next(error);
  }
};

exports.deleteRecipe = async (req, res, next) => {
  try {
    await Recipe.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Recipe deleted' });
  } catch (error) {
    next(error);
  }
};

// Find item by barcode
exports.findByBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.params;
    const material = await RawMaterial.findOne({ barcode });
    if (material) return res.json({ type: 'raw_material', item: material });

    const MenuItem = require('../models/MenuItem');
    const menuItem = await MenuItem.findOne({ barcode });
    if (menuItem) return res.json({ type: 'menu_item', item: menuItem });

    res.status(404).json({ message: 'No item found with this barcode' });
  } catch (error) {
    next(error);
  }
};

// Get items expiring soon (batch-wise)
exports.getExpiringItems = async (req, res, next) => {
  try {
    const daysAhead = parseInt(req.query.days) || 7;
    const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

    const materials = await RawMaterial.find({
      isActive: true,
      'batches.expiryDate': { $lte: cutoff, $gte: new Date() },
    }).select('name category unit batches');

    const expiring = [];
    for (const mat of materials) {
      for (const batch of mat.batches) {
        if (batch.expiryDate && batch.expiryDate <= cutoff && batch.expiryDate >= new Date() && batch.quantity > 0) {
          expiring.push({
            materialId: mat._id,
            materialName: mat.name,
            category: mat.category,
            batchNumber: batch.batchNumber,
            quantity: batch.quantity,
            unit: mat.unit,
            expiryDate: batch.expiryDate,
            daysLeft: Math.ceil((batch.expiryDate - Date.now()) / (24 * 60 * 60 * 1000)),
          });
        }
      }
    }

    expiring.sort((a, b) => a.daysLeft - b.daysLeft);
    res.json({ expiring, count: expiring.length });
  } catch (error) {
    next(error);
  }
};

// Get dead stock (no movement for 30+ days)
exports.getDeadStock = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const deadStock = await RawMaterial.find({
      isActive: true,
      currentStock: { $gt: 0 },
      lastMovementDate: { $lt: cutoff },
    }).select('name category unit currentStock costPerUnit lastMovementDate').sort({ lastMovementDate: 1 });

    const items = deadStock.map(item => ({
      ...item.toObject(),
      daysSinceMovement: Math.floor((Date.now() - item.lastMovementDate.getTime()) / (24 * 60 * 60 * 1000)),
      stockValue: item.currentStock * item.costPerUnit,
    }));

    const totalValue = items.reduce((sum, i) => sum + i.stockValue, 0);
    res.json({ deadStock: items, count: items.length, totalValue });
  } catch (error) {
    next(error);
  }
};
