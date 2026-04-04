const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const Order = require('../models/Order');
const Expense = require('../models/Expense');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');

// ─── Chart of Accounts ─────────────────────────────────
exports.getAccounts = async (req, res, next) => {
  try {
    const { type } = req.query;
    const filter = { isActive: true };
    if (type) filter.type = type;
    const accounts = await Account.find(filter).populate('parent', 'name code').sort({ code: 1 });
    res.json({ accounts });
  } catch (error) { next(error); }
};

exports.createAccount = async (req, res, next) => {
  try {
    const account = await Account.create(req.body);
    await AuditLog.create({
      action: 'create', module: 'account', documentId: account._id,
      description: `Account created: ${account.code} - ${account.name}`,
      user: req.user._id, userName: req.user.name,
    });
    res.status(201).json({ account });
  } catch (error) { next(error); }
};

exports.updateAccount = async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ message: 'Account not found' });
    if (account.isSystemAccount) {
      return res.status(400).json({ message: 'Cannot modify system account' });
    }
    Object.assign(account, req.body);
    await account.save();
    res.json({ account });
  } catch (error) { next(error); }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ message: 'Account not found' });
    if (account.isSystemAccount) {
      return res.status(400).json({ message: 'Cannot delete system account' });
    }
    account.isActive = false;
    await account.save();
    res.json({ message: 'Account deactivated' });
  } catch (error) { next(error); }
};

