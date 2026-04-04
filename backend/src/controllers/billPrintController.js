const net = require('net');
const Order = require('../models/Order');
const Device = require('../models/Device');
const AuditLog = require('../models/AuditLog');

// ESC/POS command constants
const ESC = '\x1B';
const GS = '\x1D';
const COMMANDS = {
  INIT: ESC + '@',
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_LEFT: ESC + 'a' + '\x00',
  ALIGN_RIGHT: ESC + 'a' + '\x02',
  FONT_DOUBLE: GS + '!' + '\x11',
  FONT_NORMAL: GS + '!' + '\x00',
  CUT: GS + 'V' + '\x00',
  FEED: ESC + 'd' + '\x03',
  LINE: '--------------------------------\n',
  DLINE: '================================\n',
};

// Pad text for thermal printer columns (32-char width)
const padLine = (left, right, width = 32) => {
  const available = width - right.length;
  return left.substring(0, available).padEnd(available) + right + '\n';
};

// Build thermal bill data (ESC/POS)
const buildThermalBill = (order, companyName = 'Restaurant POS') => {
  let data = '';
  data += COMMANDS.INIT;
  data += COMMANDS.ALIGN_CENTER;
  data += COMMANDS.FONT_DOUBLE;
  data += companyName + '\n';
  data += COMMANDS.FONT_NORMAL;
  data += COMMANDS.LINE;

  data += `Bill: ${order.billNumber || order.orderNumber}\n`;
  data += `Date: ${new Date(order.createdAt).toLocaleString('en-IN')}\n`;
  if (order.tableNumber) data += `Table: ${order.tableNumber}\n`;
  if (order.customerName) data += `Customer: ${order.customerName}\n`;
  data += COMMANDS.DLINE;

  data += COMMANDS.ALIGN_LEFT;
  data += COMMANDS.BOLD_ON;
  data += padLine('Item', 'Qty   Amount');
  data += COMMANDS.BOLD_OFF;
  data += COMMANDS.LINE;

  for (const item of order.items) {
    if (item.status === 'cancelled') continue;
    const amount = (item.price * item.quantity).toFixed(2);
    data += padLine(item.name, `${item.quantity}   ${amount}`);
  }

  data += COMMANDS.DLINE;
  data += padLine('Subtotal', `${order.subtotal?.toFixed(2)}`);
  data += padLine('GST', `${order.gstAmount?.toFixed(2)}`);
  if (order.discount > 0) {
    data += padLine('Discount', `-${order.discount?.toFixed(2)}`);
  }
  data += COMMANDS.BOLD_ON;
  data += COMMANDS.FONT_DOUBLE;
  data += padLine('TOTAL', `Rs.${order.total?.toFixed(2)}`);
  data += COMMANDS.FONT_NORMAL;
  data += COMMANDS.BOLD_OFF;

  data += COMMANDS.LINE;
  data += padLine('Payment', (order.paymentMethod || 'N/A').toUpperCase());
  data += COMMANDS.LINE;

  data += COMMANDS.ALIGN_CENTER;
  data += 'Thank you! Visit Again!\n';
  data += COMMANDS.FEED;
  data += COMMANDS.CUT;

  return data;
};

