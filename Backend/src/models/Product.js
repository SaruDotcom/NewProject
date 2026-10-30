const mongoose = require('mongoose');
const { PRODUCT_STATUS } = require('../config/constants');
const { getCategoryAttributeSchema } = require('../config/categoryAttributes');

const pricingTierSchema = new mongoose.Schema(
  {
    minQty: { type: Number, required: true, min: 1 },
    maxQty: { type: Number },
    pricePerUnit: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const customAttributeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: true }
);

const colorVariantSchema = new mongoose.Schema(
  {
    color: { type: String, required: true, trim: true },
    sku: { type: String, default: '', trim: true, uppercase: true },
    images: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Wholesaler ID is required'],
      index: true,
    },
    // Universal Typed Fields
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    productName: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    brand: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    subSubcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    categoryName: {
      type: String,
      default: '',
    },
    subcategoryName: {
      type: String,
      default: '',
    },
    subSubcategoryName: {
      type: String,
      default: '',
    },
    images: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    imageUrl: {
      type: String,
      default: '',
    },
    mrp: {
      type: Number,
      default: 0,
      min: 0,
    },
    costPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    wholesalePrice: {
      type: Number,
      required: [true, 'Wholesale price is required'],
      min: 0,
    },
    sellingPrice: {
      type: Number,
      default: function () {
        return this.wholesalePrice;
      },
      min: 0,
    },
    retailerPrice: {
      type: Number,
      default: function () {
        return this.wholesalePrice;
      },
      min: 0,
    },
    basePrice: {
      type: Number,
      default: function () {
        return this.wholesalePrice;
      },
      min: 0,
    },
    moq: {
      type: Number,
      default: 1,
      min: 1,
    },
    minOrderQty: {
      type: Number,
      default: 1,
      min: 1,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    stockQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Legacy admin analytics reads this stock projection; Inventory remains authoritative.
    quantity: {
      type: Number,
      min: 0,
      default: undefined,
    },
    unit: {
      type: String,
      default: 'piece',
      trim: true,
    },
    pricingTiers: [pricingTierSchema],
    bulkPricingTiers: [pricingTierSchema],
    gst: {
      type: Number,
      default: 18.0,
      min: 0,
    },
    gstPercent: {
      type: Number,
      default: 18.0,
      min: 0,
    },
    hsn: {
      type: String,
      default: '',
      trim: true,
    },
    hsnCode: {
      type: String,
      default: '',
      trim: true,
    },
    weight: {
      type: Number,
      default: 0,
    },
    weightUnit: {
      type: String,
      default: '',
      trim: true,
    },
    dimensions: {
      length: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
    lowStockThreshold: {
      type: Number,
      default: 0,
      min: 0,
    },
    countryOfOrigin: {
      type: String,
      default: 'India',
      trim: true,
    },
    sizes: [{ type: String, trim: true }],
    colors: [{ type: String, trim: true }],
    // Optional so existing catalog records remain valid.
    colorVariants: { type: [colorVariantSchema], default: undefined },
    cgst: { type: Number, min: 0, default: undefined },
    sgst: { type: Number, min: 0, default: undefined },
    igst: { type: Number, min: 0, default: undefined },
    priceIncludesTax: { type: Boolean, default: undefined },
    // Explicitly distinguishes a new tax-free listing from legacy records that used gst defaults.
    taxConfigured: { type: Boolean, default: undefined },
    sizeChart: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    additionalOptions: [customAttributeSchema],
    
    // Dynamic Category-Specific Attributes Schema
    categoryAttributes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.ACTIVE,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

productSchema.pre('save', function (next) {
  // Sync names & titles
  const chosenName = this.productName || this.name || this.title;
  if (chosenName) {
    this.name = chosenName;
    this.productName = chosenName;
    this.title = chosenName;
  }

  // Sync category references
  if (this.category && !this.categoryId) {
    this.categoryId = this.category;
  }
  if (this.categoryId && !this.category) {
    this.category = this.categoryId;
  }
  if (this.subCategory && !this.subcategoryId) {
    this.subcategoryId = this.subCategory;
  }
  if (this.subcategoryId && !this.subCategory) {
    this.subCategory = this.subcategoryId;
  }

  // Sync pricing
  const mainPrice = this.sellingPrice || this.wholesalePrice || this.basePrice || this.retailerPrice || 0;
  this.wholesalePrice = mainPrice;
  this.sellingPrice = mainPrice;
  this.retailerPrice = mainPrice;
  this.basePrice = mainPrice;

  // Sync MOQ
  const mainMoq = this.moq || this.minOrderQty || 1;
  this.moq = mainMoq;
  this.minOrderQty = mainMoq;

  // Sync stock
  const mainStock = this.stockQuantity !== undefined && this.stockQuantity !== 0 ? this.stockQuantity : (this.stock || 0);
  this.stock = mainStock;
  this.stockQuantity = mainStock;

  // Sync GST & HSN
  if (this.gstPercent !== undefined) this.gst = this.gstPercent;
  if (this.gst !== undefined) this.gstPercent = this.gst;
  if (this.hsnCode) this.hsn = this.hsnCode;
  if (this.hsn) this.hsnCode = this.hsn;

  // Sync images
  if (!this.imageUrl && this.images && this.images.length > 0) {
    this.imageUrl = this.images[0].url || this.images[0];
  }
  if ((!this.images || this.images.length === 0) && this.imageUrl) {
    this.images = [{ url: this.imageUrl, publicId: '' }];
  }

  // Sync pricing tiers
  if ((!this.pricingTiers || this.pricingTiers.length === 0) && this.bulkPricingTiers && this.bulkPricingTiers.length > 0) {
    this.pricingTiers = this.bulkPricingTiers;
  }
  if ((!this.bulkPricingTiers || this.bulkPricingTiers.length === 0) && this.pricingTiers && this.pricingTiers.length > 0) {
    this.bulkPricingTiers = this.pricingTiers;
  }

  // Ensure countryOfOrigin default
  if (!this.countryOfOrigin) {
    this.countryOfOrigin = 'India';
  }

  next();
});

productSchema.index({ wholesalerId: 1, sku: 1 }, { unique: true });
productSchema.index({ wholesalerId: 1, status: 1 });
productSchema.index({ name: 'text', description: 'text', sku: 'text', brand: 'text' });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
