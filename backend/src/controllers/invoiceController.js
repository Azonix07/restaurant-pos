const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const Party = require('../models/Party');
const AuditLog = require('../models/AuditLog');
const RecycleBin = require('../models/RecycleBin');
const crypto = require('crypto');

// ─── Invoice Number Generation ──────────────────────────
const generateInvoiceNumber = async (type = 'sale') => {
  const prefixMap = { sale: 'INV', purchase: 'PUR', credit_note: 'CN', debit_note: 'DN' };
  const prefix = prefixMap[type] || 'INV';
  const today = new Date();
  const yymm = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
  const count = await Invoice.countDocuments({ invoiceNumber: { $regex: `^${prefix}${yymm}` } });
  return `${prefix}${yymm}-${String(count + 1).padStart(4, '0')}`;
};

// ─── CRUD ────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const { type, status, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = { isDeleted: false };
    if (type) filter.type = type;
    if (status) filter.paymentStatus = status;
    if (startDate && endDate) {
      const s = new Date(startDate); s.setHours(0, 0, 0, 0);
      const e = new Date(endDate); e.setHours(23, 59, 59, 999);
      filter.date = { $gte: s, $lte: e };
    }
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const invoices = await Invoice.find(filter)
      .populate('party', 'name phone gstin')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));
    const total = await Invoice.countDocuments(filter);
    res.json({ invoices, total, page: parseInt(page, 10), pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('party')
      .populate('orders');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json({ invoice });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const invoiceNumber = await generateInvoiceNumber(req.body.type);
    const invoice = new Invoice({ ...req.body, invoiceNumber, createdBy: req.user._id });
    invoice.calculateTotals();
    await invoice.save();

    // Update party balance if party linked
    if (invoice.party) {
      await Party.findByIdAndUpdate(invoice.party, { $inc: { currentBalance: invoice.balanceDue } });
    }

    await AuditLog.create({
      action: 'create', module: 'invoice', documentId: invoice._id,
      documentNumber: invoiceNumber,
      description: `Invoice created: ${invoiceNumber}`,
      user: req.user._id, userName: req.user.name,
    });
    res.status(201).json({ invoice });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.isCancelled) return res.status(400).json({ message: 'Cannot edit cancelled invoice' });

    const oldBalance = invoice.balanceDue;
    Object.assign(invoice, req.body);
    invoice.calculateTotals();
    await invoice.save();

    // Update party balance difference
    if (invoice.party) {
      const diff = invoice.balanceDue - oldBalance;
      if (diff !== 0) await Party.findByIdAndUpdate(invoice.party, { $inc: { currentBalance: diff } });
    }

    await AuditLog.create({
      action: 'update', module: 'invoice', documentId: invoice._id,
      documentNumber: invoice.invoiceNumber,
      description: `Invoice updated: ${invoice.invoiceNumber}`,
      user: req.user._id, userName: req.user.name,
    });
    res.json({ invoice });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    await RecycleBin.create({
      originalModel: 'Invoice', originalId: invoice._id,
      data: invoice.toObject(),
      deletedBy: req.user._id, deletedByName: req.user.name,
    });
    invoice.isDeleted = true;
    invoice.deletedAt = new Date();
    await invoice.save();

    // Reverse party balance
    if (invoice.party) {
      await Party.findByIdAndUpdate(invoice.party, { $inc: { currentBalance: -invoice.balanceDue } });
    }

    await AuditLog.create({
      action: 'delete', module: 'invoice', documentId: invoice._id,
      documentNumber: invoice.invoiceNumber,
      description: `Invoice deleted: ${invoice.invoiceNumber}`,
      user: req.user._id, userName: req.user.name,
    });
    res.json({ message: 'Invoice moved to recycle bin' });
  } catch (error) { next(error); }
};

// ─── Combine Orders into Invoice ─────────────────────────
exports.combineOrders = async (req, res, next) => {
  try {
    const { orderIds, partyId } = req.body;
    if (!orderIds || orderIds.length === 0) {
      return res.status(400).json({ message: 'Provide order IDs to combine' });
    }

    const orders = await Order.find({ _id: { $in: orderIds } });
    if (orders.length === 0) return res.status(404).json({ message: 'No orders found' });

    const items = [];
    for (const order of orders) {
      for (const item of order.items) {
        if (item.status !== 'cancelled') {
          items.push({
            menuItem: item.menuItem,
            name: item.name,
            quantity: item.quantity,
            rate: item.price,
            gstRate: item.gstRate || 5,
            amount: item.price * item.quantity,
          });
        }
      }
    }

    const invoiceNumber = await generateInvoiceNumber('sale');
    const invoice = new Invoice({
      invoiceNumber,
      type: 'sale',
      party: partyId || undefined,
      orders: orderIds,
      items,
      createdBy: req.user._id,
    });
    invoice.calculateTotals();
    await invoice.save();

    await AuditLog.create({
      action: 'create', module: 'invoice', documentId: invoice._id,
      documentNumber: invoiceNumber,
      description: `Combined ${orders.length} orders into invoice ${invoiceNumber}`,
      user: req.user._id, userName: req.user.name,
    });

    res.status(201).json({ invoice });
  } catch (error) { next(error); }
};