// Build HTML bill for normal printer
const buildHTMLBill = (order, companyName = 'Restaurant POS') => {
  const itemRows = order.items
    .filter(i => i.status !== 'cancelled')
    .map(i => `<tr><td>${i.name}</td><td class="right">${i.quantity}</td><td class="right">₹${(i.price * i.quantity).toFixed(2)}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html><head><title>Bill</title>
<style>
  @page { size: 80mm auto; margin: 2mm; }
  body { font-family: 'Courier New', monospace; padding: 10px; max-width: 350px; margin: 0 auto; font-size: 13px; }
  h2 { text-align: center; margin: 0 0 4px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .line { border-top: 1px dashed #000; margin: 8px 0; }
  .dline { border-top: 2px solid #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 3px 0; vertical-align: top; }
  th { text-align: left; border-bottom: 1px solid #000; }
  .total-row td { font-weight: bold; font-size: 16px; padding-top: 6px; }
  .info-table td:first-child { width: 60%; }
  .gst-box { border: 1px solid #000; padding: 6px; margin-top: 8px; font-size: 11px; }
</style></head><body>
  <h2>${companyName}</h2>
  <p class="center" style="margin:2px 0">
    Bill: ${order.billNumber || order.orderNumber}<br/>
    Date: ${new Date(order.createdAt).toLocaleString('en-IN')}<br/>
    ${order.tableNumber ? `Table: ${order.tableNumber}<br/>` : ''}
    ${order.customerName ? `Customer: ${order.customerName}<br/>` : ''}
    ${order.waiter?.name ? `Server: ${order.waiter.name}<br/>` : ''}
  </p>
  <div class="dline"></div>
  <table>
    <tr><th>Item</th><th class="right">Qty</th><th class="right">Amount</th></tr>
    ${itemRows}
  </table>
  <div class="dline"></div>
  <table class="info-table">
    <tr><td>Subtotal</td><td class="right">₹${order.subtotal?.toFixed(2)}</td></tr>
    <tr><td>GST</td><td class="right">₹${order.gstAmount?.toFixed(2)}</td></tr>
    ${order.discount > 0 ? `<tr><td>Discount</td><td class="right">-₹${order.discount?.toFixed(2)}</td></tr>` : ''}
    <tr class="total-row"><td>TOTAL</td><td class="right">₹${order.total?.toFixed(2)}</td></tr>
    <tr><td>Payment</td><td class="right">${(order.paymentMethod || 'N/A').toUpperCase()}</td></tr>
  </table>
  <div class="line"></div>
  <div class="gst-box">
    <strong>GST Summary</strong><br/>
    CGST: ₹${(order.gstAmount / 2)?.toFixed(2)} | SGST: ₹${(order.gstAmount / 2)?.toFixed(2)}
  </div>
  <div class="line"></div>
  <p class="center" style="margin:4px 0">Thank you! Visit Again!</p>
  <script>window.onload=function(){window.print();}</script>
</body></html>`;
};

// Send data to LAN thermal printer
const sendToPrinter = (ip, port, data) => {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error(`Printer timeout: ${ip}:${port}`));
    }, 5000);

    client.connect(port, ip, () => {
      client.write(data, () => {
        clearTimeout(timeout);
        client.end();
        resolve();
      });
    });
    client.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
};

// Print bill to thermal printer
exports.printBill = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('waiter', 'name');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const { printerIp, printerPort, companyName } = req.body;
    if (!printerIp) return res.status(400).json({ message: 'Printer IP required' });

    const escposData = buildThermalBill(order, companyName);
    await sendToPrinter(printerIp, printerPort || 9100, escposData);

    await AuditLog.create({
      action: 'print',
      module: 'bill',
      documentId: order._id,
      documentNumber: order.billNumber || order.orderNumber,
      description: `Bill printed to ${printerIp}`,
      user: req.user._id,
      userName: req.user.name,
    });

    res.json({ message: 'Bill printed successfully' });
  } catch (error) {
    next(error);
  }
};

// Get HTML bill for browser/normal printing
exports.getHTMLBill = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('waiter', 'name');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const companyName = req.query.company || 'Restaurant POS';
    const html = buildHTMLBill(order, companyName);
    res.json({ html, order });
  } catch (error) {
    next(error);
  }
};

// Auto-print to the device's configured printer
exports.autoPrint = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('waiter', 'name');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const deviceId = req.headers['x-device-id'];
    if (!deviceId) {
      return res.status(400).json({ message: 'Device ID required for auto-print' });
    }

    const device = await Device.findOne({ deviceId });
    if (!device || !device.printerConfig?.enabled || !device.printerConfig?.ip) {
      return res.status(400).json({ message: 'No printer configured on this device' });
    }

    const escposData = buildThermalBill(order, req.body.companyName);
    await sendToPrinter(device.printerConfig.ip, device.printerConfig.port || 9100, escposData);

    res.json({ message: 'Bill printed successfully' });
  } catch (error) {
    next(error);
  }
};
