const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const CounterSession = require('../models/CounterSession');

// ─── HELPERS ────────────────────────────────────────────

function parseDateRange(query) {
  const { startDate, endDate, date } = query;
  if (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return { start: d, end: new Date(d.getTime() + 86400000) };
  }
  const start = new Date(startDate || Date.now() - 30 * 86400000);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate || Date.now());
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatCurrency(num) {
  return `₹${(num || 0).toFixed(2)}`;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function setupPdfDoc(res, filename) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  return doc;
}

function pdfTitle(doc, title, subtitle) {
  doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
  if (subtitle) doc.fontSize(10).font('Helvetica').text(subtitle, { align: 'center' });
  doc.moveDown(1);
}

function pdfTable(doc, headers, rows, colWidths) {
  const startX = doc.x;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  let y = doc.y;

  // Header background
  doc.rect(startX, y, tableWidth, 20).fill('#4f46e5');
  let x = startX;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
  headers.forEach((h, i) => {
    doc.text(h, x + 4, y + 5, { width: colWidths[i] - 8, align: i === 0 ? 'left' : 'right' });
    x += colWidths[i];
  });
  y += 22;
  doc.fillColor('#000000');

  // Rows
  doc.font('Helvetica').fontSize(8);
  rows.forEach((row, ri) => {
    if (y > 750) { doc.addPage(); y = doc.y; }
    if (ri % 2 === 0) doc.rect(startX, y, tableWidth, 18).fill('#f8fafc').fillColor('#000000');
    else doc.fillColor('#000000');
    x = startX;
    row.forEach((cell, i) => {
      doc.text(String(cell ?? ''), x + 4, y + 4, { width: colWidths[i] - 8, align: i === 0 ? 'left' : 'right' });
      x += colWidths[i];
    });
    y += 18;
  });
  doc.y = y + 10;
}

async function setupExcel(res, filename) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Restaurant POS';
  workbook.created = new Date();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return workbook;
}

function styleExcelHeader(sheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;
}

// ─── DAILY SUMMARY ──────────────────────────────────────

exports.dailySummaryPdf = async (req, res, next) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const orders = await Order.find({ createdAt: { $gte: start, $lt: end }, paymentStatus: 'paid' });
    const expenses = await Expense.find({ date: { $gte: start, $lt: end } });

    const totalSales = orders.reduce((s, o) => s + o.total, 0);
    const totalGST = orders.reduce((s, o) => s + o.gstAmount, 0);
    const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
    const payment = { cash: 0, card: 0, upi: 0 };
    orders.forEach(o => { if (payment[o.paymentMethod] !== undefined) payment[o.paymentMethod] += o.total; });

    const doc = setupPdfDoc(res, `daily-summary-${formatDate(start)}.pdf`);
    pdfTitle(doc, 'Daily Summary Report', formatDate(start));

    doc.fontSize(12).font('Helvetica-Bold');
    const stats = [
      ['Total Orders', orders.length],
      ['Total Sales', formatCurrency(totalSales)],
      ['GST Collected', formatCurrency(totalGST)],
      ['Expenses', formatCurrency(totalExp)],
      ['Profit', formatCurrency(totalSales - totalExp)],
    ];
    stats.forEach(([label, val]) => {
      doc.fontSize(11).font('Helvetica').text(`${label}: `, { continued: true }).font('Helvetica-Bold').text(String(val));
    });

    doc.moveDown(1);
    doc.fontSize(13).font('Helvetica-Bold').text('Payment Breakdown');
    doc.moveDown(0.3);
    pdfTable(doc, ['Method', 'Amount'], [
      ['Cash', formatCurrency(payment.cash)],
      ['Card', formatCurrency(payment.card)],
      ['UPI', formatCurrency(payment.upi)],
    ], [260, 260]);

    if (orders.length > 0) {
      doc.fontSize(13).font('Helvetica-Bold').text('Orders');
      doc.moveDown(0.3);
      pdfTable(doc,
        ['#', 'Order #', 'Table', 'Items', 'Payment', 'Total'],
        orders.map((o, i) => [i + 1, o.orderNumber, o.tableNumber || '-', o.items.length, (o.paymentMethod || '').toUpperCase(), formatCurrency(o.total)]),
        [30, 100, 60, 50, 80, 200]
      );
    }

    doc.end();
  } catch (error) { next(error); }
};

