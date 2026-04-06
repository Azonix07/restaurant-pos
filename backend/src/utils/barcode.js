/**
 * Barcode generation utility
 * Generates EAN-13 compatible barcodes for menu items and raw materials
 */

// Generate a 12-digit barcode with EAN-13 check digit
function generateEAN13(prefix = '200') {
  // prefix 200-299 is reserved for in-store use in EAN-13
  const random = String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  const digits = (prefix + random).slice(0, 12);
  const checkDigit = calculateEAN13CheckDigit(digits);
  return digits + checkDigit;
}

function calculateEAN13CheckDigit(digits12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i], 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

// Generate ESC/POS barcode print commands (CODE128 for thermal printers)
function generateESCPOSBarcodeCommands(barcodeValue, labelText) {
  const ESC = 0x1B;
  const GS = 0x1D;
  const commands = [];

  // Set barcode height: GS h n (n=80 dots)
  commands.push(Buffer.from([GS, 0x68, 80]));
  // Set barcode width: GS w n (n=2 moderate width)
  commands.push(Buffer.from([GS, 0x77, 2]));
  // Print HRI below barcode: GS H n (n=2 below)
  commands.push(Buffer.from([GS, 0x48, 2]));
  // Select font for HRI: GS f n (n=0 Font A)
  commands.push(Buffer.from([GS, 0x66, 0]));

  // Print label above barcode
  if (labelText) {
    // Center alignment
    commands.push(Buffer.from([ESC, 0x61, 1]));
    commands.push(Buffer.from(labelText + '\n', 'utf8'));
  }

  // Center alignment for barcode
  commands.push(Buffer.from([ESC, 0x61, 1]));

  // Print CODE128 barcode: GS k m d1...dk NUL
  // m=73 is CODE128
  const barcodeBytes = Buffer.from(barcodeValue, 'ascii');
  const header = Buffer.from([GS, 0x6B, 73, barcodeBytes.length]);
  commands.push(header);
  commands.push(barcodeBytes);

  // Feed and cut
  commands.push(Buffer.from('\n\n\n', 'utf8'));

  // Left alignment
  commands.push(Buffer.from([ESC, 0x61, 0]));

  return Buffer.concat(commands);
}

module.exports = { generateEAN13, calculateEAN13CheckDigit, generateESCPOSBarcodeCommands };
