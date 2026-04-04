const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  name: { type: String, required: true },
  description: { type: String },
  hsn: { type: String, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, default: 'pcs' },
  rate: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  gstRate: { type: Number, default: 5 },
  amount: { type: Number, required: true },
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  type: { type: String, enum: ['sale', 'purchase', 'credit_note', 'debit_note'], default: 'sale' },
  date: { type: Date, default: Date.now },
  dueDate: { type: Date },
  party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party' },
  partyName: { type: String },
  partyGstin: { type: String },
  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }], // combined orders
  items: [invoiceItemSchema],
  subtotal: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  totalGst: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
  // E-Invoice
  eInvoiceStatus: { type: String, enum: ['not_generated', 'generated', 'cancelled'], default: 'not_generated' },
  irn: { type: String }, // Invoice Reference Number
  ackNumber: { type: String },
  ackDate: { type: Date },
  // E-Way Bill
  eWayBillStatus: { type: String, enum: ['not_generated', 'generated', 'cancelled'], default: 'not_generated' },
  eWayBillNumber: { type: String },
  eWayBillDate: { type: Date },
  transporterName: { type: String },
  transporterId: { type: String },
  vehicleNumber: { type: String },
  // Challan
  isFromChallan: { type: Boolean, default: false },
  challanNumbers: [String],
  // Cancel
  isCancelled: { type: Boolean, default: false },
  cancelReason: { type: String },
  cancelledAt: { type: Date },
  // WhatsApp
  whatsappSent: { type: Boolean, default: false },
  whatsappSentAt: { type: Date },
  notes: { type: String, trim: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true });

invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ party: 1, date: -1 });
invoiceSchema.index({ type: 1, date: -1 });
invoiceSchema.index({ isDeleted: 1 });

invoiceSchema.methods.calculateTotals = function () {
  this.subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);
  this.totalGst = this.items.reduce((sum, item) => sum + (item.amount * item.gstRate / 100), 0);
  this.cgst = this.totalGst / 2;
  this.sgst = this.totalGst / 2;
  this.total = this.subtotal + this.totalGst - this.discountAmount;
  this.balanceDue = this.total - this.amountPaid;
  this.paymentStatus = this.balanceDue <= 0 ? 'paid' : this.amountPaid > 0 ? 'partial' : 'unpaid';
  return this;
};

module.exports = mongoose.model('Invoice', invoiceSchema);
