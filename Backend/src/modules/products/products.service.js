const slugify = require('slugify');
const {
  Product,
  Inventory,
  InventoryTransaction,
  User,
  WholesalerProfile,
  Category,
  WholesalerRetailerRelationship,
} = require('../../models');
const {
  PRODUCT_STATUS,
  KYC_STATUS,
  INVENTORY_TRANSACTION_TYPE,
  AUDIT_ACTION,
  ROLES,
} = require('../../config/constants');
const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} = require('../../utils/errors');
const { parsePagination } = require('../../utils/pagination');
const AuditService = require('../../services/audit.service');

function validateTaxDetails(tax) {
  const { cgst, sgst, igst } = tax;
  const supplied = (value) => value !== undefined && value !== null && value !== '';
  if (supplied(cgst) && supplied(sgst) && Number(cgst) !== Number(sgst)) {
    throw new ValidationError('Product validation failed', [{ field: 'cgst', message: 'CGST must equal SGST' }]);
  }
  if (supplied(cgst) && supplied(sgst) && supplied(igst) && Number(cgst) + Number(sgst) !== Number(igst)) {
    throw new ValidationError('Product validation failed', [{ field: 'igst', message: 'IGST must equal CGST + SGST' }]);
  }
}

function extractImageUrl(image) {
  if (!image) return '';
  if (typeof image === 'string') return image.trim();
  if (typeof image === 'object') {
    if (image.url && typeof image.url === 'string') return image.url.trim();
    const keys = Object.keys(image).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
    if (keys.length > 5) {
      return keys.map((k) => image[k]).join('').trim();
    }
  }
  return '';
}

function normalizeImageUrls(images = [], primaryUrl = '') {
  const list = (Array.isArray(images) ? images : [images])
    .map(extractImageUrl)
    .filter(Boolean);
  const primary = extractImageUrl(primaryUrl);
  const merged = primary ? [primary, ...list.filter((u) => u !== primary)] : list;
  return [...new Set(merged)];
}

function normalizeColorVariants(variants = []) {
  if (!Array.isArray(variants)) return [];
  return variants.map((variant) => {
    if (!variant || typeof variant !== 'object') return null;
    const color = String(variant.color || '').trim();
    if (!color) return null;
    const sku = String(variant.sku || '').trim().toUpperCase();
    const images = normalizeImageUrls(variant.images || []);
    return { color, sku, images };
  }).filter(Boolean);
}

function sanitizeProductData(prod) {
  if (!prod) return prod;
  const images = normalizeImageUrls(prod.images || [], prod.imageUrl || '');
  const imageUrl = images[0] || extractImageUrl(prod.imageUrl) || '';
  const colorVariants = normalizeColorVariants(prod.colorVariants || []);
  return {
    ...prod,
    imageUrl,
    images,
    colorVariants,
  };
}

class ProductService {
  static async validateCategorySelection(categoryId, subcategoryId, wholesalerId) {
    if (!categoryId) {
      throw new BadRequestError('A main category is required');
    }

    const category = await Category.findById(categoryId);
    if (!category || category.isDeleted) {
      throw new NotFoundError('Category not found');
    }
    if (category.parentId) {
      throw new BadRequestError('Select a main category, not a subcategory');
    }
    if (category.wholesalerId && String(category.wholesalerId) !== String(wholesalerId)) {
      throw new ForbiddenError('You can only use your own or global categories');
    }

    if (subcategoryId) {
      const subcategory = await Category.findById(subcategoryId);
      if (!subcategory || subcategory.isDeleted) {
        throw new NotFoundError('Subcategory not found');
      }

      // Check that subcategory traces up to the selected main category (handles Level 2 and Level 3)
      let curr = subcategory;
      let belongs = false;
      const visited = new Set();
      while (curr && curr.parentId && !visited.has(String(curr._id))) {
        visited.add(String(curr._id));
        if (String(curr.parentId) === String(category._id)) {
          belongs = true;
          break;
        }
        curr = await Category.findById(curr.parentId);
      }

      if (!belongs) {
        throw new BadRequestError('Subcategory must belong to the selected main category');
      }
      if (subcategory.wholesalerId && String(subcategory.wholesalerId) !== String(wholesalerId)) {
        throw new ForbiddenError('You can only use your own or global subcategories');
      }
    }

    return category;
  }

