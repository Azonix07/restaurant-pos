const MenuItem = require('../models/MenuItem');
const { SOCKET_EVENTS } = require('../../../shared/constants');

exports.getAll = async (req, res, next) => {
  try {
    const { category, available, search } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (available !== undefined) filter.isAvailable = available === 'true';
    if (search) filter.$text = { $search: search };

    const items = await MenuItem.find(filter).sort({ category: 1, name: 1 });
    res.json({ items });
  } catch (error) {
    next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await MenuItem.distinct('category');
    res.json({ categories });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const item = await MenuItem.create(req.body);
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
