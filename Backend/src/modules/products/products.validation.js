const { getCategoryAttributeSchema } = require('../../config/categoryAttributes');
const Joi = require('joi');
const { Category, Product } = require('../../models');
const { BadRequestError, ValidationError } = require('../../utils/errors');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);
const nonNegativeNumber = Joi.number().min(0);
const stringList = Joi.array().items(Joi.string());
const optionalTaxRate = Joi.number().min(0).allow(null);

// Partial, lenient update schema: only fields sent are validated
const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(1),
  title: Joi.string().trim().min(1),
  productName: Joi.string().trim().min(1),
  sku: Joi.string().trim().allow(''),
  description: Joi.string().allow(''),
  brand: Joi.string().allow(''),
  category: Joi.string().allow('', null),
  categoryId: objectId.allow('', null),
  subcategoryId: objectId.allow(null, ''),
  subCategory: objectId.allow(null, ''),
  categoryName: Joi.string().allow(''),
  subcategoryName: Joi.string().allow(''),
  costPrice: nonNegativeNumber,
  sellingPrice: nonNegativeNumber,
  wholesalePrice: nonNegativeNumber,
  retailerPrice: nonNegativeNumber,
  basePrice: nonNegativeNumber,
  mrp: nonNegativeNumber,
  stock: nonNegativeNumber,
  stockQuantity: nonNegativeNumber,
  moq: Joi.number().integer().min(1),
  minOrderQty: Joi.number().integer().min(1),
  unit: Joi.string().trim().allow(''),
  pricingTiers: Joi.array().items(Joi.object({
    minQty: Joi.number().integer().min(1),
    maxQty: Joi.number().integer().min(1).allow(null),
    pricePerUnit: nonNegativeNumber,
    price: nonNegativeNumber,
    tierMin: Joi.number().integer().min(1),
    tierPrice: nonNegativeNumber,
    id: Joi.string().allow(''),
  }).unknown(true)).allow(null),
  bulkPricingTiers: Joi.array().items(Joi.object({
    minQty: Joi.number().integer().min(1),
    maxQty: Joi.number().integer().min(1).allow(null),
    pricePerUnit: nonNegativeNumber,
    price: nonNegativeNumber,
    tierMin: Joi.number().integer().min(1),
    tierPrice: nonNegativeNumber,
    id: Joi.string().allow(''),
  }).unknown(true)).allow(null),
  images: Joi.alternatives().try(stringList, Joi.array().items(Joi.object({ url: Joi.string().allow(''), publicId: Joi.string().allow('') })), Joi.string().allow('')),
  imageUrl: Joi.string().allow(''),
  sizes: Joi.alternatives().try(stringList, Joi.string().allow('')),
  colors: Joi.alternatives().try(stringList, Joi.string().allow('')),
  colorVariants: Joi.array().items(Joi.object({
    color: Joi.string().trim().min(1).required(),
    sku: Joi.string().trim().allow(''),
    images: Joi.array().items(Joi.alternatives().try(Joi.string().allow(''), Joi.object({ url: Joi.string().allow(''), publicId: Joi.string().allow('') }))).default([]),
  })).allow(null),
  size: Joi.alternatives().try(stringList, Joi.string().allow('')),
  color: Joi.alternatives().try(stringList, Joi.string().allow('')),
  additionalOptions: Joi.array().items(Joi.object({
    name: Joi.string().trim().allow(''),
    value: Joi.string().trim().allow(''),
  }).unknown(true)).allow(null),
  categoryAttributes: Joi.object().unknown(true).allow(null),
  gst: nonNegativeNumber,
  gstPercent: nonNegativeNumber,
  hsn: Joi.string().allow(''),
  hsnCode: Joi.string().allow(''),
  cgst: optionalTaxRate,
  sgst: optionalTaxRate,
  igst: Joi.number().valid(0, 5, 12, 18, 28).allow(null),
  priceIncludesTax: Joi.boolean(),
  taxConfigured: Joi.boolean(),
  weight: nonNegativeNumber,
  weightUnit: Joi.string().allow(''),
  dimensions: Joi.object({
    length: nonNegativeNumber,
    width: nonNegativeNumber,
    height: nonNegativeNumber,
  }).unknown(true).allow(null),
  lowStockThreshold: nonNegativeNumber,
  countryOfOrigin: Joi.string().allow(''),
  sizeChart: Joi.object().allow(null).unknown(true),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'DRAFT', 'OUT_OF_STOCK', 'BLOCKED'),
}).unknown(true); // Allow and ignore unknown legacy fields

const updateFields = new Set(Object.keys(updateProductSchema.describe().keys));