exports.dailySummaryExcel = async (req, res, next) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const orders = await Order.find({ createdAt: { $gte: start, $lt: end }, paymentStatus: 'paid' }).sort({ createdAt: 1 });
    const expenses = await Expense.find({ date: { $gte: start, $lt: end } });

    const workbook = await setupExcel(res, `daily-summary-${formatDate(start)}.xlsx`);

    // Summary sheet
    const summary = workbook.addWorksheet('Summary');
    summary.columns = [{ header: 'Metric', key: 'metric', width: 25 }, { header: 'Value', key: 'value', width: 20 }];
    styleExcelHeader(summary);
    const totalSales = orders.reduce((s, o) => s + o.total, 0);
    const totalGST = orders.reduce((s, o) => s + o.gstAmount, 0);
    const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
    summary.addRows([
      { metric: 'Date', value: formatDate(start) },
      { metric: 'Total Orders', value: orders.length },
      { metric: 'Total Sales', value: totalSales },
      { metric: 'GST Collected', value: totalGST },
      { metric: 'Total Expenses', value: totalExp },
      { metric: 'Net Profit', value: totalSales - totalExp },
    ]);

    // Orders sheet
    const ordersSheet = workbook.addWorksheet('Orders');
    ordersSheet.columns = [
      { header: '#', key: 'sno', width: 6 },
      { header: 'Order Number', key: 'orderNumber', width: 18 },
      { header: 'Bill Number', key: 'billNumber', width: 20 },
      { header: 'Table', key: 'table', width: 10 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Items', key: 'items', width: 8 },
      { header: 'Subtotal', key: 'subtotal', width: 14 },
      { header: 'GST', key: 'gst', width: 12 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Total', key: 'total', width: 14 },
      { header: 'Payment', key: 'payment', width: 10 },
      { header: 'Time', key: 'time', width: 12 },
    ];
    styleExcelHeader(ordersSheet);
    orders.forEach((o, i) => {
      ordersSheet.addRow({
        sno: i + 1,
        orderNumber: o.orderNumber,
        billNumber: o.billNumber || '',
        table: o.tableNumber || '-',
        type: o.type,
        items: o.items.length,
        subtotal: o.subtotal,
        gst: o.gstAmount,
        discount: o.discount || 0,
        total: o.total,
        payment: (o.paymentMethod || '').toUpperCase(),
        time: new Date(o.createdAt).toLocaleTimeString('en-IN'),
      });
    });
    // Total row
    const totalRow = ordersSheet.addRow({ sno: '', orderNumber: '', billNumber: '', table: '', type: '', items: '', subtotal: '', gst: '', discount: 'TOTAL', total: totalSales, payment: '', time: '' });
    totalRow.font = { bold: true };

    // Expenses sheet
    if (expenses.length > 0) {
      const expSheet = workbook.addWorksheet('Expenses');
      expSheet.columns = [
        { header: '#', key: 'sno', width: 6 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Category', key: 'category', width: 15 },
        { header: 'Amount', key: 'amount', width: 14 },
      ];
      styleExcelHeader(expSheet);
      expenses.forEach((e, i) => {
        expSheet.addRow({ sno: i + 1, description: e.description || e.notes || '', category: e.category || '', amount: e.amount });
      });
    }

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { next(error); }
};

// ─── SALES REPORT ───────────────────────────────────────

exports.salesReportPdf = async (req, res, next) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const pipeline = [
      { $match: { createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, totalSales: { $sum: '$total' }, totalGST: { $sum: '$gstAmount' }, orderCount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ];
    const report = await Order.aggregate(pipeline);

    const doc = setupPdfDoc(res, `sales-report-${formatDate(start)}-to-${formatDate(end)}.pdf`);
    pdfTitle(doc, 'Sales Report', `${formatDate(start)} to ${formatDate(end)}`);

    const grandTotal = report.reduce((s, r) => s + r.totalSales, 0);
    const grandGST = report.reduce((s, r) => s + r.totalGST, 0);
    const grandOrders = report.reduce((s, r) => s + r.orderCount, 0);

    doc.fontSize(11).font('Helvetica')
      .text(`Total Sales: ${formatCurrency(grandTotal)}    |    Total GST: ${formatCurrency(grandGST)}    |    Total Orders: ${grandOrders}`);
    doc.moveDown(1);

    pdfTable(doc,
      ['Date', 'Orders', 'Sales', 'GST'],
      report.map(r => [r._id, r.orderCount, formatCurrency(r.totalSales), formatCurrency(r.totalGST)]),
      [150, 80, 150, 140]
    );

    doc.end();
  } catch (error) { next(error); }
};

exports.salesReportExcel = async (req, res, next) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const pipeline = [
      { $match: { createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, totalSales: { $sum: '$total' }, totalGST: { $sum: '$gstAmount' }, orderCount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ];
    const report = await Order.aggregate(pipeline);

    const workbook = await setupExcel(res, `sales-report-${formatDate(start)}-to-${formatDate(end)}.xlsx`);
    const sheet = workbook.addWorksheet('Sales Report');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Orders', key: 'orders', width: 10 },
      { header: 'Total Sales', key: 'sales', width: 18 },
      { header: 'GST', key: 'gst', width: 15 },
    ];
    styleExcelHeader(sheet);
    report.forEach(r => sheet.addRow({ date: r._id, orders: r.orderCount, sales: r.totalSales, gst: r.totalGST }));
    const totRow = sheet.addRow({ date: 'TOTAL', orders: report.reduce((s, r) => s + r.orderCount, 0), sales: report.reduce((s, r) => s + r.totalSales, 0), gst: report.reduce((s, r) => s + r.totalGST, 0) });
    totRow.font = { bold: true };

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { next(error); }
};

// ─── ITEM-WISE SALES ────────────────────────────────────

exports.itemSalesPdf = async (req, res, next) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const pipeline = [
      { $match: { createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $ne: 'cancelled' } } },
      { $group: { _id: '$items.name', totalQuantity: { $sum: '$items.quantity' }, totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
      { $sort: { totalRevenue: -1 } },
    ];
    const report = await Order.aggregate(pipeline);

    const doc = setupPdfDoc(res, `item-sales-${formatDate(start)}-to-${formatDate(end)}.pdf`);
    pdfTitle(doc, 'Item-wise Sales Report', `${formatDate(start)} to ${formatDate(end)}`);

    pdfTable(doc,
      ['#', 'Item Name', 'Quantity Sold', 'Revenue'],
      report.map((r, i) => [i + 1, r._id, r.totalQuantity, formatCurrency(r.totalRevenue)]),
      [30, 230, 100, 160]
    );

    doc.end();
  } catch (error) { next(error); }
};

exports.itemSalesExcel = async (req, res, next) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const pipeline = [
      { $match: { createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $ne: 'cancelled' } } },
      { $group: { _id: '$items.name', totalQuantity: { $sum: '$items.quantity' }, totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
      { $sort: { totalRevenue: -1 } },
    ];
    const report = await Order.aggregate(pipeline);

    const workbook = await setupExcel(res, `item-sales-${formatDate(start)}-to-${formatDate(end)}.xlsx`);
    const sheet = workbook.addWorksheet('Item Sales');
    sheet.columns = [
      { header: '#', key: 'sno', width: 6 },
      { header: 'Item Name', key: 'name', width: 35 },
      { header: 'Quantity Sold', key: 'qty', width: 15 },
      { header: 'Revenue', key: 'revenue', width: 18 },
    ];
    styleExcelHeader(sheet);
    report.forEach((r, i) => sheet.addRow({ sno: i + 1, name: r._id, qty: r.totalQuantity, revenue: r.totalRevenue }));

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { next(error); }
};

// ─── TAX REPORT ─────────────────────────────────────────

exports.taxReportPdf = async (req, res, next) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const pipeline = [
      { $match: { createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $ne: 'cancelled' } } },
      { $group: { _id: '$items.gstRate', taxableAmount: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }, gstCollected: { $sum: { $multiply: [{ $multiply: ['$items.price', '$items.quantity'] }, { $divide: ['$items.gstRate', 100] }] } } } },
      { $sort: { _id: 1 } },
    ];
    const report = await Order.aggregate(pipeline);
    const totalTaxable = report.reduce((s, r) => s + r.taxableAmount, 0);
    const totalGST = report.reduce((s, r) => s + r.gstCollected, 0);

    const doc = setupPdfDoc(res, `tax-report-${formatDate(start)}-to-${formatDate(end)}.pdf`);
    pdfTitle(doc, 'Tax Report', `${formatDate(start)} to ${formatDate(end)}`);

    pdfTable(doc,
      ['GST Rate', 'Taxable Amount', 'CGST', 'SGST', 'Total GST'],
      [
        ...report.map(r => [`${r._id}%`, formatCurrency(r.taxableAmount), formatCurrency(r.gstCollected / 2), formatCurrency(r.gstCollected / 2), formatCurrency(r.gstCollected)]),
        ['TOTAL', formatCurrency(totalTaxable), formatCurrency(totalGST / 2), formatCurrency(totalGST / 2), formatCurrency(totalGST)],
      ],
      [80, 130, 100, 100, 110]
    );

    doc.end();
  } catch (error) { next(error); }
};

