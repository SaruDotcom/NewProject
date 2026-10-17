const {
  Category,
  Product,
  WholesalerProfile,
} = require('../../models');
const {
  KYC_STATUS,
} = require('../../config/constants');
const { getCategoryAttributeSchema, normalizeCategoryKey } = require('../../config/categoryAttributes');
const ProductService = require('./products.service');
const { BadRequestError, ForbiddenError } = require('../../utils/errors');

const MAX_BULK_ROWS = 500;
const GST_OPTIONS = [0, 5, 12, 18, 28];
const NUMERIC_FIELDS = new Set([
  'Cost Price',
  'MRP',
  'Selling Price',
  'MOQ',
  'Stock Quantity',
  'Low Stock Threshold',
  'CGST %',
  'SGST %',
  'IGST %',
  'Weight',
  'Length',
  'Width',
  'Height',
  'Tier 1 Min Qty',
  'Tier 1 Price',
  'Tier 2 Min Qty',
  'Tier 2 Price',
  'Tier 3 Min Qty',
  'Tier 3 Price',
]);

const CATEGORY_FIELD_HEADERS = {
  clothing: {
    Fabric: 'fabric',
    Fit: 'fit',
    'Sleeve Type': 'sleeveType',
    Pattern: 'pattern',
    Occasion: 'occasion',
    Gender: 'gender',
    'Care Instructions': 'careInstructions',
  },
  footwear: {
    Material: 'material',
    'Sole Type': 'soleType',
    Closure: 'closureType',
    Occasion: 'occasion',
  },
  electronics: {
    'Model Number': 'modelNumber',
    Warranty: 'warrantyPeriod',
    Battery: 'batterySpecs',
    Connectivity: 'connectivity',
    'Included Accessories': 'includedAccessories',
  },
  grocery: {
    'Net Quantity': 'netQuantity',
    'Expiry Date': 'expiryDate',
    'Veg/Non-Veg': 'vegNonVeg',
    'FSSAI License': 'fssaiLicense',
    'Storage Instructions': 'storageInstructions',
  },
  beauty_personal_care: {
    Volume: 'volumeWeight',
    'Suitable For': 'suitableFor',
    'Key Ingredients': 'keyIngredients',
    'Expiry Date': 'expiryDate',
  },
  jewelry: {
    Material: 'material',
    Purity: 'purity',
    Weight: 'weight',
    'Gemstone Details': 'gemstoneDetails',
  },
  home_kitchen: {
    Material: 'material',
    Capacity: 'capacity',
    Warranty: 'warrantyPeriod',
  },
};

const SIZE_CHART_MEASUREMENTS = {
  clothing: ['Chest', 'Waist', 'Length', 'Shoulder'],
  footwear: ['Foot Length', 'Foot Width'],
};

function cleanValue(value, numericField = false) {
  if (value === undefined || value === null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'object') {
    if (value.formula) value = `=${value.formula}`;
    else if (value.text !== undefined) value = value.text;
    else return '';
  }

  const formulaPrefix = numericField ? /^[\s\t\r]*[=+@]+/ : /^[\s\t\r]*[=+\-@]+/;
  const text = String(value).replace(formulaPrefix, '');
  return text.trim();
}

function parseNumber(value, label, errors, { integer = false, min = 0 } = {}) {
  if (value === '') {
    errors.push(`Field '${label}' is required`);
    return undefined;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || (integer && !Number.isInteger(number)) || number < min) {
    errors.push(`Field '${label}' must be a ${integer ? 'whole ' : ''}number of at least ${min}`);
    return undefined;
  }
  return number;
}