const validateUpdateProductBody = (req, res, next) => {
  const { error, value } = updateProductSchema.validate(req.body, {
    abortEarly: false,
    convert: true,
  });
  if (error) {
    return next(new ValidationError('Product update validation failed', error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message.replace(/['"]/g, ''),
      type: detail.type,
    }))));
  }

  // Accept legacy fields without letting unknown keys reach strict Mongoose updates.
  req.body = Object.fromEntries(Object.entries(value).filter(([key]) => updateFields.has(key)));
  return next();
};

/**
 * Middleware that dynamically validates category-specific attributes based on product category
 */
const validateCategoryAttributes = async (req, requireCategory = false) => {
  const { categoryId, categoryName: inputCategoryName, categoryAttributes = {} } = req.body;

  let categoryName = inputCategoryName || '';
  if (categoryId) {
    const catDoc = await Category.findById(categoryId);
    if (catDoc) {
      categoryName = catDoc.name;
    }
  }

  if (!categoryName && !categoryId) {
    if (requireCategory) throw new BadRequestError('Category is required');
    return;
  }

  const schemaDefs = getCategoryAttributeSchema(categoryName);
  if (!schemaDefs || schemaDefs.length === 0) return;

  // Merge root fields like sizes and colors into attrs map for unified checking
  const attrs = typeof categoryAttributes === 'object' && categoryAttributes !== null ? { ...categoryAttributes } : {};
  if (req.body.sizes && Array.isArray(req.body.sizes) && req.body.sizes.length > 0) {
    attrs.size = req.body.sizes;
  }
  if (req.body.colors && Array.isArray(req.body.colors) && req.body.colors.length > 0) {
    attrs.color = req.body.colors;
  }
  if (req.body.size && !attrs.size) attrs.size = req.body.size;
  if (req.body.color && !attrs.color) attrs.color = req.body.color;

  const allowedKeys = new Set(schemaDefs.map((def) => def.key));

  // 1. Reject unknown attributes not defined for this category
  for (const key of Object.keys(attrs)) {
    if (!allowedKeys.has(key)) {
      throw new BadRequestError(`Attribute '${key}' is not valid for category '${categoryName}'`);
    }
  }

  // 2. Validate required attributes and data types for this category
  for (const def of schemaDefs) {
    const val = attrs[def.key];

    if (def.required) {
      if (
        val === undefined ||
        val === null ||
        val === '' ||
        (Array.isArray(val) && val.length === 0)
      ) {
        throw new BadRequestError(`Field '${def.label}' (${def.key}) is required for category '${categoryName}'`);
      }
    }

    if (val !== undefined && val !== null && val !== '') {
      if (def.type === 'multiselect') {
        if (!Array.isArray(val) && typeof val !== 'string') {
          throw new BadRequestError(`Field '${def.label}' (${def.key}) must be a list of items`);
        }
      } else if (def.type === 'number') {
        if (isNaN(Number(val))) {
          throw new BadRequestError(`Field '${def.label}' (${def.key}) must be a valid number`);
        }
      } else if (def.type === 'date') {
        const d = new Date(val);
        if (isNaN(d.getTime())) {
          throw new BadRequestError(`Field '${def.label}' (${def.key}) must be a valid date`);
        }
      }
    }
  }

  req.body.categoryAttributes = attrs;
};

const validateCategoryAttributesMiddleware = async (req, res, next) => {
  try {
    await validateCategoryAttributes(req, req.method === 'POST');
    next();
  } catch (err) {
    next(err);
  }
};

const validateProductUpdateMiddleware = async (req, res, next) => {
  validateUpdateProductBody(req, res, async (validationError) => {
    if (validationError) return next(validationError);

    // Only validate category attributes if categoryId is sent AND it actually changes
    const incomingCatId = req.body.categoryId || (String(req.body.category).match(/^[0-9a-fA-F]{24}$/) ? req.body.category : null);
    if (!incomingCatId) return next();

    try {
      const currentProduct = await Product.findOne({
        _id: req.params.id,
        isDeleted: false,
      }).select('categoryId category');

      if (!currentProduct) return next();

      const currentCatId = currentProduct.categoryId || currentProduct.category;
      if (String(currentCatId) === String(incomingCatId)) {
        // Category is not changing; do not re-validate category attributes on legacy products
        return next();
      }

      // Category is changing to a new category -> validate against new category schema
      await validateCategoryAttributes(req, false);
      return next();
    } catch (err) {
      return next(err);
    }
  });
};

module.exports = {
  validateCategoryAttributesMiddleware,
  validateProductUpdateMiddleware,
};
