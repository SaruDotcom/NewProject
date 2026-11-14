const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: { type: String, required: true, trim: true, maxlength: 160 },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: {
      type: String,
      required: true,
      enum: ['KG', 'BOX', 'CARTON', 'PIECES', 'METER'],
    },
    purchaseRate: { type: Number, required: true, min: 0 },
    taxableAmount: { type: Number, required: true, min: 0 },
    gstPercent: { type: Number, min: 0, max: 100, default: 0 },
    gstAmount: { type: Number, required: true, min: 0, default: 0 },
    itemTotal: { type: Number, required: true, min: 0 },
    stockAppliedQuantity: { type: Number, min: 0, default: 0 },
    returnedQuantity: { type: Number, min: 0, default: 0 },
    stockReturnedQuantity: { type: Number, min: 0, default: 0 },
  },
  { _id: true }
);

const billAuditSchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['CREATED', 'UPDATED', 'CANCELLED'], required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, required: true, default: Date.now },
    reason: { type: String, trim: true, default: '', maxlength: 500 },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const purchaseBillSchema = new mongoose.Schema(
  {
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    idempotencyKey: { type: String, required: true, trim: true },
    billType: { type: String, enum: ['FULL', 'QUICK'], default: 'FULL', index: true },
    invoiceNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
    billDate: { type: Date, required: true, index: true },
    items: { type: [purchaseItemSchema], required: true, validate: [(items) => items.length > 0, 'At least one purchase item is required'] },
    subtotal: { type: Number, required: true, min: 0 },
    gstTotal: { type: Number, required: true, min: 0 },
    transportCharges: { type: Number, min: 0, default: 0 },
    loadingCharges: { type: Number, min: 0, default: 0 },
    discountType: { type: String, enum: ['AMOUNT', 'PERCENT'], default: 'AMOUNT' },
    discountValue: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, min: 0, default: 0 },
    outstandingAmount: { type: Number, min: 0, default: 0 },
    returnAmount: { type: Number, min: 0, default: 0 },
    refundedAmount: { type: Number, min: 0, default: 0 },
    paymentStatus: { type: String, enum: ['PAID', 'PARTIAL', 'UDHAAR'], default: 'UDHAAR', index: true },
    paymentMode: { type: String, enum: ['CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER', ''], default: '' },
    dueDate: { type: Date, default: null, index: true },
    notes: { type: String, trim: true, default: '', maxlength: 1000 },
    stockUpdateEnabled: { type: Boolean, default: true },
    status: { type: String, enum: ['ACTIVE', 'CANCELLED'], default: 'ACTIVE', index: true },
    revision: { type: Number, min: 0, default: 0 },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancellationReason: { type: String, trim: true, default: '', maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    auditHistory: { type: [billAuditSchema], default: [] },
  },
  { timestamps: true }
);

purchaseBillSchema.index(
  { wholesalerId: 1, supplierId: 1, invoiceNumber: 1 },
  { unique: true }
);
purchaseBillSchema.index({ wholesalerId: 1, idempotencyKey: 1 }, { unique: true });
purchaseBillSchema.index({ wholesalerId: 1, status: 1, billDate: -1 });
purchaseBillSchema.index({ wholesalerId: 1, supplierId: 1, dueDate: 1, outstandingAmount: 1 });

module.exports = mongoose.model('PurchaseBill', purchaseBillSchema);
