const mongoose = require('mongoose');
const { ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD } = require('../config/constants');

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    imageUrl: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    pricePerUnit: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    costPriceAtOrder: { type: Number, default: 0, min: 0 },
    // Compatibility fields consumed by existing analytics aggregations.
    unitPrice: { type: Number, min: 0, default: undefined },
    categoryName: { type: String, default: '' },
    gstRate: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    hsnCode: { type: String, default: '' },
    cgst: { type: Number, default: null },
    sgst: { type: Number, default: null },
    igst: { type: Number, default: null },
    priceIncludesTax: { type: Boolean, default: false },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const statusTimelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    retailerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: [orderItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    couponCode: {
      type: String,
      default: '',
    },
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    shipping: {
      type: Number,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    // Legacy wholesaler reporting reads totalAmount instead of grandTotal.
    totalAmount: {
      type: Number,
      min: 0,
      default: undefined,
    },
    orderStatus: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      default: PAYMENT_METHOD.BANK_TRANSFER,
    },
    isCreditOrder: {
      type: Boolean,
      default: false,
      index: true,
    },
    creditDueDate: {
      type: Date,
      index: true,
    },
    creditPeriodDays: {
      type: Number,
      default: 0,
    },
    creditSettledAt: {
      type: Date,
    },
    creditPaymentStatus: {
      type: String,
      enum: ['NOT_APPLICABLE', 'PENDING', 'PAID', 'OVERDUE'],
      default: 'NOT_APPLICABLE',
      index: true,
    },
    billingAddress: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      country: { type: String, default: 'India' },
    },
    shippingAddress: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      country: { type: String, default: 'India' },
    },
    statusTimeline: [statusTimelineSchema],
    cancellationReason: {
      type: String,
      default: '',
    },
    cancellationNote: {
      type: String,
      default: '',
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ retailerId: 1, createdAt: -1 });
orderSchema.index({ wholesalerId: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ wholesalerId: 1, createdAt: -1, orderStatus: 1 });
orderSchema.index({ wholesalerId: 1, orderStatus: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
