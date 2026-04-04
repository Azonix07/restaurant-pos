const Expense = require('../models/Expense');

exports.getAll = async (req, res, next) => {
  try {
    const { category, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const expenses = await Expense.find(filter)
      .populate('createdBy', 'name')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Expense.countDocuments(filter);
    res.json({ expenses, total, page: parseInt(page, 10), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const expense = await Expense.create({
      ...req.body,
      createdBy: req.user._id,
    });
    res.status(201).json({ expense });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.json({ expense });
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    next(error);
  }
};

exports.getSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const pipeline = [
      { $match: { date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ];

    const summary = await Expense.aggregate(pipeline);
    const grandTotal = summary.reduce((s, r) => s + r.total, 0);
    res.json({ summary, grandTotal });
  } catch (error) {
    next(error);
  }
};
