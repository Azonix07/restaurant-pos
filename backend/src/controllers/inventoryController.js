const MenuItem = require('../models/MenuItem');
const AuditLog = require('../models/AuditLog');

// ─── Bulk Update Items ──────────────────────────────────
exports.bulkUpdate = async (req, res, next) => {
  try {
    const { updates } = req.body; // [{ id, fields: { price, category, ... } }]
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: 'Provide array of updates' });
    }

    const results = { updated: 0, errors: [] };
    for (const u of updates) {
      try {
        await MenuItem.findByIdAndUpdate(u.id, u.fields, { runValidators: true });
        results.updated++;
      } catch (err) {
        results.errors.push({ id: u.id, error: err.message });
      }
    }

    await AuditLog.create({
      action: 'bulk_update', module: 'menu',
      description: `Bulk updated ${results.updated} menu items`,
      user: req.user._id, userName: req.user.name,
    });

    res.json({ message: 'Bulk update complete', results });
  } catch (error) { next(error); }
};

// ─── Multiple Pricing ───────────────────────────────────
exports.setPricing = async (req, res, next) => {
  try {
    const { prices } = req.body; // { wholesale, retail, online, ... }
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    item.prices = prices;
    await item.save();
    res.json({ item });
  } catch (error) { next(error); }
};

// ─── Get Items with Stock Info ──────────────────────────
exports.getInventory = async (req, res, next) => {
  try {
    const { category, lowStock, search } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (search) filter.$text = { $search: search };
    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
    }

    const items = await MenuItem.find(filter).sort({ category: 1, name: 1 });
    res.json({ items });
  } catch (error) { next(error); }
};

// ─── Bulk Import Items ──────────────────────────────────
exports.bulkImport = async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Provide array of items' });
    }

    const results = { created: 0, skipped: 0, errors: [] };
    for (const item of items) {
      try {
        if (!item.name || !item.price) { results.skipped++; continue; }
        const exists = await MenuItem.findOne({ name: item.name });
        if (exists) { results.skipped++; continue; }
        await MenuItem.create(item);
        results.created++;
      } catch (err) {
        results.errors.push({ name: item.name, error: err.message });
      }
    }

    await AuditLog.create({
      action: 'import', module: 'menu',
      description: `Bulk imported items: ${results.created} created, ${results.skipped} skipped`,
      user: req.user._id, userName: req.user.name,
    });

    res.json({ message: 'Import complete', results });
  } catch (error) { next(error); }
};
