const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Party = require('../models/Party');
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const MenuItem = require('../models/MenuItem');

// ─── Export to Tally ─────────────────────────────────────
exports.exportToTally = async (req, res, next) => {
  try {
    const { startDate, endDate, modules } = req.body;
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);

    const exportData = { exportDate: new Date(), period: { startDate: start, endDate: end } };

    // Export Ledgers (Parties as ledgers)
    if (!modules || modules.includes('ledgers')) {
      const parties = await Party.find({ isActive: true });
      exportData.ledgers = parties.map(p => ({
        name: p.name,
        parent: p.type === 'customer' ? 'Sundry Debtors' : 'Sundry Creditors',
        openingBalance: p.currentBalance,
        gstin: p.gstin,
        address: p.billingAddress ? `${p.billingAddress.line1 || ''}, ${p.billingAddress.city || ''}, ${p.billingAddress.state || ''}` : '',
      }));
    }

    // Export Vouchers (Invoices as vouchers)
    if (!modules || modules.includes('vouchers')) {
      const invoices = await Invoice.find({
        date: { $gte: start, $lte: end },
        isCancelled: false, isDeleted: false,
      }).populate('party', 'name');

      exportData.vouchers = invoices.map(inv => ({
        voucherType: inv.type === 'sale' ? 'Sales' : 'Purchase',
        number: inv.invoiceNumber,
        date: inv.date,
        partyName: inv.partyName || inv.party?.name || 'Cash',
        amount: inv.total,
        items: inv.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          gstRate: item.gstRate,
        })),
      }));
    }

    // Export Expenses as Journal entries
    if (!modules || modules.includes('expenses')) {
      const expenses = await Expense.find({ date: { $gte: start, $lte: end } });
      exportData.expenses = expenses.map(e => ({
        voucherType: 'Journal',
        date: e.date,
        narration: e.title,
        debitLedger: e.category.charAt(0).toUpperCase() + e.category.slice(1),
        creditLedger: 'Cash',
        amount: e.amount,
      }));
    }

    // Export Stock Items
    if (!modules || modules.includes('stockItems')) {
      const items = await MenuItem.find({});
      exportData.stockItems = items.map(item => ({
        name: item.name,
        category: item.category,
        rate: item.price,
        gstRate: item.gstCategory === 'food_non_ac' ? 5 : item.gstCategory === 'beverage' ? 18 : item.gstCategory === 'alcohol' ? 28 : 5,
      }));
    }

    // Generate Tally XML format
    const tallyXml = generateTallyXml(exportData);

    res.json({ exportData, tallyXml, message: 'Export data generated for Tally' });
  } catch (error) { next(error); }
};

// ─── Import from Tally ───────────────────────────────────
exports.importFromTally = async (req, res, next) => {
  try {
    const { ledgers, vouchers, stockItems } = req.body;
    const results = { ledgers: 0, vouchers: 0, stockItems: 0, errors: [] };

    // Import ledgers as parties
    if (Array.isArray(ledgers)) {
      for (const l of ledgers) {
        try {
          const exists = await Party.findOne({ name: l.name });
          if (!exists) {
            await Party.create({
              name: l.name,
              type: l.parent === 'Sundry Debtors' ? 'customer' : 'supplier',
              gstin: l.gstin,
              currentBalance: l.openingBalance || 0,
              createdBy: req.user._id,
            });
            results.ledgers++;
          }
        } catch (err) {
          results.errors.push({ type: 'ledger', name: l.name, error: err.message });
        }
      }
    }

    // Import stock items as menu items
    if (Array.isArray(stockItems)) {
      for (const item of stockItems) {
        try {
          const exists = await MenuItem.findOne({ name: item.name });
          if (!exists) {
            await MenuItem.create({
              name: item.name,
              category: item.category || 'Imported',
              price: item.rate || 0,
              isAvailable: true,
            });
            results.stockItems++;
          }
        } catch (err) {
          results.errors.push({ type: 'stockItem', name: item.name, error: err.message });
        }
      }
    }

    res.json({ message: 'Import complete', results });
  } catch (error) { next(error); }
};

function generateTallyXml(data) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n<HEADER>\n<TALLYREQUEST>Import Data</TALLYREQUEST>\n</HEADER>\n<BODY>\n<IMPORTDATA>\n<REQUESTDESC>\n<REPORTNAME>All Masters</REPORTNAME>\n</REQUESTDESC>\n<REQUESTDATA>\n';

  if (data.ledgers) {
    data.ledgers.forEach(l => {
      xml += `<TALLYMESSAGE>\n<LEDGER NAME="${l.name}" ACTION="Create">\n<NAME>${l.name}</NAME>\n<PARENT>${l.parent}</PARENT>\n<OPENINGBALANCE>${l.openingBalance || 0}</OPENINGBALANCE>\n`;
      if (l.gstin) xml += `<PARTYGSTIN>${l.gstin}</PARTYGSTIN>\n`;
      xml += `</LEDGER>\n</TALLYMESSAGE>\n`;
    });
  }

  if (data.stockItems) {
    data.stockItems.forEach(item => {
      xml += `<TALLYMESSAGE>\n<STOCKITEM NAME="${item.name}" ACTION="Create">\n<NAME>${item.name}</NAME>\n<PARENT>${item.category}</PARENT>\n<OPENINGRATE>${item.rate}</OPENINGRATE>\n</STOCKITEM>\n</TALLYMESSAGE>\n`;
    });
  }

  xml += '</REQUESTDATA>\n</IMPORTDATA>\n</BODY>\n</ENVELOPE>';
  return xml;
}
