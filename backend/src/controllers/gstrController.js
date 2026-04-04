const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');

// ─── GSTR-1 (Outward Supplies) ──────────────────────────
exports.getGSTR1 = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month, 10) - 1;
    const y = parseInt(year, 10);
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);

    // B2B - invoices with GSTIN
    const b2bInvoices = await Invoice.find({
      date: { $gte: start, $lte: end },
      type: 'sale',
      isCancelled: false,
      isDeleted: false,
      partyGstin: { $exists: true, $ne: '' },
    }).populate('party', 'name gstin');

    // B2C - orders/invoices without GSTIN
    const b2cOrders = await Order.find({
      createdAt: { $gte: start, $lte: end },
      paymentStatus: 'paid',
    });

    const b2cInvoices = await Invoice.find({
      date: { $gte: start, $lte: end },
      type: 'sale',
      isCancelled: false,
      isDeleted: false,
      $or: [{ partyGstin: { $exists: false } }, { partyGstin: '' }],
    });

    // HSN Summary
    const hsnSummary = {};
    for (const inv of [...b2bInvoices, ...b2cInvoices]) {
      for (const item of inv.items) {
        const hsn = item.hsn || 'N/A';
        if (!hsnSummary[hsn]) hsnSummary[hsn] = { hsn, quantity: 0, taxableValue: 0, gst: 0 };
        hsnSummary[hsn].quantity += item.quantity;
        hsnSummary[hsn].taxableValue += item.amount;
        hsnSummary[hsn].gst += item.amount * item.gstRate / 100;
      }
    }

    const totalB2B = b2bInvoices.reduce((s, i) => s + i.total, 0);
    const totalB2CInvoice = b2cInvoices.reduce((s, i) => s + i.total, 0);
    const totalB2COrders = b2cOrders.reduce((s, o) => s + o.total, 0);

    res.json({
      period: { month, year },
      b2b: { invoices: b2bInvoices.length, total: totalB2B, data: b2bInvoices },
      b2c: { orders: b2cOrders.length, invoices: b2cInvoices.length, total: totalB2CInvoice + totalB2COrders },
      hsnSummary: Object.values(hsnSummary),
      totalTaxableValue: totalB2B + totalB2CInvoice + totalB2COrders,
    });
  } catch (error) { next(error); }
};

// ─── GSTR-3B (Summary Return) ───────────────────────────
exports.getGSTR3B = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month, 10) - 1;
    const y = parseInt(year, 10);
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);

    // Outward supplies
    const salesOrders = await Order.find({
      createdAt: { $gte: start, $lte: end },
      paymentStatus: 'paid',
    });
    const salesInvoices = await Invoice.find({
      date: { $gte: start, $lte: end },
      type: 'sale',
      isCancelled: false, isDeleted: false,
    });

    const totalOutwardTaxable = salesOrders.reduce((s, o) => s + o.subtotal, 0)
      + salesInvoices.reduce((s, i) => s + i.subtotal, 0);
    const totalOutputGST = salesOrders.reduce((s, o) => s + o.gstAmount, 0)
      + salesInvoices.reduce((s, i) => s + i.totalGst, 0);

    // Inward supplies (purchases)
    const purchaseInvoices = await Invoice.find({
      date: { $gte: start, $lte: end },
      type: 'purchase',
      isCancelled: false, isDeleted: false,
    });
    const totalInwardTaxable = purchaseInvoices.reduce((s, i) => s + i.subtotal, 0);
    const totalInputGST = purchaseInvoices.reduce((s, i) => s + i.totalGst, 0);

    const netGSTPayable = totalOutputGST - totalInputGST;

    res.json({
      period: { month, year },
      outwardSupplies: {
        taxableValue: totalOutwardTaxable,
        cgst: totalOutputGST / 2,
        sgst: totalOutputGST / 2,
        igst: 0,
        totalGST: totalOutputGST,
      },
      inwardSupplies: {
        taxableValue: totalInwardTaxable,
        cgst: totalInputGST / 2,
        sgst: totalInputGST / 2,
        igst: 0,
        totalGST: totalInputGST,
      },
      itcAvailable: totalInputGST,
      netGSTPayable: Math.max(0, netGSTPayable),
    });
  } catch (error) { next(error); }
};
