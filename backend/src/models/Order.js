const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  status: {
    type: String,
    enum: ['placed', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'],
    default: 'placed',
  },
  notes: { type: String, trim: true },
  gstRate: { type: Number, default: 5 },
}, { _id: true });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  billNumber: { type: String, unique: true, sparse: true },
  table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
  tableNumber: { type: Number },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  type: {
    type: String,
    enum: ['dine_in', 'takeaway', 'delivery', 'external'],
    default: 'dine_in',
  },
  items: [orderItemSchema],
  status: {
    type: String,
    enum: ['placed', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'],
    default: 'placed',
  },
  subtotal: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'split', 'company', 'pending'],
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending',
  },
  externalPlatform: { type: String, enum: ['swiggy', 'zomato', null], default: null },
  externalOrderId: { type: String },
  customerName: { type: String, trim: true },
  customerPhone: { type: String, trim: true },
  // Company credit billing
  companyName: { type: String, trim: true },
  companyCredit: {
    isCompanyBill: { type: Boolean, default: false },
    dueAmount: { type: Number, default: 0 },
    settledAmount: { type: Number, default: 0 },
    settlementDate: { type: Date },
    settlementRef: { type: String, trim: true },
  },
  waiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true },
  completedAt: { type: Date },
}, { timestamps: true });

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ table: 1, status: 1 });

orderSchema.methods.calculateTotals = function () {
  this.subtotal = this.items
    .filter(item => item.status !== 'cancelled')
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  this.gstAmount = this.items
    .filter(item => item.status !== 'cancelled')
    .reduce((sum, item) => sum + (item.price * item.quantity * item.gstRate) / 100, 0);

  this.total = this.subtotal + this.gstAmount - this.discount;
  return this;
};

module.exports = mongoose.model('Order', orderSchema);
