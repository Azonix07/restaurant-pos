const KOT = require('../models/KOT');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Recipe = require('../models/Recipe');
const BillSequence = require('../models/BillSequence');
const net = require('net');

// Generate KOT number
const generateKotNumber = async (section) => {
  const num = await BillSequence.getNextNumber(`KOT-${section.toUpperCase()}`);
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  return `KOT-${section.toUpperCase().substring(0, 3)}-${dateStr}-${String(num).padStart(4, '0')}`;
};

// Determine kitchen section for a menu item
const getItemSection = async (menuItemId, itemName) => {
  // 1. Check the menu item's own kitchenSection field first (highest priority)
  const menuItem = await MenuItem.findById(menuItemId);
  if (!menuItem) return 'kitchen';
  if (menuItem.kitchenSection && menuItem.kitchenSection !== 'kitchen') return menuItem.kitchenSection;

  // 2. Check if recipe has section defined
  const recipe = await Recipe.findOne({ menuItem: menuItemId });
  if (recipe && recipe.kitchenSection) return recipe.kitchenSection;

  // 3. Fallback: determine by category name and veg/nonveg heuristics
  const cat = menuItem.category.toLowerCase();
  if (cat.includes('juice') || cat.includes('smoothie') || cat.includes('shake') || cat.includes('lassi')) return 'juice_counter';
  if (cat.includes('bake') || cat.includes('bread') || cat.includes('cake') || cat.includes('pastry')) return 'bakery';
  if (cat.includes('bar') || cat.includes('drink') || cat.includes('cocktail') || cat.includes('alcohol') || cat.includes('beer') || cat.includes('wine')) return 'bar';
  if (cat.includes('dessert') || cat.includes('sweet') || cat.includes('ice cream')) return 'desserts';

  // 4. Veg/Non-Veg routing based on item property
  if (menuItem.isVeg === false) return 'nonveg_kitchen';
  if (menuItem.isVeg === true) return 'veg_kitchen';

  return menuItem.kitchenSection || 'kitchen';
};

// Generate KOTs for a new order - split by kitchen section
exports.generateKOTs = async (order, userId, io) => {
  const sectionItems = {};

  for (const item of order.items) {
    if (item.status === 'cancelled') continue;
    const section = await getItemSection(item.menuItem, item.name);
    if (!sectionItems[section]) sectionItems[section] = [];
    sectionItems[section].push({
      menuItem: item.menuItem,
      name: item.name,
      quantity: item.quantity,
      notes: item.notes || '',
      status: 'pending',
      isDelta: false,
    });
  }

  const kots = [];
  for (const [section, items] of Object.entries(sectionItems)) {
    const kotNumber = await generateKotNumber(section);
    const kot = await KOT.create({
      kotNumber,
      order: order._id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      section,
      items,
      isDelta: false,
      createdBy: userId,
    });
    kots.push(kot);

    // Emit section-specific KOT event
    if (io) {
      io.to(section).emit('kot:new', kot);
      io.emit('kot:new', kot);
    }
  }

  return kots;
};

// Generate delta KOT for added items
exports.generateDeltaKOT = async (order, newItems, userId, io) => {
  const sectionItems = {};

  for (const item of newItems) {
    const section = await getItemSection(item.menuItem, item.name);
    if (!sectionItems[section]) sectionItems[section] = [];
    sectionItems[section].push({
      menuItem: item.menuItem,
      name: item.name,
      quantity: item.quantity,
      notes: item.notes || '',
      status: 'pending',
      isDelta: true,
    });
  }

  const kots = [];
  for (const [section, items] of Object.entries(sectionItems)) {
    const kotNumber = await generateKotNumber(section);
    const kot = await KOT.create({
      kotNumber,
      order: order._id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      section,
      items,
      isDelta: true,
      createdBy: userId,
    });
    kots.push(kot);

    if (io) {
      io.to(section).emit('kot:new', kot);
      io.emit('kot:new', kot);
    }
  }

  return kots;
};

// Get KOTs by section
exports.getBySection = async (req, res, next) => {
  try {
    const { section } = req.params;
    const { status } = req.query;
    const filter = { section };
    if (status) filter.status = status;
    else filter.status = { $in: ['pending', 'acknowledged', 'preparing'] };

    const kots = await KOT.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: 1 });
    res.json({ kots });
  } catch (error) {
    next(error);
  }
};

// Get all active KOTs
exports.getActive = async (req, res, next) => {
  try {
    const kots = await KOT.find({ status: { $in: ['pending', 'acknowledged', 'preparing'] } })
      .populate('createdBy', 'name')
      .sort({ createdAt: 1 });
    res.json({ kots });
  } catch (error) {
    next(error);
  }
};

// Get KOTs for specific order
exports.getByOrder = async (req, res, next) => {
  try {
    const kots = await KOT.find({ order: req.params.orderId })
      .populate('createdBy', 'name')
      .sort({ createdAt: 1 });
    res.json({ kots });
  } catch (error) {
    next(error);
  }
};

