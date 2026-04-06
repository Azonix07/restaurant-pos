const MenuItem = require('../models/MenuItem');
const { SOCKET_EVENTS } = require('../../../shared/constants');
const { generateEAN13, generateESCPOSBarcodeCommands } = require('../utils/barcode');
const cache = require('../utils/cache');

exports.getAll = async (req, res, next) => {
  try {
    const { category, available, search } = req.query;
    const cacheKey = `menu:${category || 'all'}:${available || 'any'}:${search || ''}`;

    // Check cache first (30 second TTL)
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const filter = {};
    if (category) filter.category = category;
    if (available !== undefined) filter.isAvailable = available === 'true';
    if (search) filter.$text = { $search: search };

    const items = await MenuItem.find(filter).sort({ category: 1, name: 1 });
    const result = { items };
    cache.set(cacheKey, result, 30000);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const cached = cache.get('menu:categories');
    if (cached) return res.json(cached);

    const categories = await MenuItem.distinct('category');
    const result = { categories };
    cache.set('menu:categories', result, 60000);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const item = await MenuItem.create(req.body);
    cache.invalidate('menu:*'); // Invalidate menu cache
    const io = req.app.get('io');
    if (io) io.emit(SOCKET_EVENTS.MENU_UPDATE, { action: 'create', item });
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ message: 'Menu item not found' });
    cache.invalidate('menu:*'); // Invalidate menu cache
    const io = req.app.get('io');
    if (io) io.emit(SOCKET_EVENTS.MENU_UPDATE, { action: 'update', item });
    res.json({ item });
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Menu item not found' });
    cache.invalidate('menu:*');
    const io = req.app.get('io');
    if (io) io.emit(SOCKET_EVENTS.MENU_DELETE, { itemId: req.params.id });
    res.json({ message: 'Item deleted' });
  } catch (error) {
    next(error);
  }
};

exports.toggleAvailability = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Menu item not found' });

    item.isAvailable = !item.isAvailable;
    await item.save();
    const io = req.app.get('io');
    if (io) io.emit(SOCKET_EVENTS.MENU_UPDATE, { action: 'toggle', item });
    res.json({ item });
  } catch (error) {
    next(error);
  }
};

// Upload item image
exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image file uploaded' });

    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Menu item not found' });

    item.image = `/uploads/images/${req.file.filename}`;
    await item.save();

    res.json({ item, imageUrl: item.image });
  } catch (error) {
    next(error);
  }
};

// Find item by barcode
exports.findByBarcode = async (req, res, next) => {
  try {
    const item = await MenuItem.findOne({ barcode: req.params.barcode });
    if (!item) return res.status(404).json({ message: 'No item found with this barcode' });
    res.json({ item });
  } catch (error) {
    next(error);
  }
};

// Generate barcode for a menu item
exports.generateBarcode = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (item.barcode) {
      return res.json({ item, message: 'Item already has a barcode' });
    }

    // Generate unique barcode
    let barcode;
    let attempts = 0;
    do {
      barcode = generateEAN13('200');
      const existing = await MenuItem.findOne({ barcode });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    item.barcode = barcode;
    await item.save();

    res.json({ item, barcode });
  } catch (error) {
    next(error);
  }
};

// Bulk generate barcodes for items missing them
exports.bulkGenerateBarcodes = async (req, res, next) => {
  try {
    const items = await MenuItem.find({ $or: [{ barcode: null }, { barcode: '' }, { barcode: { $exists: false } }] });
    const results = [];

    for (const item of items) {
      let barcode;
      let attempts = 0;
      do {
        barcode = generateEAN13('200');
        const existing = await MenuItem.findOne({ barcode });
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      item.barcode = barcode;
      await item.save();
      results.push({ id: item._id, name: item.name, barcode });
    }

    res.json({ generated: results.length, items: results });
  } catch (error) {
    next(error);
  }
};

// Print barcode label via thermal printer
exports.printBarcode = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (!item.barcode) return res.status(400).json({ message: 'Item has no barcode. Generate one first.' });

    const { printerIp, printerPort = 9100 } = req.body;
    if (!printerIp) return res.status(400).json({ message: 'Printer IP is required' });

    const label = `${item.name} - ₹${item.prices?.dineIn || item.prices?.delivery || ''}`;
    const printData = generateESCPOSBarcodeCommands(item.barcode, label);

    const net = require('net');
    const client = new net.Socket();
    client.connect(parseInt(printerPort, 10), printerIp, () => {
      client.write(printData, () => {
        client.end();
        res.json({ message: 'Barcode label sent to printer', barcode: item.barcode });
      });
    });
    client.on('error', (err) => {
      res.status(500).json({ message: `Printer error: ${err.message}` });
    });
  } catch (error) {
    next(error);
  }
};
