const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  rawMaterial: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0.01 },
  unit: { type: String, required: true },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  expiryDate: { type: Date },
}, { _id: true });

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplierName: { type: String },
  items: [purchaseItemSchema],
  subtotal: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'ordered', 'partial_received', 'received', 'cancelled'],
    default: 'draft',
  },
  // GRN (Goods Received Note) tracking
  receivedItems: [{
    item: { type: mongoose.Schema.Types.ObjectId },
    receivedQty: { type: Number },
    acceptedQty: { type: Number },
    rejectedQty: { type: Number, default: 0 },
    rejectionReason: { type: String },
    receivedAt: { type: Date, default: Date.now },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending',
  },
  paidAmount: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['cash', 'bank', 'upi', 'cheque'] },
  invoiceNumber: { type: String, trim: true }, // supplier's invoice number
  invoiceDate: { type: Date },
  notes: { type: String, trim: true },
  orderedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expectedDelivery: { type: Date },
  deliveredAt: { type: Date },
}, { timestamps: true });

purchaseOrderSchema.index({ status: 1, createdAt: -1 });
purchaseOrderSchema.index({ supplier: 1 });

purchaseOrderSchema.methods.calculateTotals = function () {
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.total = this.subtotal + this.gstAmount;
  return this;
};

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