// Update KOT status
exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const kot = await KOT.findById(req.params.id);
    if (!kot) return res.status(404).json({ message: 'KOT not found' });

    kot.status = status;
    if (status === 'acknowledged') kot.acknowledgedBy = req.user._id;
    if (status === 'completed') kot.completedAt = new Date();
    await kot.save();

    const io = req.app.get('io');
    if (io) {
      io.to(kot.section).emit('kot:update', kot);
      io.emit('kot:update', kot);
    }

    res.json({ kot });
  } catch (error) {
    next(error);
  }
};

// Update individual KOT item status
exports.updateItemStatus = async (req, res, next) => {
  try {
    const { itemId, status } = req.body;
    const kot = await KOT.findById(req.params.id);
    if (!kot) return res.status(404).json({ message: 'KOT not found' });

    const item = kot.items.id(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found in KOT' });

    item.status = status;

    // Auto-update KOT status
    const allItems = kot.items;
    if (allItems.every(i => i.status === 'completed' || i.status === 'cancelled')) {
      kot.status = 'completed';
      kot.completedAt = new Date();
    } else if (allItems.some(i => i.status === 'preparing')) {
      kot.status = 'preparing';
    } else if (allItems.every(i => i.status === 'acknowledged' || i.status === 'completed' || i.status === 'cancelled')) {
      kot.status = 'acknowledged';
    }

    await kot.save();

    const io = req.app.get('io');
    if (io) {
      io.to(kot.section).emit('kot:update', kot);
      io.emit('kot:update', kot);
    }

    res.json({ kot });
  } catch (error) {
    next(error);
  }
};

// Print KOT to LAN thermal printer
exports.printKOT = async (req, res, next) => {
  try {
    const kot = await KOT.findById(req.params.id).populate('createdBy', 'name');
    if (!kot) return res.status(404).json({ message: 'KOT not found' });

    const { printerIp, printerPort } = req.body;
    if (!printerIp) return res.status(400).json({ message: 'Printer IP required' });

    // Build ESC/POS receipt data
    const escpos = buildKotPrintData(kot);

    // Send to LAN printer
    await sendToPrinter(printerIp, printerPort || 9100, escpos);

    kot.printedAt = new Date();
    kot.printerIp = printerIp;
    kot.printCount += 1;
    await kot.save();

    const io = req.app.get('io');
    if (io) io.emit('kot:print', { kotId: kot._id, section: kot.section });

    res.json({ message: 'KOT sent to printer', kot });
  } catch (error) {
    next(error);
  }
};

// Compare KOT vs billed items for mismatch detection
exports.verifyBilling = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const kots = await KOT.find({ order: orderId, status: { $ne: 'cancelled' } });

    // Aggregate all KOT items
    const kotItems = {};
    for (const kot of kots) {
      for (const item of kot.items) {
        if (item.status === 'cancelled') continue;
        const key = item.menuItem.toString();
        kotItems[key] = (kotItems[key] || 0) + item.quantity;
      }
    }

    // Aggregate order items
    const orderItems = {};
    for (const item of order.items) {
      if (item.status === 'cancelled') continue;
      const key = item.menuItem.toString();
      orderItems[key] = (orderItems[key] || 0) + item.quantity;
    }

    // Compare
    const mismatches = [];
    const allKeys = new Set([...Object.keys(kotItems), ...Object.keys(orderItems)]);
    for (const key of allKeys) {
      const kotQty = kotItems[key] || 0;
      const orderQty = orderItems[key] || 0;
      if (kotQty !== orderQty) {
        mismatches.push({
          menuItem: key,
          kotQuantity: kotQty,
          billedQuantity: orderQty,
          difference: orderQty - kotQty,
        });
      }
    }

    res.json({
      orderId,
      orderNumber: order.orderNumber,
      isMatch: mismatches.length === 0,
      mismatches,
      kotCount: kots.length,
    });
  } catch (error) {
    next(error);
  }
};

