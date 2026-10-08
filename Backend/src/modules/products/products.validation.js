const { getCategoryAttributeSchema } = require('../../config/categoryAttributes');
const { Category } = require('../../models');
const { BadRequestError } = require('../../utils/errors');

/**
 * Middleware that dynamically validates category-specific attributes based on product category
 */
const validateCategoryAttributesMiddleware = async (req, res, next) => {
  try {
    const { categoryId, categoryName: inputCategoryName, categoryAttributes = {} } = req.body;

    let categoryName = inputCategoryName || '';
    if (categoryId) {
      const catDoc = await Category.findById(categoryId);
      if (catDoc) {
        categoryName = catDoc.name;
      }
    }

    if (!categoryName && !categoryId) {
      if (req.method === 'POST') {
        throw new BadRequestError('Category is required');
      }
      return next();
    }

    const schemaDefs = getCategoryAttributeSchema(categoryName);
    if (!schemaDefs || schemaDefs.length === 0) {
      return next();
    }

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
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  validateCategoryAttributesMiddleware,
};
