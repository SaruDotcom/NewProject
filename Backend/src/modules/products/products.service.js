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
} = require('../../utils/errors');
const { parsePagination } = require('../../utils/pagination');
const AuditService = require('../../services/audit.service');

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
      if (String(subcategory.parentId) !== String(category._id)) {
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
      products,
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
      products,
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

    return {
      product: {
        ...productDoc,
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
      additionalOptions,
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
      categoryName,
      images: images || (imageUrl ? [imageUrl] : []),
      imageUrl: imageUrl || (images && images.length > 0 ? images[0] : ''),
      mrp: mrp || wholesalePrice || 0,
      costPrice: costPrice || 0,
      wholesalePrice: wholesalePrice || costPrice || 0,
      retailerPrice: retailerPrice || wholesalePrice || 0,
      moq: moq || minOrderQty || 1,
      minOrderQty: minOrderQty || moq || 1,
      pricingTiers: pricingTiers || [],
      stock: parseInt(stock, 10) || 0,
      unit: unit || 'piece',
      gst: gst !== undefined ? gst : 18,
      hsn: hsn || '',
      sizes: sizes || [],
      colors: colors || [],
      additionalOptions: additionalOptions || [],
      categoryAttributes: productData.categoryAttributes || {},
      status: PRODUCT_STATUS.ACTIVE,
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

    // Authorization check: Wholesaler can only update their own products; Super Admin can update any
    if (user.role === ROLES.WHOLESALER && String(product.wholesalerId) !== String(user._id)) {
      throw new ForbiddenError('You can only update your own products');
    }

    const beforeState = product.toJSON();

    if (updateData.categoryId !== undefined || updateData.subcategoryId !== undefined) {
      const nextCategoryId = updateData.categoryId || product.categoryId;
      const nextSubcategoryId = updateData.subcategoryId !== undefined
        ? updateData.subcategoryId
        : product.subcategoryId;
      await this.validateCategorySelection(nextCategoryId, nextSubcategoryId, product.wholesalerId);
    }

    if (updateData.name || updateData.title) {
      const newName = updateData.name || updateData.title;
      product.name = newName;
      product.title = newName;
      product.slug = await this.generateSlug(newName, product._id);
    }

    if (updateData.sku && updateData.sku.toUpperCase() !== product.sku) {
      const cleanSku = updateData.sku.toUpperCase().trim();
      const existing = await Product.findOne({
        wholesalerId: product.wholesalerId,
        sku: cleanSku,
        _id: { $ne: product._id },
        isDeleted: false,
      });
      if (existing) {
        throw new ConflictError(`Product with SKU '${cleanSku}' already exists.`, 'DUPLICATE_SKU');
      }
      product.sku = cleanSku;
    }

    if (updateData.description !== undefined) product.description = updateData.description;
    if (updateData.brand !== undefined) product.brand = updateData.brand;
    if (updateData.wholesalePrice !== undefined) product.wholesalePrice = updateData.wholesalePrice;
    if (updateData.retailerPrice !== undefined) product.retailerPrice = updateData.retailerPrice;
    if (updateData.mrp !== undefined) product.mrp = updateData.mrp;
    if (updateData.costPrice !== undefined) product.costPrice = updateData.costPrice;
    if (updateData.moq !== undefined) {
      product.moq = updateData.moq;
      product.minOrderQty = updateData.moq;
    }
    if (updateData.minOrderQty !== undefined) {
      product.minOrderQty = updateData.minOrderQty;
      product.moq = updateData.minOrderQty;
    }
    if (updateData.unit !== undefined) product.unit = updateData.unit;
    if (updateData.pricingTiers) product.pricingTiers = updateData.pricingTiers;
    if (updateData.images) {
      product.images = updateData.images;
      if (updateData.images.length > 0) product.imageUrl = updateData.images[0];
    }
    if (updateData.imageUrl !== undefined) {
      product.imageUrl = updateData.imageUrl;
      product.images = updateData.imageUrl ? [updateData.imageUrl] : [];
    }
    if (updateData.status) product.status = updateData.status;
    if (updateData.categoryId) product.categoryId = updateData.categoryId;
    if (updateData.subcategoryId !== undefined) product.subcategoryId = updateData.subcategoryId;
    if (updateData.sizes) product.sizes = updateData.sizes;
    if (updateData.colors) product.colors = updateData.colors;
    if (updateData.additionalOptions) product.additionalOptions = updateData.additionalOptions;
    if (updateData.categoryAttributes) product.categoryAttributes = updateData.categoryAttributes;

    // If stock changed directly via product update
    if (updateData.stock !== undefined && updateData.stock !== product.stock) {
      const diff = updateData.stock - product.stock;
      product.stock = updateData.stock;

      const inventory = await Inventory.findOne({ productId: product._id });
      if (inventory) {
        const prev = inventory.available;
        inventory.available = Math.max(0, inventory.available + diff);
        await inventory.save();

        await InventoryTransaction.create({
          inventoryId: inventory._id,
          productId: product._id,
          wholesalerId: product.wholesalerId,
          type: diff >= 0 ? INVENTORY_TRANSACTION_TYPE.RECEIVE : INVENTORY_TRANSACTION_TYPE.ADJUSTMENT,
          quantity: Math.abs(diff),
          previousAvailable: prev,
          newAvailable: inventory.available,
          referenceType: 'MANUAL_ADJUSTMENT',
          performedBy: user._id,
          notes: 'Stock updated during product update',
        });
      }
    }

    await product.save();

    await AuditService.log({
      actorId: user._id,
      actorRole: user.role,
      action: AUDIT_ACTION.PRODUCT_STATUS_CHANGED,
      entityType: 'Product',
      entityId: product._id,
      before: beforeState,
      after: product.toJSON(),
      req,
    });

    return product;
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