  static async attachWholesalerMeta(products = []) {
    if (!Array.isArray(products) || products.length === 0) return products;

    const wholesalerIds = [...new Set(products
      .map((product) => product.wholesalerId && (product.wholesalerId._id || product.wholesalerId))
      .filter(Boolean)
      .map((id) => String(id)))];

    if (wholesalerIds.length === 0) {
      return products.map((product) => ({
        ...product,
        wholesaler: {
          _id: product.wholesalerId,
          id: product.wholesalerId,
          name: '',
          email: '',
          businessName: 'Wholesaler',
          phone: '',
          city: '',
          state: '',
        },
      }));
    }

    const profiles = await WholesalerProfile.find({ userId: { $in: wholesalerIds } }).lean();
    const profileMap = new Map(profiles.map((profile) => [String(profile.userId), profile]));

    return products.map((product) => {
      const wholesalerUser = product.wholesalerId || {};
      const userId = String(wholesalerUser._id || wholesalerUser.id || product.wholesalerId || '');
      const profile = profileMap.get(userId) || {};
      const businessName = profile.businessName || wholesalerUser.businessName || wholesalerUser.name || 'Wholesaler';

      return {
        ...product,
        wholesaler: {
          _id: wholesalerUser._id || wholesalerUser.id || product.wholesalerId,
          id: wholesalerUser._id || wholesalerUser.id || product.wholesalerId,
          name: wholesalerUser.name || '',
          email: wholesalerUser.email || '',
          phone: wholesalerUser.phone || profile.phone || '',
          businessName,
          city: profile.address?.city || wholesalerUser.city || '',
          state: profile.address?.state || wholesalerUser.state || '',
        },
      };
    });
  }

  /**
   * Helper to generate unique product slug
   */
  static async generateSlug(name, excludeId = null) {
    const baseSlug = slugify(name, { lower: true, strict: true });
    let slug = baseSlug;
    let count = 0;
    while (true) {
      const query = { slug };
      if (excludeId) query._id = { $ne: excludeId };
      const exists = await Product.findOne(query);
      if (!exists) return slug;
      count++;
      slug = `${baseSlug}-${count}`;
    }
  }

  /**
   * Super Admin / Global Product List
   */
  static async listAdminProducts(query = {}) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = { isDeleted: false };

    if (query.wholesaler && query.wholesaler !== 'all') filter.wholesalerId = query.wholesaler;
    else if (query.wholesalerId) filter.wholesalerId = query.wholesalerId;

    if (query.category && query.category !== 'all') filter.categoryId = query.category;
    else if (query.categoryId) filter.categoryId = query.categoryId;