exports.taxReportExcel = async (req, res, next) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const pipeline = [
      { $match: { createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $ne: 'cancelled' } } },
      { $group: { _id: '$items.gstRate', taxableAmount: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }, gstCollected: { $sum: { $multiply: [{ $multiply: ['$items.price', '$items.quantity'] }, { $divide: ['$items.gstRate', 100] }] } } } },
      { $sort: { _id: 1 } },
    ];
    const report = await Order.aggregate(pipeline);

    const workbook = await setupExcel(res, `tax-report-${formatDate(start)}-to-${formatDate(end)}.xlsx`);
    const sheet = workbook.addWorksheet('Tax Report');
    sheet.columns = [
      { header: 'GST Rate (%)', key: 'rate', width: 14 },
      { header: 'Taxable Amount', key: 'taxable', width: 18 },
      { header: 'CGST', key: 'cgst', width: 14 },
      { header: 'SGST', key: 'sgst', width: 14 },
      { header: 'Total GST', key: 'totalGst', width: 14 },
    ];
    styleExcelHeader(sheet);
    report.forEach(r => sheet.addRow({ rate: r._id, taxable: r.taxableAmount, cgst: r.gstCollected / 2, sgst: r.gstCollected / 2, totalGst: r.gstCollected }));
    const total = sheet.addRow({ rate: 'TOTAL', taxable: report.reduce((s, r) => s + r.taxableAmount, 0), cgst: report.reduce((s, r) => s + r.gstCollected, 0) / 2, sgst: report.reduce((s, r) => s + r.gstCollected, 0) / 2, totalGst: report.reduce((s, r) => s + r.gstCollected, 0) });
    total.font = { bold: true };

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { next(error); }
};