// ─── Cancel Sale ─────────────────────────────────────────
exports.cancelInvoice = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.isCancelled) return res.status(400).json({ message: 'Already cancelled' });

    invoice.isCancelled = true;
    invoice.cancelReason = reason;
    invoice.cancelledAt = new Date();
    await invoice.save();

    if (invoice.party) {
      await Party.findByIdAndUpdate(invoice.party, { $inc: { currentBalance: -invoice.balanceDue } });
    }

    await AuditLog.create({
      action: 'cancel', module: 'invoice', documentId: invoice._id,
      documentNumber: invoice.invoiceNumber,
      description: `Invoice cancelled: ${invoice.invoiceNumber}. Reason: ${reason}`,
      user: req.user._id, userName: req.user.name,
    });
    res.json({ invoice, message: 'Invoice cancelled' });
  } catch (error) { next(error); }
};

// ─── E-Invoice ───────────────────────────────────────────
exports.generateEInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('party');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.eInvoiceStatus === 'generated') {
      return res.status(400).json({ message: 'E-Invoice already generated' });
    }

    // Generate IRN (simulated - in production, call GST portal API)
    const irn = crypto.randomBytes(32).toString('hex');
    const ackNumber = String(Date.now());

    invoice.eInvoiceStatus = 'generated';
    invoice.irn = irn;
    invoice.ackNumber = ackNumber;
    invoice.ackDate = new Date();
    await invoice.save();

    await AuditLog.create({
      action: 'e-invoice', module: 'invoice', documentId: invoice._id,
      documentNumber: invoice.invoiceNumber,
      description: `E-Invoice generated for ${invoice.invoiceNumber}. IRN: ${irn.substring(0, 16)}...`,
      user: req.user._id, userName: req.user.name,
    });

    res.json({ invoice, irn, ackNumber, message: 'E-Invoice generated successfully' });
  } catch (error) { next(error); }
};

// ─── E-Way Bill ──────────────────────────────────────────
exports.generateEWayBill = async (req, res, next) => {
  try {
    const { transporterName, transporterId, vehicleNumber } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.total < 50000) {
      return res.status(400).json({ message: 'E-Way bill required only for invoices above ₹50,000' });
    }

    // Simulated e-way bill number
    const eWayBillNumber = `EWB${Date.now()}`;

    invoice.eWayBillStatus = 'generated';
    invoice.eWayBillNumber = eWayBillNumber;
    invoice.eWayBillDate = new Date();
    invoice.transporterName = transporterName;
    invoice.transporterId = transporterId;
    invoice.vehicleNumber = vehicleNumber;
    await invoice.save();

    await AuditLog.create({
      action: 'eway-bill', module: 'invoice', documentId: invoice._id,
      documentNumber: invoice.invoiceNumber,
      description: `E-Way bill generated: ${eWayBillNumber}`,
      user: req.user._id, userName: req.user.name,
    });

    res.json({ invoice, eWayBillNumber, message: 'E-Way Bill generated' });
  } catch (error) { next(error); }
};

// ─── WhatsApp Invoice ────────────────────────────────────
exports.sendWhatsAppInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('party');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const phone = invoice.party?.phone || req.body.phone;
    if (!phone) return res.status(400).json({ message: 'No phone number available' });

    // Generate WhatsApp deep link (wa.me API)
    const message = encodeURIComponent(
      `Invoice ${invoice.invoiceNumber}\n` +
      `Date: ${new Date(invoice.date).toLocaleDateString('en-IN')}\n` +
      `Items: ${invoice.items.length}\n` +
      `Subtotal: ₹${invoice.subtotal?.toFixed(2)}\n` +
      `GST: ₹${invoice.totalGst?.toFixed(2)}\n` +
      `Total: ₹${invoice.total?.toFixed(2)}\n` +
      `Balance Due: ₹${invoice.balanceDue?.toFixed(2)}\n\n` +
      `Thank you for your business!`
    );
    const cleanPhone = phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}?text=${message}`;

    invoice.whatsappSent = true;
    invoice.whatsappSentAt = new Date();
    await invoice.save();

    res.json({ whatsappUrl, message: 'WhatsApp link generated' });
  } catch (error) { next(error); }
};

// ─── Record Payment ──────────────────────────────────────
exports.recordPayment = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    invoice.amountPaid += amount;
    invoice.balanceDue = invoice.total - invoice.amountPaid;
    invoice.paymentStatus = invoice.balanceDue <= 0 ? 'paid' : 'partial';
    await invoice.save();

    if (invoice.party) {
      await Party.findByIdAndUpdate(invoice.party, { $inc: { currentBalance: -amount } });
    }

    res.json({ invoice, message: 'Payment recorded' });
  } catch (error) { next(error); }
};