    if (query.status && query.status !== 'all') filter.status = query.status;

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [{ name: searchRegex }, { title: searchRegex }, { sku: searchRegex }, { brand: searchRegex }];
    }

    const [products, total, wholesalers, categories] = await Promise.all([
      Product.find(filter)
        .populate('wholesalerId', 'name email phone businessName')
        .populate('categoryId', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
      User.find({ role: ROLES.WHOLESALER, isDeleted: false }).select('name businessName').lean(),
      Category.find({ isDeleted: false }).select('name slug').lean(),
    ]);

    const enrichedProducts = await this.attachWholesalerMeta(products);

    const items = enrichedProducts.map((p) => ({
      ...p,
      id: String(p._id || p.id),
      wholesaler: {
        id: String(p.wholesaler?._id || p.wholesalerId || ''),
        name: p.wholesaler?.businessName || p.wholesaler?.name || 'Wholesaler',
        businessName: p.wholesaler?.businessName || p.wholesaler?.name || 'Wholesaler',
        email: p.wholesaler?.email || '',
      },
      category: {
        id: String(p.categoryId?._id || p.categoryId || ''),
        name: typeof p.categoryId === 'object' && p.categoryId?.name ? p.categoryId.name : (typeof p.category === 'string' ? p.category : 'General'),
      },
    }));

    return {
      products: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      filters: {
        wholesalers: wholesalers.map((w) => ({ id: String(w._id), name: w.businessName || w.name })),
        categories: categories.map((c) => ({ _id: String(c._id), id: String(c._id), name: c.name })),
      },
    };
  }

  /**
   * Wholesaler gets own products
   */
  static async listWholesalerProducts(wholesalerUser, query = {}) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = { wholesalerId: wholesalerUser._id, isDeleted: false };

    if (query.categoryId) filter.categoryId = query.categoryId;
    if (query.status) filter.status = query.status;

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [{ name: searchRegex }, { title: searchRegex }, { sku: searchRegex }, { brand: searchRegex }];
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('categoryId', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return {
      products: products.map(sanitizeProductData),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retailer gets products from connected active wholesaler
   */
  static async listRetailerConnectedProducts(retailerUser, query = {}) {
    // Find active relationship for retailer
    const relationship = await WholesalerRetailerRelationship.findOne({
      retailerId: retailerUser._id,
      status: 'ACTIVE',
    });

    if (!relationship) {
      return { products: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    }

    const wholesalerId = relationship.wholesalerId;
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {
      wholesalerId,
      status: PRODUCT_STATUS.ACTIVE,
      isDeleted: false,
    };

    if (query.category && query.category !== 'All') {
      const categoryDoc = await Category.findOne({
        $or: [{ name: new RegExp(query.category, 'i') }, { slug: query.category }],
      });
      if (categoryDoc) {
        filter.$or = [{ categoryId: categoryDoc._id }, { subcategoryId: categoryDoc._id }];
      }
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [{ name: searchRegex }, { title: searchRegex }, { sku: searchRegex }, { brand: searchRegex }];
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('categoryId', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return {
      products: products.map(sanitizeProductData),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single product by ID
   */
  static async getProductById(productId) {
    const product = await Product.findById(productId)
      .populate('wholesalerId', 'name email phone')
      .populate('categoryId', 'name slug')
      .populate('subcategoryId', 'name slug');

    if (!product || product.isDeleted) {
      throw new NotFoundError('Product not found');
    }

    const inventory = await Inventory.findOne({ productId: product._id });
    const wholesalerUser = product.wholesalerId ? product.wholesalerId.toObject ? product.wholesalerId.toObject() : product.wholesalerId : {};
    const profile = await WholesalerProfile.findOne({ userId: wholesalerUser._id || product.wholesalerId }).lean();
    const productDoc = product.toObject ? product.toObject() : product;
    const businessName = profile?.businessName || wholesalerUser.businessName || wholesalerUser.name || 'Wholesaler';
    const sanitizedProduct = sanitizeProductData(productDoc);

    return {
      product: {
        ...sanitizedProduct,
        wholesaler: {
          _id: wholesalerUser._id || product.wholesalerId,
          id: wholesalerUser._id || product.wholesalerId,
          name: wholesalerUser.name || '',
          email: wholesalerUser.email || '',
          phone: wholesalerUser.phone || profile?.phone || '',
          businessName,
          city: profile?.address?.city || '',
          state: profile?.address?.state || '',
        },
      },
      inventory,
    };
  }

  /**
   * Wholesaler creates product
   */
  static async createProduct(productData, wholesalerUser, req = null) {
    const wholesalerId = wholesalerUser._id;
    validateTaxDetails(productData);

    // Check KYC status before allowing product publication
    const wholesalerProfile = await WholesalerProfile.findOne({ userId: wholesalerId });
    if (!wholesalerProfile || wholesalerProfile.kycStatus !== KYC_STATUS.APPROVED) {
      throw new ForbiddenError(
        'Wholesaler KYC must be approved before publishing products',
        'KYC_APPROVAL_REQUIRED'
      );
    }

    const {
      name,
      title,
      sku,
      brand,
      description,
      categoryId,
      subcategoryId,
      subSubcategoryId,
      images,
      imageUrl,
      mrp,
      costPrice,
      wholesalePrice,
      retailerPrice,
      moq,
      minOrderQty,
      pricingTiers,
      stock = 0,
      unit,
      gst,
      hsn,
      sizes,
      colors,
      colorVariants,
      additionalOptions,
      lowStockThreshold,
      weight,
      weightUnit,
      dimensions,
      countryOfOrigin,
      sizeChart,
      status,
    } = productData;

    const productName = name || title;
    if (!productName) {
      throw new BadRequestError('Product name or title is required');
    }

    const cleanSku = (sku || `SKU-${Date.now()}`).toUpperCase().trim();

    // Check unique SKU for this wholesaler
    const existingSku = await Product.findOne({ wholesalerId, sku: cleanSku, isDeleted: false });
    if (existingSku) {
      throw new ConflictError(`A product with SKU '${cleanSku}' already exists in your inventory.`, 'DUPLICATE_SKU');
    }

    const category = await this.validateCategorySelection(categoryId, subcategoryId, wholesalerId);
    const categoryName = category.name;

    const slug = await this.generateSlug(productName);

    const product = await Product.create({
      wholesalerId,
      name: productName,
      title: productName,
      slug,
      sku: cleanSku,
      brand: brand || '',
      description: description || '',
      categoryId,
      subcategoryId: subcategoryId || null,
      subSubcategoryId: subSubcategoryId || null,
      categoryName,
      subcategoryName: productData.subcategoryName || '',
      subSubcategoryName: productData.subSubcategoryName || '',
      images: normalizeImageUrls(images || (imageUrl ? [imageUrl] : []), imageUrl),
      imageUrl: normalizeImageUrls(images || (imageUrl ? [imageUrl] : []), imageUrl)[0] || extractImageUrl(imageUrl) || '',
      mrp: mrp !== undefined ? mrp : (wholesalePrice !== undefined ? wholesalePrice : 0),
      costPrice: costPrice || 0,
      wholesalePrice: wholesalePrice !== undefined ? wholesalePrice : (costPrice || 0),
      retailerPrice: retailerPrice !== undefined ? retailerPrice : (wholesalePrice || 0),
      moq: moq || minOrderQty || 1,
      minOrderQty: minOrderQty || moq || 1,
      pricingTiers: pricingTiers || [],
      stock: parseInt(stock, 10) || 0,
      unit: unit || 'piece',
      // Legacy GST remains supported; newly created products with no tax details are tax-free.
      gst: gst !== undefined ? gst : (productData.gstPercent !== undefined ? productData.gstPercent : (productData.igst ?? 0)),
      hsn: hsn || '',
      lowStockThreshold: lowStockThreshold !== undefined ? lowStockThreshold : 0,
      weight: weight !== undefined ? weight : 0,
      weightUnit: weightUnit || '',
      dimensions: dimensions || {},
      countryOfOrigin: countryOfOrigin || 'India',
      sizes: sizes || [],
      colors: colors || [],
      colorVariants: normalizeColorVariants(colorVariants),
      hsnCode: productData.hsnCode || hsn || '',
      cgst: productData.cgst,
      sgst: productData.sgst,
      igst: productData.igst,
      priceIncludesTax: productData.priceIncludesTax,
      taxConfigured: Boolean(productData.hsnCode || productData.hsn || productData.cgst != null || productData.sgst != null || productData.igst != null),
      sizeChart: sizeChart || null,
      additionalOptions: additionalOptions || [],
      categoryAttributes: productData.categoryAttributes || {},
      status: status || PRODUCT_STATUS.ACTIVE,
    });

    // Create corresponding Inventory record
    const inventory = await Inventory.create({
      productId: product._id,
      wholesalerId,
      available: parseInt(stock, 10) || 0,
      reserved: 0,
      sold: 0,
    });

    if (stock > 0) {
      await InventoryTransaction.create({
        inventoryId: inventory._id,
        productId: product._id,
        wholesalerId,
        type: INVENTORY_TRANSACTION_TYPE.RECEIVE,
        quantity: parseInt(stock, 10),
        previousAvailable: 0,
        newAvailable: parseInt(stock, 10),
        referenceType: 'RESTOCK',
        performedBy: wholesalerId,
        notes: 'Initial product stock creation',
      });
    }

    await AuditService.log({
      actorId: wholesalerId,
      actorRole: wholesalerUser.role,
      action: AUDIT_ACTION.CREATE,
      entityType: 'Product',
      entityId: product._id,
      after: product.toJSON(),
      req,
    });

    return { product, inventory };
  }

  /**
   * Update product
   */
  static async updateProduct(productId, updateData, user, req = null) {
    const product = await Product.findById(productId);
    if (!product || product.isDeleted) {
      throw new NotFoundError('Product not found');
    }

    // Ownership check: compare wholesalerId from the JWT with product.wholesalerId as strings
    const userWholesalerId = String(user._id || user.id || '');
    const productWholesalerId = String(product.wholesalerId?._id || product.wholesalerId || '');
    if (user.role === ROLES.WHOLESALER && userWholesalerId !== productWholesalerId) {
      throw new ForbiddenError('You can only update your own products');
    }

    const beforeState = product.toJSON();
    validateTaxDetails({
      cgst: updateData.cgst ?? product.cgst,
      sgst: updateData.sgst ?? product.sgst,
      igst: updateData.igst ?? product.igst,
    });
    const set = {};
    const supplied = (key) => Object.prototype.hasOwnProperty.call(updateData, key);
    const newName = updateData.name ?? updateData.title ?? updateData.productName;
    if (newName !== undefined) {
      set.name = newName;
      set.productName = newName;
      set.title = newName;
      set.slug = await this.generateSlug(newName, product._id);
    }

    if (supplied('sku')) {
      const cleanSku = updateData.sku.toUpperCase().trim();
      if (cleanSku && cleanSku !== product.sku) {
        const existing = await Product.findOne({
          wholesalerId: product.wholesalerId,
          sku: cleanSku,
          _id: { $ne: product._id },
          isDeleted: false,
        });
        if (existing) {
          throw new ConflictError(`Product with SKU '${cleanSku}' already exists.`, 'DUPLICATE_SKU');
        }
      }
      set.sku = cleanSku;
    }

    const mainPrice = updateData.sellingPrice ?? updateData.wholesalePrice
      ?? updateData.basePrice ?? updateData.retailerPrice;
    const currentSellingPrice = product.sellingPrice ?? product.wholesalePrice ?? product.basePrice ?? 0;
    const currentCostPrice = product.costPrice ?? 0;
    const currentMrp = product.mrp ?? 0;
    const resultingSellingPrice = mainPrice !== undefined ? Number(mainPrice) : currentSellingPrice;
    const resultingCostPrice = updateData.costPrice !== undefined ? Number(updateData.costPrice) : currentCostPrice;
    const resultingMrp = updateData.mrp !== undefined ? Number(updateData.mrp) : currentMrp;

    const priceErrors = [];
    const sellingOrCostChanged = mainPrice !== undefined || supplied('costPrice');
    const mrpSupplied = supplied('mrp');

    if (sellingOrCostChanged && resultingSellingPrice < resultingCostPrice) {
      priceErrors.push({ field: 'sellingPrice', message: 'Selling price must be greater than or equal to cost price' });
    }
    if (mrpSupplied) {
      if (resultingMrp < resultingSellingPrice) {
        priceErrors.push({ field: 'mrp', message: 'MRP must be greater than or equal to selling price' });
      }
    } else if (mainPrice !== undefined && resultingSellingPrice > currentMrp) {
      // Auto-bump MRP for legacy products where MRP was 0 or omitted
      set.mrp = resultingSellingPrice;
    }

    if (priceErrors.length > 0) {
      throw new ValidationError('Product update validation failed', priceErrors);
    }

    if (mainPrice !== undefined) {
      set.sellingPrice = Number(mainPrice);
      set.wholesalePrice = Number(mainPrice);
      set.retailerPrice = Number(mainPrice);
      set.basePrice = Number(mainPrice);
    }
    if (supplied('costPrice') && updateData.costPrice !== undefined) {
      set.costPrice = Number(updateData.costPrice);
    }
    if (supplied('mrp') && updateData.mrp !== undefined) {
      set.mrp = Number(updateData.mrp);
    }

    if (supplied('moq') || supplied('minOrderQty')) {
      const moq = updateData.minOrderQty ?? updateData.moq;
      if (moq !== undefined) {
        if (Number(moq) < 1) {
          throw new ValidationError('Product update validation failed', [{
            field: 'minOrderQty',
            message: 'Minimum order quantity must be at least 1',
          }]);
        }
        set.moq = Number(moq);
        set.minOrderQty = Number(moq);
      }
    }

    if (supplied('stock') || supplied('stockQuantity')) {
      const stock = updateData.stock ?? updateData.stockQuantity;
      if (stock !== undefined) {
        if (Number(stock) < 0) {
          throw new ValidationError('Product update validation failed', [{
            field: 'stock',
            message: 'Stock cannot be negative',
          }]);
        }
        set.stock = Number(stock);
        set.stockQuantity = Number(stock);
      }
    }

    const simpleFields = [
      'description', 'brand', 'unit', 'status',
      'additionalOptions', 'categoryAttributes', 'weight', 'weightUnit',
      'dimensions', 'lowStockThreshold', 'countryOfOrigin', 'sizeChart',
    ];
    simpleFields.forEach((field) => {
      if (supplied(field)) set[field] = updateData[field];
    });

    // Map sizes flexibly (array of strings or comma-separated string)
    if (supplied('sizes') || supplied('size')) {
      const rawSizes = updateData.sizes !== undefined ? updateData.sizes : updateData.size;
      if (Array.isArray(rawSizes)) {
        set.sizes = rawSizes.map((s) => String(s).trim()).filter(Boolean);
      } else if (typeof rawSizes === 'string') {
        set.sizes = rawSizes.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    // Map colors flexibly (array of strings or comma-separated string)
    if (supplied('colors') || supplied('color')) {
      const rawColors = updateData.colors !== undefined ? updateData.colors : updateData.color;
      if (Array.isArray(rawColors)) {
        set.colors = rawColors.map((c) => String(c).trim()).filter(Boolean);
      } else if (typeof rawColors === 'string') {
        set.colors = rawColors.split(',').map((c) => c.trim()).filter(Boolean);
      }
    }

    // Map pricing tiers cleanly
    if (supplied('pricingTiers') || supplied('bulkPricingTiers')) {
      const rawTiers = updateData.pricingTiers ?? updateData.bulkPricingTiers;
      if (Array.isArray(rawTiers)) {
        const cleanTiers = rawTiers
          .map((tier) => {
            if (!tier || typeof tier !== 'object') return null;
            const minQty = Number(tier.minQty ?? tier.minQuantity ?? tier.tierMin ?? 1);
            const pricePerUnit = Number(tier.pricePerUnit ?? tier.price ?? tier.tierPrice ?? tier.unitPrice ?? 0);
            const maxQty = tier.maxQty !== undefined && tier.maxQty !== null && tier.maxQty !== '' ? Number(tier.maxQty) : undefined;
            if (isNaN(minQty) || minQty < 1 || isNaN(pricePerUnit) || pricePerUnit < 0) {
              return null;
            }
            return {
              minQty,
              ...(maxQty !== undefined && !isNaN(maxQty) && maxQty >= minQty ? { maxQty } : {}),
              pricePerUnit,
            };
          })
          .filter(Boolean);
        set.pricingTiers = cleanTiers;
        set.bulkPricingTiers = cleanTiers;
      }
    }

    if (supplied('gst') || supplied('gstPercent')) {
      const gstVal = updateData.gstPercent ?? updateData.gst;
      if (gstVal !== undefined) {
        set.gst = Number(gstVal);
        set.gstPercent = Number(gstVal);
      }
    }

    if (supplied('hsn') || supplied('hsnCode')) {
      const hsnVal = updateData.hsnCode ?? updateData.hsn;
      if (hsnVal !== undefined) {
        set.hsn = String(hsnVal).trim();
        set.hsnCode = String(hsnVal).trim();
      }
    }

    ['cgst', 'sgst', 'igst', 'priceIncludesTax'].forEach((field) => {
      if (supplied(field)) set[field] = updateData[field];
    });
    if (['hsn', 'hsnCode', 'cgst', 'sgst', 'igst', 'priceIncludesTax'].some(supplied)) {
      const hsnCode = String(updateData.hsnCode ?? updateData.hsn ?? product.hsnCode ?? product.hsn ?? '').trim();
      const cgst = updateData.cgst ?? product.cgst;
      const sgst = updateData.sgst ?? product.sgst;
      const igst = updateData.igst ?? product.igst;
      set.taxConfigured = Boolean(hsnCode || cgst !== null && cgst !== undefined || sgst !== null && sgst !== undefined || igst !== null && igst !== undefined);
    }

    if (supplied('colorVariants')) {
      set.colorVariants = normalizeColorVariants(updateData.colorVariants);
    }

    // Map images and imageUrl without dropping existing images
    if (supplied('images') || supplied('imageUrl')) {
      const allImages = normalizeImageUrls(
        supplied('images') ? updateData.images : product.images,
        supplied('imageUrl') ? updateData.imageUrl : product.imageUrl
      );
      set.images = allImages;
      set.imageUrl = allImages[0] || (updateData.imageUrl ? extractImageUrl(updateData.imageUrl) : '');
    }

    const incomingCatId = updateData.categoryId || (String(updateData.category).match(/^[0-9a-fA-F]{24}$/) ? updateData.category : null);
    const categoryChanged = incomingCatId && String(incomingCatId) !== String(product.categoryId || product.category);

    if (categoryChanged || supplied('subcategoryId') || supplied('subCategory')) {
      const nextCategoryId = incomingCatId || product.categoryId || product.category;
      const nextSubcategoryId = supplied('subcategoryId')
        ? (updateData.subcategoryId || null)
        : supplied('subCategory') ? (updateData.subCategory || null) : product.subcategoryId;

      if (nextCategoryId && String(nextCategoryId).match(/^[0-9a-fA-F]{24}$/)) {
        const category = await this.validateCategorySelection(
          nextCategoryId,
          nextSubcategoryId,
          product.wholesalerId
        );
        set.categoryId = category._id;
        set.category = category._id;
        set.categoryName = category.name;
        set.subcategoryId = nextSubcategoryId || null;
        set.subCategory = nextSubcategoryId || null;
      }
    }

    const previousStock = Number(product.stock || 0);
    const nextStock = set.stock !== undefined ? Number(set.stock) : previousStock;

    // Use findOneAndUpdate with { new: true, runValidators: true } scoped to { _id, wholesalerId }
    const updateScope = user.role === ROLES.WHOLESALER
      ? { _id: product._id, wholesalerId: user._id, isDeleted: false }
      : { _id: product._id, isDeleted: false };

    const updatedProduct = await Product.findOneAndUpdate(
      updateScope,
      { $set: set },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      throw new NotFoundError('Product not found or not authorized to update');
    }

    if (nextStock !== previousStock) {
      const diff = nextStock - previousStock;
      const inventory = await Inventory.findOne({ productId: updatedProduct._id });
      if (inventory) {
        const previousAvailable = inventory.available;
        inventory.available = Math.max(0, inventory.available + diff);
        await inventory.save();

        await InventoryTransaction.create({
          inventoryId: inventory._id,
          productId: updatedProduct._id,
          wholesalerId: updatedProduct.wholesalerId,
          type: diff >= 0 ? INVENTORY_TRANSACTION_TYPE.RECEIVE : INVENTORY_TRANSACTION_TYPE.ADJUSTMENT,
          quantity: Math.abs(diff),
          previousAvailable,
          newAvailable: inventory.available,
          referenceType: 'MANUAL_ADJUSTMENT',
          performedBy: user._id,
          notes: 'Stock updated during product update',
        });
      }
    }

    await AuditService.log({
      actorId: user._id,
      actorRole: user.role,
      action: AUDIT_ACTION.PRODUCT_STATUS_CHANGED,
      entityType: 'Product',
      entityId: updatedProduct._id,
      before: beforeState,
      after: updatedProduct.toJSON(),
      req,
    });

    return updatedProduct;
  }

  /**
   * Delete product
   */
  static async deleteProduct(productId, user, req = null) {
    const product = await Product.findById(productId);
    if (!product || product.isDeleted) {
      throw new NotFoundError('Product not found');
    }

    if (user.role === ROLES.WHOLESALER && String(product.wholesalerId) !== String(user._id)) {
      throw new ForbiddenError('You can only delete your own products');
    }

    product.isDeleted = true;
    product.status = PRODUCT_STATUS.INACTIVE;
    await product.save();

    await AuditService.log({
      actorId: user._id,
      actorRole: user.role,
      action: AUDIT_ACTION.DELETE,
      entityType: 'Product',
      entityId: product._id,
      req,
    });

    return { message: 'Product deleted successfully' };
  }
}

module.exports = ProductService;
