const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const RawMaterial = require('../models/RawMaterial');
const StockMovement = require('../models/StockMovement');
const AuditLog = require('../models/AuditLog');
const BillSequence = require('../models/BillSequence');

// ─── SUPPLIERS ──────────────────────────────────────────

exports.createSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.create(req.body);
    res.status(201).json({ supplier });
  } catch (error) {
    next(error);
  }
};

exports.getSuppliers = async (req, res, next) => {
  try {
    const { search, category, active } = req.query;
    const filter = {};
    if (search) filter.$text = { $search: search };
    if (category) filter.category = category;
    if (active !== undefined) filter.isActive = active === 'true';

    const suppliers = await Supplier.find(filter).sort({ name: 1 });
    res.json({ suppliers });
  } catch (error) {
    next(error);
  }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json({ supplier });
  } catch (error) {
    next(error);
  }
};

// ─── PURCHASE ORDERS ────────────────────────────────────

exports.createPurchaseOrder = async (req, res, next) => {
  try {
    const { supplierId, items, notes, expectedDelivery, invoiceNumber, invoiceDate, gstAmount } = req.body;
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });

    const poNum = await BillSequence.getNextNumber('PO');
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const po = new PurchaseOrder({
      poNumber: `PO-${dateStr}-${String(poNum).padStart(4, '0')}`,
      supplier: supplierId,
      supplierName: supplier.name,
      items: items.map(item => ({
        ...item,
        totalPrice: item.quantity * item.unitPrice,
      })),
      gstAmount: gstAmount || 0,
      notes,
      expectedDelivery,
      invoiceNumber,
      invoiceDate,
      orderedBy: req.user._id,
      status: 'ordered',
    });
    po.calculateTotals();
    await po.save();

    // Update supplier stats
    supplier.totalOrders += 1;
    supplier.lastOrderDate = new Date();
    await supplier.save();

    await AuditLog.create({
      action: 'create',
      module: 'purchase',
      documentId: po._id,
      documentNumber: po.poNumber,
      description: `Purchase order ${po.poNumber} created for ${supplier.name} (₹${po.total})`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.status(201).json({ purchaseOrder: po });
  } catch (error) {
    next(error);
  }
};

exports.getPurchaseOrders = async (req, res, next) => {
  try {
    const { status, supplier, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (supplier) filter.supplier = supplier;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const orders = await PurchaseOrder.find(filter)
      .populate('supplier', 'name phone')
      .populate('orderedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await PurchaseOrder.countDocuments(filter);
    res.json({ purchaseOrders: orders, total, page: parseInt(page, 10), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

// GRN — Receive goods against a purchase order
exports.receiveGoods = async (req, res, next) => {
  try {
    const { receivedItems } = req.body; // [{ itemId, receivedQty, acceptedQty, rejectedQty, rejectionReason }]
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ message: 'Purchase order not found' });
    if (po.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot receive goods for a cancelled order' });
    }

    for (const recv of receivedItems) {
      const poItem = po.items.id(recv.itemId);
      if (!poItem) continue;

      const accepted = recv.acceptedQty || recv.receivedQty;
      const rejected = recv.rejectedQty || 0;

      // Record in GRN
      po.receivedItems.push({
        item: recv.itemId,
        receivedQty: recv.receivedQty,
        acceptedQty: accepted,
        rejectedQty: rejected,
        rejectionReason: recv.rejectionReason,
        receivedAt: new Date(),
        receivedBy: req.user._id,
      });

      // Update raw material stock
      const material = await RawMaterial.findById(poItem.rawMaterial);
      if (material) {
        const previousStock = material.currentStock;
        material.currentStock += accepted;
        if (poItem.expiryDate) material.expiryDate = poItem.expiryDate;
        // Update cost using weighted average
        const totalValue = (previousStock * material.costPerUnit) + (accepted * poItem.unitPrice);
        material.costPerUnit = material.currentStock > 0 ? totalValue / material.currentStock : poItem.unitPrice;
        await material.save();

        // Stock movement record
        await StockMovement.create({
          rawMaterial: material._id,
          type: 'purchase',
          quantity: accepted,
          unit: material.unit,
          previousStock,
          newStock: material.currentStock,
          unitCost: poItem.unitPrice,
          totalCost: accepted * poItem.unitPrice,
          reference: po.poNumber,
          notes: `GRN for ${po.poNumber}${rejected > 0 ? ` (${rejected} rejected)` : ''}`,
          createdBy: req.user._id,
        });
      }
    }

    // Update PO status
    const allReceived = po.items.every(item => {
      const totalRecvd = po.receivedItems
        .filter(r => r.item.toString() === item._id.toString())
        .reduce((sum, r) => sum + r.acceptedQty, 0);
      return totalRecvd >= item.quantity;
    });
    po.status = allReceived ? 'received' : 'partial_received';
    po.deliveredAt = allReceived ? new Date() : undefined;
    await po.save();

    // Update supplier spending
    const totalCost = receivedItems.reduce((sum, r) => {
      const poItem = po.items.id(r.itemId);
      return sum + ((r.acceptedQty || r.receivedQty) * (poItem?.unitPrice || 0));
    }, 0);
    await Supplier.findByIdAndUpdate(po.supplier, { $inc: { totalSpent: totalCost } });

    await AuditLog.create({
      action: 'grn',
      module: 'purchase',
      documentId: po._id,
      documentNumber: po.poNumber,
      description: `GRN processed for ${po.poNumber}. ${receivedItems.length} items received.`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.json({ purchaseOrder: po, message: `Goods received. Status: ${po.status}` });
  } catch (error) {
    next(error);
  }
};

// Record purchase payment
exports.recordPayment = async (req, res, next) => {
  try {
    const { amount, paymentMethod } = req.body;
    const po = await PurchaseOrder.findById(req.params.id).populate('supplier');
    if (!po) return res.status(404).json({ message: 'Purchase order not found' });

    po.paidAmount += amount;
    po.paymentMethod = paymentMethod;
    po.paymentStatus = po.paidAmount >= po.total ? 'paid' : 'partial';
    await po.save();

    // Update supplier balance
    if (po.supplier) {
      po.supplier.currentBalance = Math.max(0, po.supplier.currentBalance - amount);
      await po.supplier.save();
    }

    await AuditLog.create({
      action: 'payment',
      module: 'purchase',
      documentId: po._id,
      documentNumber: po.poNumber,
      description: `Payment ₹${amount} (${paymentMethod}) for ${po.poNumber}. Total paid: ₹${po.paidAmount}/${po.total}`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.json({ purchaseOrder: po, message: `Payment of ₹${amount} recorded` });
  } catch (error) {
    next(error);
  }
};