// ─── INVOICES EXPORT ────────────────────────────────────

exports.invoicesPdf = async (req, res, next) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const { type } = req.query;
    const filter = { date: { $gte: start, $lte: end }, isDeleted: false };
    if (type) filter.type = type;
    const invoices = await Invoice.find(filter).sort({ date: -1 });

    const doc = setupPdfDoc(res, `invoices-${type || 'all'}-${formatDate(start)}-to-${formatDate(end)}.pdf`);
    pdfTitle(doc, 'Invoices Report', `${formatDate(start)} to ${formatDate(end)}${type ? ` | Type: ${type}` : ''}`);

    pdfTable(doc,
      ['#', 'Invoice #', 'Date', 'Party', 'Total', 'Paid', 'Due', 'Status'],
      invoices.map((inv, i) => [
        i + 1, inv.invoiceNumber, formatDate(inv.date),
        inv.partyName || '-', formatCurrency(inv.total),
        formatCurrency(inv.amountPaid), formatCurrency(inv.balanceDue),
        inv.isCancelled ? 'Cancelled' : inv.paymentStatus,
      ]),
      [25, 85, 65, 80, 70, 65, 65, 65]
    );

    doc.end();
  } catch (error) { next(error); }
};

exports.invoicesExcel = async (req, res, next) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const { type } = req.query;
    const filter = { date: { $gte: start, $lte: end }, isDeleted: false };
    if (type) filter.type = type;
    const invoices = await Invoice.find(filter).sort({ date: -1 });

    const workbook = await setupExcel(res, `invoices-${type || 'all'}-${formatDate(start)}-to-${formatDate(end)}.xlsx`);
    const sheet = workbook.addWorksheet('Invoices');
    sheet.columns = [
      { header: '#', key: 'sno', width: 6 },
      { header: 'Invoice Number', key: 'invoiceNumber', width: 20 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Party', key: 'party', width: 25 },
      { header: 'GSTIN', key: 'gstin', width: 18 },
      { header: 'Subtotal', key: 'subtotal', width: 14 },
      { header: 'GST', key: 'gst', width: 12 },
      { header: 'Total', key: 'total', width: 14 },
      { header: 'Paid', key: 'paid', width: 14 },
      { header: 'Due', key: 'due', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    styleExcelHeader(sheet);
    invoices.forEach((inv, i) => {
      sheet.addRow({
        sno: i + 1, invoiceNumber: inv.invoiceNumber, date: formatDate(inv.date),
        party: inv.partyName || '', gstin: inv.partyGstin || '',
        subtotal: inv.subtotal, gst: inv.totalGst, total: inv.total,
        paid: inv.amountPaid, due: inv.balanceDue,
        status: inv.isCancelled ? 'Cancelled' : inv.paymentStatus,
      });
    });

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { next(error); }
};

// ─── GST REPORTS EXPORT ─────────────────────────────────

exports.gstReportPdf = async (req, res, next) => {
  try {
    const { month, year, type } = req.query;
    const m = parseInt(month, 10) - 1;
    const y = parseInt(year, 10);
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    const monthName = start.toLocaleString('en', { month: 'long' });

    const doc = setupPdfDoc(res, `GST-${type || 'report'}-${monthName}-${year}.pdf`);

    if (type === 'gstr1') {
      // B2C orders
      const b2cOrders = await Order.find({ createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' });
      const b2bInvoices = await Invoice.find({ date: { $gte: start, $lte: end }, type: 'sale', isCancelled: false, isDeleted: false, partyGstin: { $exists: true, $ne: '' } });
      const b2cInvoices = await Invoice.find({ date: { $gte: start, $lte: end }, type: 'sale', isCancelled: false, isDeleted: false, $or: [{ partyGstin: { $exists: false } }, { partyGstin: '' }] });

      pdfTitle(doc, 'GSTR-1 Report', `${monthName} ${year}`);
      doc.fontSize(11).font('Helvetica');
      doc.text(`B2B Invoices: ${b2bInvoices.length} | B2C: ${b2cOrders.length + b2cInvoices.length}`);
      doc.text(`Total B2B: ${formatCurrency(b2bInvoices.reduce((s, i) => s + i.total, 0))}`);
      doc.text(`Total B2C: ${formatCurrency(b2cOrders.reduce((s, o) => s + o.total, 0) + b2cInvoices.reduce((s, i) => s + i.total, 0))}`);
      doc.moveDown(1);

      if (b2bInvoices.length > 0) {
        doc.fontSize(13).font('Helvetica-Bold').text('B2B Invoices');
        doc.moveDown(0.3);
        pdfTable(doc,
          ['Invoice #', 'Party', 'GSTIN', 'Taxable', 'GST', 'Total'],
          b2bInvoices.map(i => [i.invoiceNumber, i.partyName || '-', i.partyGstin || '-', formatCurrency(i.subtotal), formatCurrency(i.totalGst), formatCurrency(i.total)]),
          [80, 100, 90, 80, 80, 90]
        );
      }
    } else {
      // GSTR-3B
      const salesOrders = await Order.find({ createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' });
      const salesInvoices = await Invoice.find({ date: { $gte: start, $lte: end }, type: 'sale', isCancelled: false, isDeleted: false });
      const purchaseInvoices = await Invoice.find({ date: { $gte: start, $lte: end }, type: 'purchase', isCancelled: false, isDeleted: false });

      const outTaxable = salesOrders.reduce((s, o) => s + o.subtotal, 0) + salesInvoices.reduce((s, i) => s + i.subtotal, 0);
      const outGST = salesOrders.reduce((s, o) => s + o.gstAmount, 0) + salesInvoices.reduce((s, i) => s + i.totalGst, 0);
      const inTaxable = purchaseInvoices.reduce((s, i) => s + i.subtotal, 0);
      const inGST = purchaseInvoices.reduce((s, i) => s + i.totalGst, 0);

      pdfTitle(doc, 'GSTR-3B Summary', `${monthName} ${year}`);

      pdfTable(doc,
        ['', 'Taxable Value', 'CGST', 'SGST', 'Total GST'],
        [
          ['Outward Supplies', formatCurrency(outTaxable), formatCurrency(outGST / 2), formatCurrency(outGST / 2), formatCurrency(outGST)],
          ['Inward Supplies', formatCurrency(inTaxable), formatCurrency(inGST / 2), formatCurrency(inGST / 2), formatCurrency(inGST)],
          ['ITC Available', '', '', '', formatCurrency(inGST)],
          ['Net GST Payable', '', '', '', formatCurrency(Math.max(0, outGST - inGST))],
        ],
        [120, 110, 90, 90, 110]
      );
    }

    doc.end();
  } catch (error) { next(error); }
};

exports.gstReportExcel = async (req, res, next) => {
  try {
    const { month, year, type } = req.query;
    const m = parseInt(month, 10) - 1;
    const y = parseInt(year, 10);
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    const monthName = start.toLocaleString('en', { month: 'long' });

    const workbook = await setupExcel(res, `GST-${type || 'report'}-${monthName}-${year}.xlsx`);

    if (type === 'gstr1') {
      const b2bInvoices = await Invoice.find({ date: { $gte: start, $lte: end }, type: 'sale', isCancelled: false, isDeleted: false, partyGstin: { $exists: true, $ne: '' } });
      const b2cOrders = await Order.find({ createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' });

      const b2bSheet = workbook.addWorksheet('B2B Invoices');
      b2bSheet.columns = [
        { header: 'Invoice #', key: 'inv', width: 18 },
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Party', key: 'party', width: 25 },
        { header: 'GSTIN', key: 'gstin', width: 18 },
        { header: 'Taxable', key: 'taxable', width: 14 },
        { header: 'CGST', key: 'cgst', width: 12 },
        { header: 'SGST', key: 'sgst', width: 12 },
        { header: 'Total', key: 'total', width: 14 },
      ];
      styleExcelHeader(b2bSheet);
      b2bInvoices.forEach(i => b2bSheet.addRow({ inv: i.invoiceNumber, date: formatDate(i.date), party: i.partyName || '', gstin: i.partyGstin || '', taxable: i.subtotal, cgst: i.totalGst / 2, sgst: i.totalGst / 2, total: i.total }));

      const b2cSheet = workbook.addWorksheet('B2C Sales');
      b2cSheet.columns = [
        { header: 'Order #', key: 'order', width: 18 },
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Taxable', key: 'taxable', width: 14 },
        { header: 'GST', key: 'gst', width: 12 },
        { header: 'Total', key: 'total', width: 14 },
      ];
      styleExcelHeader(b2cSheet);
      b2cOrders.forEach(o => b2cSheet.addRow({ order: o.orderNumber, date: formatDate(o.createdAt), taxable: o.subtotal, gst: o.gstAmount, total: o.total }));
    } else {
      const salesOrders = await Order.find({ createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' });
      const salesInvoices = await Invoice.find({ date: { $gte: start, $lte: end }, type: 'sale', isCancelled: false, isDeleted: false });
      const purchaseInvoices = await Invoice.find({ date: { $gte: start, $lte: end }, type: 'purchase', isCancelled: false, isDeleted: false });

      const outGST = salesOrders.reduce((s, o) => s + o.gstAmount, 0) + salesInvoices.reduce((s, i) => s + i.totalGst, 0);
      const inGST = purchaseInvoices.reduce((s, i) => s + i.totalGst, 0);

      const sheet = workbook.addWorksheet('GSTR-3B');
      sheet.columns = [
        { header: 'Description', key: 'desc', width: 25 },
        { header: 'Taxable Value', key: 'taxable', width: 18 },
        { header: 'CGST', key: 'cgst', width: 14 },
        { header: 'SGST', key: 'sgst', width: 14 },
        { header: 'Total GST', key: 'gst', width: 14 },
      ];
      styleExcelHeader(sheet);
      const outTaxable = salesOrders.reduce((s, o) => s + o.subtotal, 0) + salesInvoices.reduce((s, i) => s + i.subtotal, 0);
      const inTaxable = purchaseInvoices.reduce((s, i) => s + i.subtotal, 0);
      sheet.addRows([
        { desc: 'Outward Supplies', taxable: outTaxable, cgst: outGST / 2, sgst: outGST / 2, gst: outGST },
        { desc: 'Inward Supplies', taxable: inTaxable, cgst: inGST / 2, sgst: inGST / 2, gst: inGST },
        { desc: 'ITC Available', taxable: '', cgst: '', sgst: '', gst: inGST },
        { desc: 'Net GST Payable', taxable: '', cgst: '', sgst: '', gst: Math.max(0, outGST - inGST) },
      ]);
    }

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { next(error); }
};

// ─── BILLS (COMPLETED ORDERS) EXPORT ────────────────────

exports.billsPdf = async (req, res, next) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const orders = await Order.find({ completedAt: { $gte: start, $lt: end }, paymentStatus: 'paid' }).sort({ completedAt: -1 });

    const doc = setupPdfDoc(res, `bills-${formatDate(start)}.pdf`);
    pdfTitle(doc, "Today's Bills", formatDate(start));

    const total = orders.reduce((s, o) => s + o.total, 0);
    doc.fontSize(11).font('Helvetica').text(`Total Bills: ${orders.length}  |  Total Amount: ${formatCurrency(total)}`);
    doc.moveDown(1);

    pdfTable(doc,
      ['#', 'Bill #', 'Order #', 'Table', 'Items', 'Total', 'Payment', 'Time'],
      orders.map((o, i) => [
        i + 1, o.billNumber || '-', o.orderNumber, o.tableNumber || '-',
        o.items.length, formatCurrency(o.total), (o.paymentMethod || '').toUpperCase(),
        new Date(o.completedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      ]),
      [25, 85, 80, 45, 40, 75, 60, 60]
    );

    doc.end();
  } catch (error) { next(error); }
};

exports.billsExcel = async (req, res, next) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const orders = await Order.find({ completedAt: { $gte: start, $lt: end }, paymentStatus: 'paid' }).sort({ completedAt: -1 });

    const workbook = await setupExcel(res, `bills-${formatDate(start)}.xlsx`);
    const sheet = workbook.addWorksheet('Bills');
    sheet.columns = [
      { header: '#', key: 'sno', width: 6 },
      { header: 'Bill Number', key: 'bill', width: 22 },
      { header: 'Order Number', key: 'order', width: 18 },
      { header: 'Table', key: 'table', width: 10 },
      { header: 'Items', key: 'items', width: 8 },
      { header: 'Subtotal', key: 'subtotal', width: 14 },
      { header: 'GST', key: 'gst', width: 12 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Total', key: 'total', width: 14 },
      { header: 'Payment', key: 'payment', width: 10 },
      { header: 'Time', key: 'time', width: 12 },
    ];
    styleExcelHeader(sheet);
    orders.forEach((o, i) => {
      sheet.addRow({
        sno: i + 1, bill: o.billNumber || '', order: o.orderNumber,
        table: o.tableNumber || '-', items: o.items.length,
        subtotal: o.subtotal, gst: o.gstAmount, discount: o.discount || 0,
        total: o.total, payment: (o.paymentMethod || '').toUpperCase(),
        time: new Date(o.completedAt).toLocaleTimeString('en-IN'),
      });
    });
    const totRow = sheet.addRow({ sno: '', bill: '', order: '', table: '', items: '', subtotal: '', gst: '', discount: 'TOTAL', total: orders.reduce((s, o) => s + o.total, 0), payment: '', time: '' });
    totRow.font = { bold: true };

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { next(error); }
};

// ─── COUNTER SESSION HISTORY EXPORT ─────────────────────

exports.counterHistoryPdf = async (req, res, next) => {
  try {
    const sessions = await CounterSession.find({ status: { $in: ['closed', 'verified'] } })
      .populate('openedBy', 'name').populate('closedBy', 'name')
      .sort({ createdAt: -1 }).limit(100);

    const doc = setupPdfDoc(res, 'counter-history.pdf');
    pdfTitle(doc, 'Counter Session History');

    pdfTable(doc,
      ['Date', 'Shift', 'Sales', 'Cash', 'Card', 'UPI', 'Orders', 'Variance'],
      sessions.map(s => [
        s.sessionDate, `#${s.shiftNumber}`, formatCurrency(s.systemTotal),
        formatCurrency(s.systemCash), formatCurrency(s.systemCard), formatCurrency(s.systemUPI),
        s.totalOrders, formatCurrency(s.cashVariance),
      ]),
      [70, 40, 75, 70, 65, 65, 50, 75]
    );

    doc.end();
  } catch (error) { next(error); }
};

exports.counterHistoryExcel = async (req, res, next) => {
  try {
    const sessions = await CounterSession.find({ status: { $in: ['closed', 'verified'] } })
      .populate('openedBy', 'name').populate('closedBy', 'name')
      .sort({ createdAt: -1 }).limit(100);

    const workbook = await setupExcel(res, 'counter-history.xlsx');
    const sheet = workbook.addWorksheet('Counter Sessions');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Shift', key: 'shift', width: 8 },
      { header: 'Opened By', key: 'openedBy', width: 15 },
      { header: 'Opening Cash', key: 'openingCash', width: 14 },
      { header: 'Total Sales', key: 'sales', width: 14 },
      { header: 'Cash Sales', key: 'cash', width: 14 },
      { header: 'Card Sales', key: 'card', width: 14 },
      { header: 'UPI Sales', key: 'upi', width: 14 },
      { header: 'Orders', key: 'orders', width: 10 },
      { header: 'Expenses', key: 'expenses', width: 14 },
      { header: 'GST', key: 'gst', width: 12 },
      { header: 'Declared Cash', key: 'declared', width: 14 },
      { header: 'Variance', key: 'variance', width: 12 },
      { header: 'Closed By', key: 'closedBy', width: 15 },
    ];
    styleExcelHeader(sheet);
    sessions.forEach(s => {
      sheet.addRow({
        date: s.sessionDate, shift: s.shiftNumber,
        openedBy: s.openedBy?.name || '', openingCash: s.openingCash,
        sales: s.systemTotal, cash: s.systemCash, card: s.systemCard,
        upi: s.systemUPI, orders: s.totalOrders, expenses: s.totalExpenses,
        gst: s.gstCollected, declared: s.declaredCash,
        variance: s.cashVariance, closedBy: s.closedBy?.name || '',
      });
    });

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { next(error); }
};
