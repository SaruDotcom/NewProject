const Joi = require('joi');

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const date = Joi.string().pattern(datePattern).custom((value, helpers) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return helpers.error('date.format');
  }
  return value;
});
const amount = Joi.number().min(0).max(999999999).precision(2);
const quantity = Joi.number().min(0).max(999999).precision(3);

const entrySchema = Joi.object({
  date: date.required(),
  transactionType: Joi.string().valid('PURCHASE').default('PURCHASE'),
  productName: Joi.string().trim().max(160).required(),
  category: Joi.string().trim().max(120).allow('').default(''),
  size: Joi.string().trim().max(80).allow('').default(''),
  colour: Joi.string().trim().max(80).allow('').default(''),
  unit: Joi.string().trim().max(40).allow('').default(''),
  brandModel: Joi.string().trim().max(120).allow('').default(''),
  counterpartyName: Joi.string().trim().max(160).allow('').default(''),
  quantity: quantity.default(0),
  purchaseRate: amount.required(),
  paidAmount: amount.default(0),
  notes: Joi.string().trim().max(1000).allow('').default(''),
}).custom((entry, helpers) => {
  if (entry.quantity <= 0) return helpers.error('any.invalid', { message: 'Quantity must be greater than zero.' });
  if (!entry.counterpartyName) return helpers.error('any.invalid', { message: 'Supplier name is required.' });
  const total = Math.round(entry.quantity * entry.purchaseRate * 100) / 100;
  if (entry.paidAmount > total) {
    return helpers.error('any.invalid', { message: 'Paid amount cannot exceed total cost.' });
  }
  return entry;
});

const listQuerySchema = Joi.object({
  from: date.optional(),
  to: date.optional(),
  paymentStatus: Joi.string().valid('PAID', 'PARTIAL', 'PENDING').optional(),
  counterparty: Joi.string().trim().max(160).allow('').optional(),
  search: Joi.string().trim().max(160).allow('').optional(),
}).custom((query, helpers) => {
  if (query.from && query.to && query.from > query.to) return helpers.error('any.invalid');
  return query;
});

const settingsSchema = Joi.object({
  businessType: Joi.string().valid('CLOTHING', 'GENERAL_STORE', 'ELECTRONICS', 'FOOTWEAR', 'COSMETICS', 'OTHER').required(),
  otherBusinessType: Joi.string().trim().max(80).allow('').default(''),
}).custom((settings, helpers) => {
  if (settings.businessType === 'OTHER' && !settings.otherBusinessType) {
    return helpers.error('any.invalid', { message: 'Please enter your business type.' });
  }
  return settings;
});

module.exports = { entrySchema, listQuerySchema, settingsSchema };