function splitList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizedName(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function rowData(submitted) {
  const data = submitted && submitted.data && typeof submitted.data === 'object'
    ? submitted.data
    : submitted;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const cleaned = {};
  Object.entries(data).forEach(([key, value]) => {
    cleaned[key] = cleanValue(value, NUMERIC_FIELDS.has(key));
  });
  return cleaned;
}

class BulkProductService {
  static async resolveCategoryPath(data, categories, wholesalerId, errors) {
    const rootName = String(data.Category || '').trim();
    const subcategoryName = String(data.Subcategory || '').trim();
    const subSubcategoryName = String(data['Sub-subcategory'] || '').trim();
    if (!rootName) errors.push("Field 'Category' is required");
    if (!subcategoryName) errors.push("Field 'Subcategory' is required");
    if (!rootName || !subcategoryName) return null;

    const categoryOwnedBy = (item) => (
      !item.wholesalerId || String(item.wholesalerId) === String(wholesalerId)
    );
    const findNamed = (name, parentId) => categories
      .filter((item) => categoryOwnedBy(item) && normalizedName(item.name) === normalizedName(name))
      .filter((item) => {
        const actualParent = item.parentCategoryId || item.parentId;
        return parentId
          ? String(actualParent?._id || actualParent || '') === String(parentId)
          : !actualParent;
      })
      .sort((a, b) => Number(String(b.wholesalerId) === String(wholesalerId)) - Number(String(a.wholesalerId) === String(wholesalerId)))[0];

    const category = findNamed(rootName, null);
    if (!category) {
      errors.push(`Category '${rootName}' was not found in your category tree`);
      return null;
    }
    const subcategory = findNamed(subcategoryName, category._id);
    if (!subcategory) {
      errors.push(`Subcategory '${subcategoryName}' does not belong to category '${rootName}'`);
      return null;
    }
    let subSubcategory = null;
    if (subSubcategoryName) {
      subSubcategory = findNamed(subSubcategoryName, subcategory._id);
      if (!subSubcategory) {
        errors.push(`Sub-subcategory '${subSubcategoryName}' does not belong to '${rootName} / ${subcategoryName}'`);
        return null;
      }
    }

    return { category, subcategory, subSubcategory };
  }

  static validateSizeChart(data, categoryKey, sizes, errors) {
    const measurements = SIZE_CHART_MEASUREMENTS[categoryKey];
    if (!measurements) {
      const hasSizeChartData = Object.entries(data).some(([header, value]) => (
        header === 'Size Chart Unit'
          ? value !== ''
          : header.startsWith('Size Chart -') && value !== ''
      ));
      if (hasSizeChartData) errors.push(`Size charts are not valid for category '${data.Category || ''}'`);
      return null;
    }

    const rows = [];
    const selectedSizes = new Set(sizes.map(normalizedName));
    const suppliedSizes = new Set();
    Object.keys(data).forEach((header) => {
      const match = header.match(/^Size Chart - (.+) - (.+)$/);
      if (match && measurements.includes(match[2]) && data[header] !== '') suppliedSizes.add(match[1]);
    });

    suppliedSizes.forEach((size) => {
      if (!selectedSizes.has(normalizedName(size))) {
        errors.push(`Size chart contains '${size}', which is not listed in Sizes`);
      }
    });

    for (const size of sizes) {
      const values = {};
      let hasMeasurement = false;
      for (const measurement of measurements) {
        const value = data[`Size Chart - ${size} - ${measurement}`];
        if (value === undefined || value === '') continue;
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue) || numericValue <= 0) {
          errors.push(`Size Chart '${size}' ${measurement} must be a number greater than 0`);
          continue;
        }
        values[measurement] = numericValue;
        hasMeasurement = true;
      }
      if (hasMeasurement) rows.push({ size, measurements: values });
    }

    const unit = String(data['Size Chart Unit'] || '').trim().toLowerCase();
    if (rows.length > 0 && !['inch', 'cm'].includes(unit)) {
      errors.push("Field 'Size Chart Unit' must be 'inch' or 'cm' when measurements are provided");
    } else if (unit && !['inch', 'cm'].includes(unit)) {
      errors.push("Field 'Size Chart Unit' must be 'inch' or 'cm'");
    }
    return rows.length > 0 ? { unit, measurements: rows } : null;
  }

  static async validateRow(submitted, index, categories, existingSkus, wholesalerId) {
    const rowNumber = Number(submitted?.rowNumber) || index + 2;
    const data = rowData(submitted);
    const errors = [];
    if (!data) {
      return { rowNumber, data: {}, product: null, errors: ['Row must contain product data'] };
    }

    const requiredTextFields = ['Product Name', 'SKU', 'Description'];
    for (const field of requiredTextFields) {
      if (!String(data[field] || '').trim()) errors.push(`Field '${field}' is required`);
    }

    const parsed = {};
    const priceAndStockFields = [
      ['Cost Price', { min: 0 }],
      ['MRP', { min: 0 }],
      ['Selling Price', { min: 0 }],
      ['MOQ', { integer: true, min: 1 }],
      ['Stock Quantity', { integer: true, min: 0 }],
    ];
    priceAndStockFields.forEach(([field, options]) => {
      parsed[field] = parseNumber(data[field], field, errors, options);
    });

    const optionalNumberFields = [
      ['Low Stock Threshold', { integer: true, min: 0 }],
      ['Weight', { min: 0 }],
      ['Length', { min: 0 }],
      ['Width', { min: 0 }],
      ['Height', { min: 0 }],
    ];
    optionalNumberFields.forEach(([field, options]) => {
      parsed[field] = data[field] === undefined || data[field] === ''
        ? 0
        : parseNumber(data[field], field, errors, options);
    });

    const cgst = data['CGST %'] === undefined || data['CGST %'] === '' ? undefined : Number(data['CGST %']);
    const sgst = data['SGST %'] === undefined || data['SGST %'] === '' ? undefined : Number(data['SGST %']);
    const igst = data['IGST %'] === undefined || data['IGST %'] === '' ? undefined : Number(data['IGST %']);
    if (igst !== undefined && !GST_OPTIONS.includes(igst)) errors.push(`Field 'IGST %' must be one of: ${GST_OPTIONS.join(', ')}`);
    if (cgst !== undefined && sgst !== undefined && cgst !== sgst) errors.push('CGST % must equal SGST %');
    if (cgst !== undefined && sgst !== undefined && igst !== undefined && cgst + sgst !== igst) errors.push('IGST % must equal CGST % + SGST %');
    const priceIncludesTax = String(data['Price Includes Tax'] || '').trim().toLowerCase();
    if (priceIncludesTax && !['yes', 'no', 'true', 'false'].includes(priceIncludesTax)) errors.push("Field 'Price Includes Tax' must be Yes or No");

    const status = String(data.Status || 'ACTIVE').trim().toUpperCase();
    if (!['ACTIVE', 'DRAFT'].includes(status)) errors.push("Field 'Status' must be 'ACTIVE' or 'DRAFT'");

    const imageUrls = splitList(data['Image URLs']);
    if (imageUrls.length > 5) errors.push('Image URLs can contain at most 5 URLs');
    imageUrls.forEach((imageUrl) => {
      try {
        const url = new URL(imageUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
      } catch {
        errors.push(`Image URL '${imageUrl}' must be a valid HTTP or HTTPS URL`);
      }
    });

    const tiers = [];
    for (let tier = 1; tier <= 3; tier += 1) {
      const minField = `Tier ${tier} Min Qty`;
      const priceField = `Tier ${tier} Price`;
      const minQty = data[minField] === undefined || data[minField] === ''
        ? undefined
        : parseNumber(data[minField], minField, errors, { integer: true, min: 1 });
      const pricePerUnit = data[priceField] === undefined || data[priceField] === ''
        ? undefined
        : parseNumber(data[priceField], priceField, errors, { min: 0 });
      if ((minQty === undefined) !== (pricePerUnit === undefined)) {
        errors.push(`Tier ${tier} Min Qty and Tier ${tier} Price must both be filled or both be blank`);
      } else if (minQty !== undefined && pricePerUnit !== undefined) {
        tiers.push({ minQty, pricePerUnit });
      }
    }
    tiers.sort((a, b) => a.minQty - b.minQty);
    for (let tier = 1; tier < tiers.length; tier += 1) {
      if (tiers[tier].minQty <= tiers[tier - 1].minQty) {
        errors.push('Bulk pricing tier minimum quantities must be unique and increasing');
        break;
      }
    }

    const categoryPath = await this.resolveCategoryPath(data, categories, wholesalerId, errors);
    const sizes = splitList(data.Sizes);
    const colors = splitList(data.Colors);
    const categoryName = categoryPath?.category.name || String(data.Category || '').trim();
    const categoryKey = normalizeCategoryKey(categoryName);
    const categorySchema = getCategoryAttributeSchema(categoryName);
    if (categorySchema.length === 0) {
      errors.push(`No product attribute rules are configured for category '${categoryName}'`);
    }
    const categoryAttributes = {};
    const fieldHeaders = CATEGORY_FIELD_HEADERS[categoryKey] || {};
    Object.entries(fieldHeaders).forEach(([header, key]) => {
      const value = data[header];
      if (value === '') return;
      const definition = categorySchema.find((item) => item.key === key);
      if (!definition) return;
      categoryAttributes[key] = definition.type === 'multiselect'
        ? splitList(value)
        : definition.type === 'number'
          ? Number(value)
          : value;
    });
    if (sizes.length > 0) categoryAttributes.size = sizes;
    if (colors.length > 0) categoryAttributes.color = colors;

    for (const definition of categorySchema) {
      const value = categoryAttributes[definition.key];
      if (
        definition.required &&
        definition.key !== 'size' &&
        definition.key !== 'color' &&
        (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))
      ) {
        errors.push(`Field '${definition.label}' (${definition.key}) is required for category '${categoryName}'`);
        continue;
      }
      if (value === undefined || value === '') continue;
      if (definition.type === 'number' && !Number.isFinite(Number(value))) {
        errors.push(`Field '${definition.label}' (${definition.key}) must be a valid number`);
      } else if (definition.type === 'date' && Number.isNaN(new Date(value).getTime())) {
        errors.push(`Field '${definition.label}' (${definition.key}) must be a valid date`);
      }
      if (definition.options && definition.type === 'select' && !definition.options.includes(String(value))) {
        errors.push(`Field '${definition.label}' must be one of: ${definition.options.join(', ')}`);
      }
      if (
        definition.options &&
        definition.type === 'multiselect' &&
        definition.key !== 'size' &&
        definition.key !== 'color'
      ) {
        const invalid = value.filter((entry) => !definition.options.includes(entry));
        if (invalid.length > 0) {
          errors.push(`Field '${definition.label}' contains unsupported option(s): ${invalid.join(', ')}`);
        }
      }
    }

    if (categorySchema.some((definition) => definition.key === 'size' && definition.required) && sizes.length === 0) {
      errors.push("Field 'Sizes' is required for this category");
    } else if (!categorySchema.some((definition) => definition.key === 'size') && sizes.length > 0) {
      errors.push(`Sizes are not valid for category '${categoryName}'`);
    }
    if (categorySchema.some((definition) => definition.key === 'color' && definition.required) && colors.length === 0) {
      errors.push("Field 'Colors' is required for this category");
    } else if (!categorySchema.some((definition) => definition.key === 'color') && colors.length > 0) {
      errors.push(`Colors are not valid for category '${categoryName}'`);
    }

    const sizeChart = this.validateSizeChart(data, categoryKey, sizes, errors);
    const sku = String(data.SKU || '').trim().toUpperCase();
    if (sku && existingSkus.has(sku)) errors.push(`A product with SKU '${sku}' already exists in your inventory`);

    const categoryId = categoryPath?.category._id;
    const subcategoryId = categoryPath?.subcategory._id;
    const subSubcategoryId = categoryPath?.subSubcategory?._id;
    const product = categoryPath ? {
      name: String(data['Product Name'] || '').trim(),
      sku,
      brand: String(data.Brand || '').trim(),
      description: String(data.Description || '').trim(),
      categoryId,
      subcategoryId,
      subSubcategoryId: subSubcategoryId || null,
      subcategoryName: categoryPath.subcategory.name,
      subSubcategoryName: categoryPath.subSubcategory?.name || '',
      images: imageUrls,
      imageUrl: imageUrls[0] || '',
      costPrice: parsed['Cost Price'],
      mrp: parsed.MRP,
      wholesalePrice: parsed['Selling Price'],
      retailerPrice: parsed['Selling Price'],
      moq: parsed.MOQ,
      minOrderQty: parsed.MOQ,
      stock: parsed['Stock Quantity'],
      lowStockThreshold: parsed['Low Stock Threshold'],
      gst: igst ?? 0,
      hsn: String(data['HSN Code'] || '').trim(),
      hsnCode: String(data['HSN Code'] || '').trim(),
      cgst,
      sgst,
      igst,
      priceIncludesTax: ['yes', 'true'].includes(priceIncludesTax),
      status,
      countryOfOrigin: String(data['Country of Origin'] || '').trim() || 'India',
      weight: parsed.Weight,
      weightUnit: String(data['Weight Unit'] || '').trim(),
      dimensions: {
        length: parsed.Length,
        width: parsed.Width,
        height: parsed.Height,
      },
      sizes,
      colors,
      sizeChart,
      pricingTiers: tiers,
      categoryAttributes,
    } : null;

    return { rowNumber, data, product, errors };
  }

  static async preview(rows, wholesalerUser) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestError('Upload a spreadsheet containing at least one product row');
    }
    if (rows.length > MAX_BULK_ROWS) {
      throw new BadRequestError(`A single upload can contain at most ${MAX_BULK_ROWS} product rows`);
    }

    const wholesalerId = wholesalerUser._id;
    const categories = await Category.find({
      isDeleted: false,
      $or: [{ wholesalerId: null }, { wholesalerId }],
    }).lean();
    const cleanedRows = rows.map((submitted) => rowData(submitted) || {});
    const skuCounts = new Map();
    cleanedRows.forEach((data) => {
      const sku = String(data.SKU || '').trim().toUpperCase();
      if (sku) skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
    });
    const uploadedSkus = [...skuCounts.keys()];
    const existingProducts = uploadedSkus.length
      ? await Product.find({ wholesalerId, sku: { $in: uploadedSkus } }).select('sku').lean()
      : [];
    const existingSkus = new Set(existingProducts.map((product) => String(product.sku).toUpperCase()));

    const result = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = await this.validateRow(rows[index], index, categories, existingSkus, wholesalerId);
      const sku = String(row.data.SKU || '').trim().toUpperCase();
      if (skuCounts.get(sku) > 1) row.errors.push(`SKU '${sku}' appears more than once in this upload`);
      result.push({
        rowNumber: row.rowNumber,
        data: row.data,
        product: row.product,
        valid: row.errors.length === 0,
        errors: row.errors,
      });
    }
    return result;
  }

  static async importValidRows(rows, wholesalerUser, req = null) {
    const profile = await WholesalerProfile.findOne({ userId: wholesalerUser._id });
    if (!profile || profile.kycStatus !== KYC_STATUS.APPROVED) {
      throw new ForbiddenError('Wholesaler KYC must be approved before importing products', 'KYC_APPROVAL_REQUIRED');
    }

    const preview = await this.preview(rows, wholesalerUser);
    const imported = [];
    const rejected = [];
    for (const row of preview) {
      if (!row.valid || !row.product) {
        rejected.push({ rowNumber: row.rowNumber, errors: row.errors });
        continue;
      }
      try {
        const result = await ProductService.createProduct(row.product, wholesalerUser, req);
        imported.push({ rowNumber: row.rowNumber, productId: String(result.product._id) });
      } catch (error) {
        rejected.push({
          rowNumber: row.rowNumber,
          errors: [error.message || 'Product import failed'],
        });
      }
    }

    return { imported, rejected };
  }
}

module.exports = BulkProductService;