// ─── Journal Entries ────────────────────────────────────
const generateEntryNumber = async () => {
  const today = new Date();
  const prefix = `JE${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
  const count = await JournalEntry.countDocuments({ entryNumber: { $regex: `^${prefix}` } });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
};

exports.getJournalEntries = async (req, res, next) => {
  try {
    const { startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (startDate && endDate) {
      const start = new Date(startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(endDate); end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const entries = await JournalEntry.find(filter)
      .populate('lines.account', 'name code')
      .populate('createdBy', 'name')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));
    const total = await JournalEntry.countDocuments(filter);
    res.json({ entries, total, page: parseInt(page, 10), pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
};

exports.createJournalEntry = async (req, res, next) => {
  try {
    const { date, lines, narration, reference, referenceType } = req.body;

    // Validate debits = credits
    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ message: 'Debits must equal credits' });
    }

    const entryNumber = await generateEntryNumber();
    const entry = await JournalEntry.create({
      entryNumber, date, lines, narration, reference, referenceType,
      createdBy: req.user._id,
    });

    // Update account balances atomically to prevent race conditions
    for (const line of lines) {
      const account = await Account.findById(line.account);
      if (account) {
        let delta;
        // Assets/Expenses increase with debit; Liabilities/Equity/Income increase with credit
        if (['asset', 'expense'].includes(account.type)) {
          delta = (line.debit || 0) - (line.credit || 0);
        } else {
          delta = (line.credit || 0) - (line.debit || 0);
        }
        await Account.findByIdAndUpdate(account._id, { $inc: { currentBalance: delta } });
      }
    }

    await AuditLog.create({
      action: 'create', module: 'journal', documentId: entry._id,
      documentNumber: entryNumber,
      description: `Journal entry created: ${entryNumber}`,
      user: req.user._id, userName: req.user.name,
    });

    const populated = await JournalEntry.findById(entry._id)
      .populate('lines.account', 'name code')
      .populate('createdBy', 'name');
    res.status(201).json({ entry: populated });
  } catch (error) { next(error); }
};

// ─── Account Statement ──────────────────────────────────
exports.getAccountStatement = async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { startDate, endDate } = req.query;
    const account = await Account.findById(accountId);
    if (!account) return res.status(404).json({ message: 'Account not found' });

    const filter = { 'lines.account': accountId };
    if (startDate && endDate) {
      const start = new Date(startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(endDate); end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const entries = await JournalEntry.find(filter)
      .populate('lines.account', 'name code')
      .sort({ date: 1 });

    const statement = [];
    let runningBalance = account.openingBalance;
    for (const entry of entries) {
      for (const line of entry.lines) {
        if (line.account && line.account._id && line.account._id.toString() === accountId) {
          runningBalance += (line.debit || 0) - (line.credit || 0);
          statement.push({
            date: entry.date,
            entryNumber: entry.entryNumber,
            narration: line.narration || entry.narration,
            debit: line.debit,
            credit: line.credit,
            balance: runningBalance,
          });
        }
      }
    }

    res.json({ account, statement, closingBalance: runningBalance });
  } catch (error) { next(error); }
};

// ─── Balance Sheet ──────────────────────────────────────
exports.getBalanceSheet = async (req, res, next) => {
  try {
    const { asOfDate } = req.query;
    const date = asOfDate ? new Date(asOfDate) : new Date();
    date.setHours(23, 59, 59, 999);

    const accounts = await Account.find({ isActive: true });

    const assets = accounts.filter(a => a.type === 'asset').map(a => ({
      code: a.code, name: a.name, balance: a.currentBalance,
    }));
    const liabilities = accounts.filter(a => a.type === 'liability').map(a => ({
      code: a.code, name: a.name, balance: a.currentBalance,
    }));
    const equity = accounts.filter(a => a.type === 'equity').map(a => ({
      code: a.code, name: a.name, balance: a.currentBalance,
    }));

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
    const totalEquity = equity.reduce((s, a) => s + a.balance, 0);

    // Calculate retained earnings from P&L
    const incomeAccounts = accounts.filter(a => a.type === 'income');
    const expenseAccounts = accounts.filter(a => a.type === 'expense');
    const totalIncome = incomeAccounts.reduce((s, a) => s + a.currentBalance, 0);
    const totalExpenses = expenseAccounts.reduce((s, a) => s + a.currentBalance, 0);
    const retainedEarnings = totalIncome - totalExpenses;

    res.json({
      asOfDate: date,
      assets, liabilities, equity,
      totalAssets,
      totalLiabilities,
      totalEquity: totalEquity + retainedEarnings,
      retainedEarnings,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + retainedEarnings)) < 0.01,
    });
  } catch (error) { next(error); }
};

// ─── Trial Balance ──────────────────────────────────────
exports.getTrialBalance = async (req, res, next) => {
  try {
    const accounts = await Account.find({ isActive: true }).sort({ code: 1 });

    const trialBalance = accounts.map(a => {
      let debit = 0, credit = 0;
      if (['asset', 'expense'].includes(a.type)) {
        if (a.currentBalance >= 0) debit = a.currentBalance;
        else credit = Math.abs(a.currentBalance);
      } else {
        if (a.currentBalance >= 0) credit = a.currentBalance;
        else debit = Math.abs(a.currentBalance);
      }
      return { code: a.code, name: a.name, type: a.type, debit, credit };
    }).filter(a => a.debit > 0 || a.credit > 0);

    const totalDebit = trialBalance.reduce((s, a) => s + a.debit, 0);
    const totalCredit = trialBalance.reduce((s, a) => s + a.credit, 0);

    res.json({ trialBalance, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 });
  } catch (error) { next(error); }
};

// ─── Profit & Loss (Enhanced) ───────────────────────────
exports.getProfitAndLoss = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);

    // From orders
    const orders = await Order.find({ createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' });
    const salesRevenue = orders.reduce((s, o) => s + o.subtotal, 0);
    const gstCollected = orders.reduce((s, o) => s + o.gstAmount, 0);
    const discounts = orders.reduce((s, o) => s + o.discount, 0);

    // From expenses
    const expenses = await Expense.find({ date: { $gte: start, $lte: end } });
    const expenseByCategory = {};
    let totalExpenses = 0;
    expenses.forEach(e => {
      expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
      totalExpenses += e.amount;
    });

    // From invoices
    const invoices = await Invoice.find({ date: { $gte: start, $lte: end }, isCancelled: false });
    const invoiceRevenue = invoices.filter(i => i.type === 'sale').reduce((s, i) => s + i.total, 0);
    const purchases = invoices.filter(i => i.type === 'purchase').reduce((s, i) => s + i.total, 0);

    const grossProfit = salesRevenue + invoiceRevenue - purchases;
    const netProfit = grossProfit - totalExpenses - discounts;

    res.json({
      period: { startDate: start, endDate: end },
      income: { salesRevenue, invoiceRevenue, gstCollected, totalIncome: salesRevenue + invoiceRevenue },
      expenses: { byCategory: expenseByCategory, totalExpenses, purchases, discounts },
      grossProfit,
      netProfit,
    });
  } catch (error) { next(error); }
};
