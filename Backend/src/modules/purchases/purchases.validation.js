const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);
const money = Joi.number().min(0).max(999999999999).precision(2);
const quantity = Joi.number().min(0.001).max(999999999).precision(3);
const date = Joi.date().iso();
const units = ['KG', 'BOX', 'CARTON', 'PIECES', 'METER'];
const paymentModes = ['CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER'];

const createSupplierSchema = Joi.object({
  name: Joi.string().trim().min(2).max(160).required(),
  mobile: Joi.string().trim().pattern(/^\+?[1-9]\d{7,14}$/).required(),
  address: Joi.string().trim().max(500).allow('').default(''),
  gstin: Joi.string().trim().uppercase().pattern(/^[0-9A-Z]{15}$/).allow('').default(''),
  openingBalance: money.default(0),
});

const updateSupplierSchema = Joi.object({
  name: Joi.string().trim().min(2).max(160),
  mobile: Joi.string().trim().pattern(/^\+?[1-9]\d{7,14}$/),
  address: Joi.string().trim().max(500).allow(''),
  gstin: Joi.string().trim().uppercase().pattern(/^[0-9A-Z]{15}$/).allow(''),
}).min(1);

const purchaseItemSchema = Joi.object({
  productId: objectId.required(),
  quantity: quantity.required(),
  unit: Joi.string().valid(...units).required(),
  purchaseRate: money.required(),
  gstPercent: Joi.number().min(0).max(100).precision(2).default(0),
});

const purchaseSchema = Joi.object({
  billType: Joi.string().valid('FULL', 'QUICK').default('FULL'),
  supplierId: objectId.required(),
  idempotencyKey: Joi.string().trim().min(8).max(100).required(),
  invoiceNumber: Joi.string().trim().max(80).allow('').default(''),
  billDate: date.required(),
  items: Joi.array().items(purchaseItemSchema).min(1).max(100).required(),
  transportCharges: money.default(0),
  loadingCharges: money.default(0),
  discountType: Joi.string().valid('AMOUNT', 'PERCENT').default('AMOUNT'),
  discountValue: money.default(0),
  paymentAmount: money.default(0),
  paymentMode: Joi.string().valid(...paymentModes, '').allow('').default(''),
  paymentDate: date.optional(),
  dueDate: date.allow(null).optional(),
  notes: Joi.string().trim().max(1000).allow('').default(''),
  stockUpdateEnabled: Joi.boolean(),
  sellingPriceUpdates: Joi.array().items(Joi.object({
    productId: objectId.required(),
    retailerPrice: money.required(),
  })).max(100).default([]),
  expectedRevision: Joi.number().integer().min(0),
  confirmPaymentRefund: Joi.boolean().default(false),
}).custom((bill, helpers) => {
  if (bill.billType === 'FULL' && !bill.invoiceNumber) {
    return helpers.error('any.invalid', { message: 'Bill or invoice number is required for a full bill.' });
  }
  if (bill.billType === 'QUICK' && bill.items.length !== 1) {
    return helpers.error('any.invalid', { message: 'Quick Entry accepts one product at a time.' });
  }
  if (bill.discountType === 'PERCENT' && bill.discountValue > 100) {
    return helpers.error('any.invalid', { message: 'Discount percentage cannot exceed 100%.' });
  }
  if (bill.paymentAmount > 0 && !bill.paymentMode) {
    return helpers.error('any.invalid', { message: 'Select a payment mode for the paid amount.' });
  }
  if (bill.billType === 'FULL' && bill.stockUpdateEnabled === undefined) {
    bill.stockUpdateEnabled = true;
  }
  if (bill.billType === 'QUICK' && bill.stockUpdateEnabled === undefined) {
    bill.stockUpdateEnabled = false;
  }
  return bill;
});

const updatePurchaseSchema = purchaseSchema.keys({
  idempotencyKey: Joi.string().trim().min(8).max(100).optional(),
  expectedRevision: Joi.number().integer().min(0).required(),
});

const purchaseListSchema = Joi.object({
  from: date.optional(),
  to: date.optional(),
  supplierId: objectId.optional(),
  status: Joi.string().valid('ACTIVE', 'CANCELLED', 'ALL').default('ACTIVE'),
  billType: Joi.string().valid('FULL', 'QUICK').optional(),
  search: Joi.string().trim().max(160).allow('').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
}).custom((query, helpers) => {
  if (query.from && query.to && query.from > query.to) return helpers.error('any.invalid');
  return query;
});

const duplicateQuerySchema = Joi.object({
  supplierId: objectId.required(),
  invoiceNumber: Joi.string().trim().min(1).max(80).required(),
  excludeId: objectId.optional(),
});

const paymentSchema = Joi.object({
  amount: money.greater(0).required(),
  paymentDate: date.required(),
  paymentMode: Joi.string().valid(...paymentModes).required(),
  notes: Joi.string().trim().max(1000).allow('').default(''),
  idempotencyKey: Joi.string().trim().min(8).max(100).required(),
});

const paymentReversalSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

const purchaseReturnSchema = Joi.object({
  purchaseBillId: objectId.required(),
  returnDate: date.required(),
  items: Joi.array().items(Joi.object({
    billItemId: objectId.required(),
    quantity: quantity.required(),
  })).min(1).max(100).required(),
  reason: Joi.string().valid('DAMAGED', 'WRONG_PRODUCT', 'EXCESS_QUANTITY', 'OTHER').required(),
  refundStatus: Joi.string().valid('REFUNDED', 'ADJUSTED', 'PENDING').required(),
  refundMode: Joi.string().valid(...paymentModes, '').allow('').default(''),
  notes: Joi.string().trim().max(1000).allow('').default(''),
  idempotencyKey: Joi.string().trim().min(8).max(100).required(),
}).custom((purchaseReturn, helpers) => {
  if (purchaseReturn.refundStatus === 'REFUNDED' && !purchaseReturn.refundMode) {
    return helpers.error('any.invalid', { message: 'Select the mode in which the supplier refund was received.' });
  }
  return purchaseReturn;
});

const cancellationSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

const ledgerQuerySchema = Joi.object({
  from: date.optional(),
  to: date.optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
}).custom((query, helpers) => {
  if (query.from && query.to && query.from > query.to) return helpers.error('any.invalid');
  return query;
});

const supplierListSchema = Joi.object({
  search: Joi.string().trim().max(160).allow('').default(''),
  includeInactive: Joi.boolean().default(false),
});

const returnListSchema = Joi.object({
  supplierId: objectId.optional(),
  status: Joi.string().valid('ACTIVE', 'CANCELLED', 'ALL').default('ACTIVE'),
  limit: Joi.number().integer().min(1).max(100).default(100),
});

const idParamSchema = (key) => Joi.object({ [key]: objectId.required() });

module.exports = {
  createSupplierSchema,
  updateSupplierSchema,
  purchaseSchema,
  updatePurchaseSchema,
  purchaseListSchema,
  duplicateQuerySchema,
  paymentSchema,
  paymentReversalSchema,
  purchaseReturnSchema,
  cancellationSchema,
  ledgerQuerySchema,
  supplierListSchema,
  returnListSchema,
  idParamSchema,
};