// Edit KOT item quantity
exports.editItemQuantity = async (req, res, next) => {
  try {
    const { itemId, quantity } = req.body;
    if (!quantity || quantity < 1) return res.status(400).json({ message: 'Quantity must be at least 1' });

    const kot = await KOT.findById(req.params.id);
    if (!kot) return res.status(404).json({ message: 'KOT not found' });
    if (kot.status === 'completed' || kot.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot edit a completed/cancelled KOT' });
    }

    const item = kot.items.id(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found in KOT' });
    if (item.status === 'completed' || item.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot edit completed/cancelled item' });
    }

    item.quantity = quantity;
    await kot.save();

    const io = req.app.get('io');
    if (io) {
      io.to(kot.section).emit('kot:update', kot);
      io.emit('kot:update', kot);
    }

    res.json({ kot });
  } catch (error) {
    next(error);
  }
};

// Cancel a KOT item
exports.cancelItem = async (req, res, next) => {
  try {
    const { itemId, reason } = req.body;
    const kot = await KOT.findById(req.params.id);
    if (!kot) return res.status(404).json({ message: 'KOT not found' });

    const item = kot.items.id(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found in KOT' });

    // Prevent cancel if item is already being prepared — require manager/admin role
    if (item.status === 'preparing') {
      const userRole = req.user?.role;
      if (userRole !== 'admin' && userRole !== 'manager') {
        return res.status(403).json({
          message: 'Item is being prepared. Manager/Admin approval required to cancel.',
          requiresApproval: true,
        });
      }
    }

    if (item.status === 'completed') {
      return res.status(400).json({ message: 'Cannot cancel a completed item' });
    }

    item.status = 'cancelled';
    item.cancelReason = reason || '';
    item.cancelledBy = req.user?._id;

    // Auto-complete KOT if all items are done
    if (kot.items.every(i => i.status === 'completed' || i.status === 'cancelled')) {
      kot.status = 'completed';
      kot.completedAt = new Date();
    }

    await kot.save();

    // Audit log for KOT cancellation
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      action: 'cancel',
      module: 'kot_item',
      documentId: kot._id,
      documentNumber: kot.kotNumber,
      description: `KOT item "${item.name}" cancelled. Reason: ${reason || 'No reason'}`,
      user: req.user?._id,
      userName: req.user?.name,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(kot.section).emit('kot:update', kot);
      io.emit('kot:update', kot);
    }

    res.json({ kot });
  } catch (error) {
    next(error);
  }
};

// Cancel entire KOT
exports.cancelKOT = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const kot = await KOT.findById(req.params.id);
    if (!kot) return res.status(404).json({ message: 'KOT not found' });
    if (kot.status === 'completed') {
      return res.status(400).json({ message: 'Cannot cancel completed KOT' });
    }

    // If any item is being prepared, require manager/admin
    const hasPreparing = kot.items.some(i => i.status === 'preparing');
    if (hasPreparing) {
      const userRole = req.user?.role;
      if (userRole !== 'admin' && userRole !== 'manager') {
        return res.status(403).json({
          message: 'Some items are being prepared. Manager/Admin approval required.',
          requiresApproval: true,
        });
      }
    }

    kot.status = 'cancelled';
    kot.cancelReason = reason || '';
    kot.items.forEach(item => {
      if (item.status !== 'completed') {
        item.status = 'cancelled';
        item.cancelledBy = req.user?._id;
      }
    });
    await kot.save();

    // Audit log
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      action: 'cancel',
      module: 'kot',
      documentId: kot._id,
      documentNumber: kot.kotNumber,
      description: `KOT ${kot.kotNumber} cancelled. Reason: ${reason || 'No reason'}`,
      user: req.user?._id,
      userName: req.user?.name,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(kot.section).emit('kot:update', kot);
      io.emit('kot:update', kot);
    }

    res.json({ kot });
  } catch (error) {
    next(error);
  }
};

// ---- UTILITY FUNCTIONS ----

function buildKotPrintData(kot) {
  const ESC = '\x1B';
  const GS = '\x1D';
  let data = '';

  // Initialize printer
  data += ESC + '@'; // Reset
  data += ESC + 'a' + '\x01'; // Center align

  // Header
  data += GS + '!' + '\x11'; // Double width+height
  data += `KOT - ${kot.section.toUpperCase()}\n`;
  data += GS + '!' + '\x00'; // Normal size
  data += kot.isDelta ? '*** ADDITIONAL ITEMS ***\n' : '';
  data += '================================\n';

  // Order info
  data += ESC + 'a' + '\x00'; // Left align
  data += `KOT#: ${kot.kotNumber}\n`;
  data += `Order: ${kot.orderNumber}\n`;
  if (kot.tableNumber) data += `Table: ${kot.tableNumber}\n`;
  data += `Time: ${new Date(kot.createdAt).toLocaleTimeString()}\n`;
  data += '--------------------------------\n';

  // Items
  data += GS + '!' + '\x01'; // Slightly larger
  for (const item of kot.items) {
    data += `${item.quantity}x ${item.name}\n`;
    if (item.notes) data += `   >> ${item.notes}\n`;
  }
  data += GS + '!' + '\x00';
  data += '================================\n';

  // Footer
  data += ESC + 'a' + '\x01';
  data += `Waiter: ${kot.createdBy?.name || 'N/A'}\n\n`;

  // Cut paper
  data += GS + 'V' + '\x41' + '\x03';

  return data;
}

function sendToPrinter(ip, port, data) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.setTimeout(5000);

    client.connect(port, ip, () => {
      client.write(data, () => {
        client.end();
        resolve();
      });
    });

    client.on('error', (err) => {
      client.destroy();
      reject(new Error(`Printer connection failed: ${err.message}`));
    });

    client.on('timeout', () => {
      client.destroy();
      reject(new Error('Printer connection timeout'));
    });
  });
}
