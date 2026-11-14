const {
  User,
  RetailerProfile,
  WholesalerProfile,
  Product,
  Inventory,
  Order,
  Payment,
  Category,
  Notification,
  WalletTransaction,
  Return,
  Cart,
  WholesalerRetailerRelationship,
} = require('../models');
const mongoose = require('mongoose');
const RetailerRepository = require('../repositories/retailer.repository');
const ProductRepository = require('../repositories/product.repository');
const OrderRepository = require('../repositories/order.repository');
const OrderService = require('../modules/orders/orders.service');
const InvitationService = require('../modules/invitations/invitations.service');
const WalletService = require('./wallet.service');
const SupportService = require('../modules/support/support.service');
const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} = require('../utils/errors');
const { parsePagination } = require('../utils/pagination');
const { generateReference } = require('../utils/crypto');
const { assertWholesalerAvailable, WHOLESALER_UNAVAILABLE_MESSAGE } = require('./wholesaler-access.service');
const { ROLES, RELATIONSHIP_STATUS } = require('../config/constants');
const ReferralService = require('../modules/referrals/referrals.service');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const assertObjectId = (value, label = 'ID') => {
  if (!objectIdPattern.test(String(value))) {
    throw new BadRequestError(`${label} must be a valid ObjectId`, 'INVALID_OBJECT_ID');
  }
};

const allowedProductFields = [
  'name',
  'title',
  'slug',
  'sku',
  'brand',
  'description',
  'wholesalerId',
  'categoryId',
  'category',
  'subcategoryId',
  'subCategory',
  'subSubcategoryId',
  'categoryName',
  'images',
  'imageUrl',
  'mrp',
  'wholesalePrice',
  'retailerPrice',
  'basePrice',
  'sellingPrice',
  'moq',
  'minOrderQty',
  'pricingTiers',
  'stock',
  'unit',
  'gst',
  'hsn',
  'weight',
  'dimensions',
  'sizes',
  'colors',
  'colorVariants',
  'additionalOptions',
  'categoryAttributes',
  'status',
  'createdAt',
  'updatedAt',
];

const sanitizeProduct = (product) => {
  if (!product) return product;
  const source = typeof product.toObject === 'function' ? product.toObject() : product;
  const clean = {};
  allowedProductFields.forEach((key) => {
    if (source[key] !== undefined) clean[key] = source[key];
  });
  clean._id = source._id;
  return clean;
};

class RetailerService {
  /**
   * Helper: Get active connected wholesaler for retailer
   */
  static async getActiveWholesalerOrThrow(retailerId) {
    const relationship = await RetailerRepository.findActiveRelationship(retailerId);
    if (!relationship || !relationship.wholesalerId) {
      throw new ForbiddenError(
        'You are not currently connected to any active wholesaler. Please join using an invitation link.',
        'NO_ACTIVE_WHOLESALER'
      );
    }
    await assertWholesalerAvailable(relationship.wholesalerId._id);
    return relationship.wholesalerId;
  }

  /**
   * Get Retailer Dashboard Metrics
   */
  static async getDashboard(retailerId) {
    const relationship = await RetailerRepository.findActiveRelationship(retailerId);
    const profile = await RetailerRepository.findProfileByUserId(retailerId);

    let connectedWholesaler = null;
    let storeMetrics = { totalProducts: 0, categoriesCount: 0 };

    if (relationship && relationship.wholesalerId) {
      const wholesalerUser = relationship.wholesalerId;
      const wholesalerProfile = await RetailerRepository.findWholesalerProfile(wholesalerUser._id);
      const productCount = await Product.countDocuments({
        wholesalerId: wholesalerUser._id,
        status: 'ACTIVE',
        isDeleted: false,
      });
      const categoryIds = (await Product.distinct('categoryId', {
        wholesalerId: wholesalerUser._id,
        status: 'ACTIVE',
        isDeleted: false,
      })).filter(Boolean);

      connectedWholesaler = {
        id: wholesalerUser._id,
        name: wholesalerUser.name,
        businessName: wholesalerProfile?.businessName || wholesalerUser.name,
        businessTagline: wholesalerProfile?.businessTagline || '',
        logo: wholesalerProfile?.businessLogoUrl || '',
        city: wholesalerProfile?.address?.city || '',
        state: wholesalerProfile?.address?.state || '',
        rating: 4.9,
        status: wholesalerUser.status,
        available: wholesalerUser.status !== 'BLOCKED' && wholesalerUser.status !== 'SUSPENDED',
        unavailableMessage: wholesalerUser.status === 'BLOCKED' || wholesalerUser.status === 'SUSPENDED'
          ? WHOLESALER_UNAVAILABLE_MESSAGE
          : '',
      };

      storeMetrics = {
        totalProducts: connectedWholesaler.available ? productCount : 0,
        categoriesCount: connectedWholesaler.available ? categoryIds.length : 0,
      };
    }

    // Orders summary
    const [recentOrders, totalOrders, pendingOrders, completedOrders, cancelledOrders, notifications] = await Promise.all([
      Order.find({ retailerId }).sort({ createdAt: -1 }).limit(5).lean(),
      Order.countDocuments({ retailerId }),
      Order.countDocuments({ retailerId, orderStatus: { $in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] } }),
      Order.countDocuments({ retailerId, orderStatus: 'DELIVERED' }),
      Order.countDocuments({ retailerId, orderStatus: 'CANCELLED' }),
      Notification.find({ recipientId: retailerId }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    // Financial totals
    const totalSpendResult = await Order.aggregate([
      { $match: { retailerId: retailerId, orderStatus: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, totalSpend: { $sum: '$grandTotal' } } },
    ]);

    const cart = await RetailerRepository.findCart(retailerId);
    const wishlist = await RetailerRepository.findWishlist(retailerId);

    return {
      connectedWholesaler,
      storeMetrics,
      stats: {
        totalSpend: totalSpendResult[0]?.totalSpend || profile?.totalPurchaseAmount || 0,
        totalOrders,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        cartItemsCount: cart?.items?.length || 0,
        cartCount: cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
        wishlistItemsCount: wishlist?.products?.length || 0,
        unreadNotifications: notifications.filter((n) => !n.isRead).length,
      },
      recentOrders,
      notifications,
      profile: {
        businessName: profile?.businessName || '',
        city: profile?.address?.city || '',
        state: profile?.address?.state || '',
      },
    };
  }

  /**
   * Profile Operations
   */
  static async getProfile(retailerId) {
    const user = await User.findById(retailerId).populate('retailerProfile');
    if (!user) throw new NotFoundError('Retailer not found');
    return user;
  }

  static async updateProfile(retailerId, payload) {
    const user = await User.findById(retailerId);
    if (!user) throw new NotFoundError('Retailer not found');

    if (payload.name) user.name = payload.name;
    if (payload.phone) {
      const normalizedPhone = String(payload.phone).trim();
      const isValidPhone = /^\+?91?\d{10}$|^\d{10}$/.test(normalizedPhone);
      if (!isValidPhone) {
        throw new BadRequestError('Invalid mobile number format. Please provide a valid 10-digit number.', 'INVALID_PHONE');
      }
      
      if (user.phone !== normalizedPhone) {
        const phoneExists = await User.findOne({ phone: normalizedPhone });
        if (phoneExists) {
          throw new ConflictError('This mobile number is already registered to another account.', 'PHONE_ALREADY_EXISTS');
        }
        user.phone = normalizedPhone;
      }
    }
    await user.save();

    if (payload.avatar !== undefined) user.avatar = payload.avatar;
    await user.save();

    const normalizedAddress = {
      ...(typeof payload.address === 'object' ? payload.address : {}),
      ...(payload.city !== undefined && { city: payload.city }),
      ...(payload.state !== undefined && { state: payload.state }),
      ...(payload.pincode !== undefined && { pincode: payload.pincode }),
    };

    if (
      payload.businessName ||
      payload.address ||
      payload.city ||
      payload.state ||
      payload.pincode ||
      payload.gstin ||
      payload.gstStatus
    ) {
      await RetailerRepository.updateProfile(retailerId, {
        ...(payload.businessName && { businessName: payload.businessName }),
        ...((payload.GSTIN || payload.gstin) && { gstin: payload.GSTIN || payload.gstin }),
        ...(payload.gstStatus && { gstStatus: payload.gstStatus }),
        ...(Object.keys(normalizedAddress).length > 0 && { address: normalizedAddress }),
      });
    }

    return User.findById(retailerId).populate('retailerProfile');
  }

  static async getBusinessProfile(retailerId) {
    const profile = await RetailerRepository.findProfileByUserId(retailerId);
    if (!profile) throw new NotFoundError('Retailer profile not found');
    return profile;
  }

  static async updateBusinessProfile(retailerId, payload) {
    const addressPayload = payload.address && typeof payload.address === 'object' ? payload.address : {};
    let normalizedPhone;
    if (payload.phone) {
      normalizedPhone = String(payload.phone).trim();
      if (!/^(?:\+?91)?[6-9]\d{9}$/.test(normalizedPhone)) {
        throw new BadRequestError('Invalid mobile number format. Please provide a valid 10-digit number.', 'INVALID_PHONE');
      }
      normalizedPhone = normalizedPhone.replace(/^\+?91(?=[6-9]\d{9}$)/, '');
      const existingPhone = await User.findOne({
        _id: { $ne: retailerId },
        $or: [
          { phone: normalizedPhone },
          { phone: `+91${normalizedPhone}` },
          { phone: `91${normalizedPhone}` },
        ],
      }).select('_id').lean();
      if (existingPhone) {
        throw new ConflictError('This mobile number is already registered to another account.', 'PHONE_ALREADY_EXISTS');
      }
    }
    const profile = await RetailerRepository.updateProfile(retailerId, {
      ...(payload.businessName !== undefined && { businessName: payload.businessName }),
      ...(payload.ownerName !== undefined && { ownerName: payload.ownerName }),
      ...(payload.category !== undefined && { category: payload.category }),
      ...(payload.businessType !== undefined && { businessType: payload.businessType }),
      ...(payload.gstin !== undefined && { gstin: payload.gstin || undefined }),
      ...(payload.gstNumber !== undefined && { gstin: payload.gstNumber || undefined }),
      ...(payload.gstStatus !== undefined && { gstStatus: payload.gstStatus }),
      address: {
        street: payload.street || payload.addressLine1 || addressPayload.street || addressPayload.addressLine1 || payload.address || '',
        city: payload.city || addressPayload.city || '',
        state: payload.state || addressPayload.state || '',
        pincode: payload.pincode || payload.postalCode || addressPayload.pincode || addressPayload.postalCode || '',
        country: payload.country || addressPayload.country || 'India',
      },
      profileComplete: Boolean(
        payload.businessName &&
        payload.ownerName &&
        (payload.address || payload.street || payload.addressLine1 || addressPayload.street || addressPayload.addressLine1) &&
        (payload.city || addressPayload.city) &&
        (payload.state || addressPayload.state) &&
        (payload.pincode || payload.postalCode || addressPayload.pincode || addressPayload.postalCode)
      ),
    });
    if (payload.ownerName || normalizedPhone) {
      await User.findByIdAndUpdate(retailerId, {
        ...(payload.ownerName && { name: payload.ownerName }),
        ...(normalizedPhone && { phone: normalizedPhone }),
      });
    }
    return profile;
  }

  /**
   * Storefront & Connected Wholesaler
   */
  static async getConnectedWholesaler(retailerId) {
    const relationship = await RetailerRepository.findActiveRelationship(retailerId);
    if (!relationship || !relationship.wholesalerId) {
      return null;
    }

    const wholesalerUser = relationship.wholesalerId;
    const profile = await RetailerRepository.findWholesalerProfile(wholesalerUser._id);
    const { normalizeBusinessType, getPresetsForType } = require('../config/businessTypeBanners');
    const businessCategory = normalizeBusinessType(profile?.businessCategory || profile?.khataBook?.businessType);
    let banners = profile?.promotionalBanners;
    if (!banners || !Array.isArray(banners)) {
      banners = getPresetsForType(businessCategory).map((p, idx) => ({ ...p, isActive: idx < 2 }));
    }
    const activeBanners = (banners || [])
      .filter((b) => b.isActive !== false && b.active !== false)
      .map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle || '',
        tag: b.badgeText || b.tag || '',
        badgeText: b.badgeText || b.tag || '',
        ctaText: b.buttonText || b.ctaText || 'Shop Trade Deals',
        buttonText: b.buttonText || b.ctaText || 'Shop Trade Deals',
        imageUrl: b.imageUrl || '',
        category: b.targetCategory || b.category || '',
        targetCategory: b.targetCategory || b.category || '',
        discountBadge: b.discountBadge || '',
        gradient: b.gradient || '',
        active: true,
        isActive: true,
      }));

    return {
      id: wholesalerUser._id,
      name: wholesalerUser.name,
      email: wholesalerUser.email,
      phone: wholesalerUser.phone,
      businessName: profile?.businessName || '',
      businessTagline: profile?.businessTagline || '',
      businessLogoUrl: profile?.businessLogoUrl || '',
      description: profile?.description || '',
      businessCategory,
      activeStoreTheme: profile?.activeStoreTheme || 'DEFAULT',
      banners: activeBanners,
      address: profile?.address || {},
      minOrderValue: profile?.minOrderValue || 0,
      relationshipStatus: relationship.status,
      joinedAt: relationship.joinedAt,
      status: wholesalerUser.status,
      available: wholesalerUser.status !== 'BLOCKED' && wholesalerUser.status !== 'SUSPENDED',
      unavailableMessage: wholesalerUser.status === 'BLOCKED' || wholesalerUser.status === 'SUSPENDED'
        ? WHOLESALER_UNAVAILABLE_MESSAGE
        : '',
    };
  }

  static async getStore(retailerId) {
    const wholesalerUser = await this.getActiveWholesalerOrThrow(retailerId);
    const profile = await RetailerRepository.findWholesalerProfile(wholesalerUser._id);
    const { normalizeBusinessType, getPresetsForType } = require('../config/businessTypeBanners');
    const businessCategory = normalizeBusinessType(profile?.businessCategory || profile?.khataBook?.businessType);
    let banners = profile?.promotionalBanners;
    if (!banners || !Array.isArray(banners)) {
      banners = getPresetsForType(businessCategory).map((p, idx) => ({ ...p, isActive: idx < 2 }));
    }
    const activeBanners = (banners || [])
      .filter((b) => b.isActive !== false && b.active !== false)
      .map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle || '',
        tag: b.badgeText || b.tag || '',
        badgeText: b.badgeText || b.tag || '',
        ctaText: b.buttonText || b.ctaText || 'Shop Trade Deals',
        buttonText: b.buttonText || b.ctaText || 'Shop Trade Deals',
        imageUrl: b.imageUrl || '',
        category: b.targetCategory || b.category || '',
        targetCategory: b.targetCategory || b.category || '',
        discountBadge: b.discountBadge || '',
        gradient: b.gradient || '',
        active: true,
        isActive: true,
      }));

    const [productsCount, categories] = await Promise.all([
      Product.countDocuments({
        wholesalerId: wholesalerUser._id,
        status: 'ACTIVE',
        isDeleted: false,
        isDemo: { $ne: true },
      }),
      this.getCategories(retailerId, {}),
    ]);

    return {
      wholesaler: {
        id: wholesalerUser._id,
        name: wholesalerUser.name,
        businessName: profile?.businessName || '',
        businessTagline: profile?.businessTagline || '',
        businessLogoUrl: profile?.businessLogoUrl || '',
        description: profile?.description || '',
        businessCategory,
        activeStoreTheme: profile?.activeStoreTheme || 'DEFAULT',
        banners: activeBanners,
        address: profile?.address || {},
        minOrderValue: profile?.minOrderValue || 0,
      },
      productsCount,
      categories,
    };
  }

  /**
   * Catalog: Categories & Products
   */
  static async getCategories(retailerId, query = {}) {
    const wholesalerUser = await this.getActiveWholesalerOrThrow(retailerId);
    const filter = {
      wholesalerId: { $in: [wholesalerUser._id, null] },
      isActive: true,
      isDeleted: false,
      isDemo: { $ne: true },
    };

    if (query.search) {
      const search = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: search }, { slug: search }, { description: search }];
    }

    const { page, limit, skip, sort } = parsePagination(query);
    const hierarchyFilter = { ...filter };
    delete hierarchyFilter.$or;
    const [categories, allCategories, total] = await Promise.all([
      Category.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Category.find(hierarchyFilter).select('_id name slug parentId parentCategoryId level').lean(),
      Category.countDocuments(filter),
    ]);

    const categoryById = new Map(allCategories.map((category) => [String(category._id), category]));
    const decoratedCategories = categories.map((category) => {
      const path = [];
      const visited = new Set();
      let current = category;
      while (current && !visited.has(String(current._id))) {
        visited.add(String(current._id));
        path.unshift({ id: String(current._id), name: current.name, slug: current.slug });
        const parentId = current.parentId || current.parentCategoryId;
        current = parentId ? categoryById.get(String(parentId)) : null;
      }
      return {
        ...category,
        path,
        displayPath: path.map(({ name }) => name).join(' > '),
      };
    });

    return { categories: decoratedCategories, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async getProducts(retailerId, query = {}) {
    const wholesalerUser = await this.getActiveWholesalerOrThrow(retailerId);
    const { page, limit, skip, sort } = parsePagination(query);
    const activeCategories = await Category.find({
      wholesalerId: { $in: [wholesalerUser._id, null] },
      isActive: true,
      isDeleted: false,
      isDemo: { $ne: true },
    }).select('_id parentId parentCategoryId').lean();

    const filter = {
      wholesalerId: wholesalerUser._id,
      status: 'ACTIVE',
      isDeleted: false,
      isDemo: { $ne: true },
      categoryId: { $in: activeCategories.map(({ _id }) => _id) },
      subcategoryId: { $in: [null, ...activeCategories.map(({ _id }) => _id)] },
      subSubcategoryId: { $in: [null, ...activeCategories.map(({ _id }) => _id)] },
    };
    const filterConditions = [];

    if (query.category && query.category !== 'All') {
      const categoryFilter = objectIdPattern.test(String(query.category))
        ? { _id: query.category }
        : { $or: [{ name: new RegExp(escapeRegex(query.category), 'i') }, { slug: query.category }] };
      const category = await Category.findOne({
        ...categoryFilter,
        wholesalerId: { $in: [wholesalerUser._id, null] },
        isActive: true,
        isDeleted: false,
        isDemo: { $ne: true },
      }).select('_id parentId parentCategoryId').lean();
      if (!category) {
        return { products: [], meta: { page, limit, total: 0, totalPages: 0 } };
      }
      const categoryIds = new Set([String(category._id)]);
      let frontier = [String(category._id)];
      while (frontier.length) {
        const descendants = activeCategories
          .filter(({ parentId, parentCategoryId }) => frontier.includes(String(parentId || parentCategoryId || '')))
          .map(({ _id }) => String(_id))
          .filter((id) => !categoryIds.has(id));
        descendants.forEach((id) => categoryIds.add(id));
        frontier = descendants;
      }
      const ids = [...categoryIds];
      filterConditions.push({
        $or: [
          { categoryId: { $in: ids } },
          { category: { $in: ids } },
          { subcategoryId: { $in: ids } },
          { subCategory: { $in: ids } },
          { subSubcategoryId: { $in: ids } },
        ],
      });
    }

    if (query.subcategory) {
      const subcategory = await Category.findOne({
        _id: query.subcategory,
        wholesalerId: { $in: [wholesalerUser._id, null] },
        isActive: true,
        isDeleted: false,
        isDemo: { $ne: true },
      }).select('_id parentId parentCategoryId').lean();
      if (!subcategory) {
        return { products: [], meta: { page, limit, total: 0, totalPages: 0 } };
      }
      filterConditions.push({
        $or: [
          { subcategoryId: subcategory._id },
          { subCategory: subcategory._id },
          { subSubcategoryId: subcategory._id },
        ],
      });
    }

    if (query.brand) {
      filter.brand = new RegExp(escapeRegex(query.brand), 'i');
    }

    if (query.minPrice || query.maxPrice) {
      filter.wholesalePrice = {};
      if (query.minPrice) filter.wholesalePrice.$gte = Number(query.minPrice);
      if (query.maxPrice) filter.wholesalePrice.$lte = Number(query.maxPrice);
    }

    if (query.availability) {
      if (query.availability === 'in_stock') filter.stock = { $gt: 0 };
      if (query.availability === 'out_of_stock') filter.stock = { $lte: 0 };
    }

    if (query.search) {
      const search = new RegExp(escapeRegex(query.search), 'i');
      filterConditions.push({ $or: [
        { name: search },
        { title: search },
        { sku: search },
        { brand: search },
      ] });
    }
    if (filterConditions.length) filter.$and = filterConditions;

    const { products, total } = await ProductRepository.findByWholesaler(
      wholesalerUser._id,
      filter,
      sort,
      skip,
      limit
    );

    return {
      products: products.map(sanitizeProduct),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getProductById(retailerId, productId) {
    assertObjectId(productId, 'Product ID');
    const wholesalerUser = await this.getActiveWholesalerOrThrow(retailerId);
    const product = await Product.findOne({
      _id: productId,
      wholesalerId: wholesalerUser._id,
      isDeleted: false,
    }).populate('categoryId subcategoryId subSubcategoryId');

    if (!product) {
      throw new NotFoundError('Product not found in connected wholesaler catalog');
    }

    const inventory = await ProductRepository.findInventory(product._id);

    return { product: sanitizeProduct(product), inventory };
  }

  /**
   * Cart Operations
   */
  static async getCart(retailerId) {
    const cart = await RetailerRepository.getOrCreateCart(retailerId);
    return cart;
  }

  static async addToCart(retailerId, { productId, quantity, color = '' }) {
    assertObjectId(productId, 'Product ID');
    const wholesalerUser = await this.getActiveWholesalerOrThrow(retailerId);
    const qty = parseInt(quantity, 10);

    if (isNaN(qty) || qty < 1) {
      throw new BadRequestError('Quantity must be at least 1');
    }

    const product = await Product.findOne({
      _id: productId,
      wholesalerId: wholesalerUser._id,
      status: 'ACTIVE',
      isDeleted: false,
    });

    if (!product) {
      throw new NotFoundError('Product not found or unavailable in your connected wholesaler store');
    }

    const moq = product.moq || product.minOrderQty || 1;
    const inventory = await Inventory.findOne({ productId: product._id, wholesalerId: wholesalerUser._id });
    const available = inventory ? inventory.available : product.stock;

    if (qty < moq) {
      throw new BadRequestError(`Minimum order quantity for '${product.name}' is ${moq} units. Requested: ${qty}.`, 'MOQ_NOT_MET');
    }

    if (available < qty) {
      throw new BadRequestError(
        `Insufficient stock available for '${product.name}'. Available: ${available || 0}, Requested: ${qty}`,
        'INSUFFICIENT_STOCK'
      );
    }

    // Check tier pricing
    let pricePerUnit = product.wholesalePrice || product.sellingPrice || 0;
    if (product.pricingTiers && product.pricingTiers.length > 0) {
      for (const tier of product.pricingTiers) {
        if (qty >= tier.minQty && (!tier.maxQty || qty <= tier.maxQty)) {
          pricePerUnit = tier.pricePerUnit;
          break;
        }
      }
    }

    const gstRate = product.gst !== undefined ? product.gst : 18;
    const subtotal = pricePerUnit * qty;
    const gstAmount = Math.round((subtotal * (gstRate / 100)) * 100) / 100;
    const total = subtotal + gstAmount;

    const cart = await RetailerRepository.getOrCreateCart(retailerId, wholesalerUser._id);
    cart.wholesalerId = wholesalerUser._id;

    const selectedVariant = Array.isArray(product.colorVariants)
      ? product.colorVariants.find((v) => v.color?.toLowerCase() === String(color).toLowerCase())
      : null;
    const itemSku = selectedVariant?.sku || product.sku;
    const itemImageUrl = (selectedVariant?.images && (typeof selectedVariant.images[0] === 'string' ? selectedVariant.images[0] : selectedVariant.images[0]?.url))
      || product.imageUrl
      || (product.images && (typeof product.images[0] === 'string' ? product.images[0] : product.images[0]?.url))
      || '';

    const existingIndex = cart.items.findIndex(
      (item) => String(item.productId) === String(productId) && String(item.color || '') === String(color || '')
    );

    if (existingIndex > -1) {
      const newQty = cart.items[existingIndex].quantity + qty;
      if (available < newQty) {
        throw new BadRequestError(
          `Insufficient stock available for '${product.name}'. Available: ${available || 0}, Requested: ${newQty}`,
          'INSUFFICIENT_STOCK'
        );
      }
      cart.items[existingIndex].quantity = newQty;
      cart.items[existingIndex].pricePerUnit = pricePerUnit;
      cart.items[existingIndex].subtotal = pricePerUnit * newQty;
      cart.items[existingIndex].gstAmount = Math.round(((pricePerUnit * newQty) * (gstRate / 100)) * 100) / 100;
      cart.items[existingIndex].total = cart.items[existingIndex].subtotal + cart.items[existingIndex].gstAmount;
    } else {
      cart.items.push({
        productId: product._id,
        name: product.name || product.title,
        sku: itemSku,
        color: color || '',
        imageUrl: itemImageUrl,
        quantity: qty,
        pricePerUnit,
        subtotal,
        gstRate,
        gstAmount,
        total,
      });
    }

    // Recalculate cart totals
    cart.subtotal = cart.items.reduce((acc, item) => acc + item.subtotal, 0);
    cart.tax = cart.items.reduce((acc, item) => acc + item.gstAmount, 0);
    cart.grandTotal = cart.subtotal + cart.tax;

    await RetailerRepository.saveCart(cart);
    return cart;
  }

  static async updateCartItem(retailerId, itemId, quantity) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      throw new BadRequestError('Quantity must be at least 1');
    }

    const cart = await RetailerRepository.getOrCreateCart(retailerId);
    let item = cart.items.id(itemId);
    if (!item) {
      item = cart.items.find((i) => String(i.productId) === String(itemId) || String(i._id) === String(itemId));
    }
    if (!item) {
      throw new NotFoundError('Cart item not found');
    }

    const product = await Product.findById(item.productId);
    if (product) {
      const wholesalerUser = await this.getActiveWholesalerOrThrow(retailerId);
      if (String(product.wholesalerId) !== String(wholesalerUser._id)) {
        throw new ForbiddenError('Cart item does not belong to your connected wholesaler', 'WHOLESALER_MISMATCH');
      }
      const moq = product.moq || product.minOrderQty || 1;
      if (qty < moq) {
        throw new BadRequestError(`Minimum order quantity is ${moq} units.`, 'MOQ_NOT_MET');
      }
      const inventory = await Inventory.findOne({ productId: product._id, wholesalerId: wholesalerUser._id });
      const available = inventory ? inventory.available : product.stock;
      if (available < qty) {
        throw new BadRequestError(
          `Insufficient stock available for '${product.name}'. Available: ${available || 0}, Requested: ${qty}`,
          'INSUFFICIENT_STOCK'
        );
      }

      let pricePerUnit = product.wholesalePrice || product.sellingPrice || 0;
      if (product.pricingTiers && product.pricingTiers.length > 0) {
        for (const tier of product.pricingTiers) {
          if (qty >= tier.minQty && (!tier.maxQty || qty <= tier.maxQty)) {
            pricePerUnit = tier.pricePerUnit;
            break;
          }
        }
      }
      item.pricePerUnit = pricePerUnit;
    }

    item.quantity = qty;
    item.subtotal = item.pricePerUnit * qty;
    const gstRate = item.gstRate || 0;
    item.gstAmount = Math.round((item.subtotal * (gstRate / 100)) * 100) / 100;
    item.total = item.subtotal + item.gstAmount;

    cart.subtotal = cart.items.reduce((acc, i) => acc + (i.subtotal || 0), 0);
    cart.tax = cart.items.reduce((acc, i) => acc + (i.gstAmount || 0), 0);
    cart.grandTotal = cart.subtotal + cart.tax;

    await RetailerRepository.saveCart(cart);
    return cart;
  }

  static async removeCartItem(retailerId, itemId) {
    const cart = await RetailerRepository.getOrCreateCart(retailerId);
    let item = cart.items.id(itemId);
    if (item) {
      cart.items.pull({ _id: item._id });
    } else {
      const idx = cart.items.findIndex((i) => String(i.productId) === String(itemId) || String(i._id) === String(itemId));
      if (idx !== -1) {
        cart.items.splice(idx, 1);
      }
    }

    cart.subtotal = cart.items.reduce((acc, i) => acc + (i.subtotal || 0), 0);
    cart.tax = cart.items.reduce((acc, i) => acc + (i.gstAmount || 0), 0);
    cart.grandTotal = cart.subtotal + cart.tax;

    await RetailerRepository.saveCart(cart);
    return cart;
  }

  static async clearCart(retailerId) {
    return RetailerRepository.clearCart(retailerId);
  }

  /**
   * Authoritative Checkout
   */
  static async checkout(retailerUser, checkoutPayload, req = null, quoteOnly = false) {
    const retailerId = retailerUser._id;
    let items = checkoutPayload.items;

    // If no items provided in payload, pull items directly from active Cart
    if (!items || items.length === 0) {
      const cart = await RetailerRepository.findCart(retailerId);
      if (!cart || !cart.items || cart.items.length === 0) {
        throw new BadRequestError('Cart is empty. Add products before checkout.', 'EMPTY_CART');
      }
      items = cart.items.map((i) => ({
        productId: i.productId._id || i.productId,
        quantity: i.quantity,
      }));
    }

    const wholesalerUser = await this.getActiveWholesalerOrThrow(retailerId);
    if (
      checkoutPayload.wholesalerId &&
      String(checkoutPayload.wholesalerId) !== String(wholesalerUser._id)
    ) {
      throw new ForbiddenError(
        'You can only purchase products from your connected wholesaler.',
        'WHOLESALER_MISMATCH'
      );
    }
    const cartProductIds = items.map((item) => item.productId || item.id);
    const validProductsCount = await Product.countDocuments({
      _id: { $in: cartProductIds },
      wholesalerId: wholesalerUser._id,
      status: 'ACTIVE',
      isDeleted: false,
    });
    if (validProductsCount !== cartProductIds.length) {
      throw new BadRequestError(
        'One or more checkout items are unavailable or outside your connected wholesaler catalog',
        'INVALID_CART_ITEMS'
      );
    }

    const normalizedPayload = {
      wholesalerId: String(wholesalerUser._id),
      items,
      shippingAddress: checkoutPayload.shippingAddress,
      billingAddress: checkoutPayload.billingAddress,
      couponCode: checkoutPayload.couponCode,
      expectedQuoteHash: checkoutPayload.expectedQuoteHash,
    };
    // Call unified OrderService for authoritative pricing, stock reservation, order & payment creation
    const result = await OrderService.createOrder(
      retailerUser,
      {
        ...normalizedPayload,
        paymentMethod: checkoutPayload.paymentMethod,
        idempotencyKey: checkoutPayload.idempotencyKey,
      },
      req,
      quoteOnly
    );

    // Clear cart after checkout
    if (!quoteOnly) await RetailerRepository.clearCart(retailerId);

    return result;
  }

  /**
   * Order Operations
   */
  static async getOrders(retailerId, query = {}) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};
    if (query.status) filter.orderStatus = query.status;
    if (query.dateFrom || query.dateTo || query.from || query.to) {
      filter.createdAt = {};
      if (query.dateFrom || query.from) filter.createdAt.$gte = new Date(query.dateFrom || query.from);
      if (query.dateTo || query.to) filter.createdAt.$lte = new Date(query.dateTo || query.to);
    }
    if (query.search) {
      filter.orderNumber = new RegExp(escapeRegex(query.search), 'i');
    }

    const { orders, total } = await OrderRepository.findByRetailer(retailerId, filter, sort, skip, limit);

    return {
      orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getOrderById(retailerId, orderId) {
    assertObjectId(orderId, 'Order ID');
    const order = await OrderRepository.findById(orderId, retailerId);
    if (!order) {
      throw new NotFoundError('Order not found or does not belong to you');
    }
    const payment = await Payment.findOne({ orderId: order._id });
    return { order, payment };
  }

  static async cancelOrder(retailerId, orderId, reason, note, user, req = null) {
    assertObjectId(orderId, 'Order ID');
    const order = await OrderRepository.findById(orderId, retailerId);
    if (!order) {
      throw new NotFoundError('Order not found or does not belong to you');
    }

    if (order.orderStatus !== 'PENDING' && order.orderStatus !== 'CONFIRMED') {
      throw new BadRequestError(`Cannot cancel order with status '${order.orderStatus}'. Only PENDING or CONFIRMED orders can be cancelled.`, 'CANCEL_NOT_ALLOWED');
    }

    return OrderService.updateOrderStatus(
      order._id,
      { status: 'CANCELLED', note: [reason, note].filter(Boolean).join(' - '), cancellationReason: reason, cancellationNote: note },
      user,
      req
    );
  }

  /**
   * Address Book
   */
  static async getAddresses(retailerId) {
    return RetailerRepository.findAddresses(retailerId);
  }

  static async createAddress(retailerId, addressData) {
    return RetailerRepository.createAddress({ ...addressData, userId: retailerId });
  }

  static async updateAddress(retailerId, addressId, addressData) {
    assertObjectId(addressId, 'Address ID');
    const updated = await RetailerRepository.updateAddress(addressId, retailerId, addressData);
    if (!updated) throw new NotFoundError('Address not found');
    return updated;
  }

  static async deleteAddress(retailerId, addressId) {
    assertObjectId(addressId, 'Address ID');
    const deleted = await RetailerRepository.deleteAddress(addressId, retailerId);
    if (!deleted) throw new NotFoundError('Address not found');
    return { message: 'Address deleted successfully' };
  }

  static async setDefaultAddress(retailerId, addressId) {
    assertObjectId(addressId, 'Address ID');
    const updated = await RetailerRepository.setDefaultAddress(addressId, retailerId);
    if (!updated) throw new NotFoundError('Address not found');
    return updated;
  }

  /**
   * Wishlist
   */
  static async getWishlist(retailerId) {
    const wishlist = await RetailerRepository.findWishlist(retailerId);
    return wishlist.products;
  }

  static async addToWishlist(retailerId, productId) {
    assertObjectId(productId, 'Product ID');
    const wholesalerUser = await this.getActiveWholesalerOrThrow(retailerId);
    const product = await Product.findOne({
      _id: productId,
      wholesalerId: wholesalerUser._id,
      status: 'ACTIVE',
      isDeleted: false,
    });
    if (!product) {
      throw new NotFoundError('Product not found in connected wholesaler catalog');
    }
    const wishlist = await RetailerRepository.addToWishlist(retailerId, productId);
    return wishlist.products;
  }

  static async removeFromWishlist(retailerId, productId) {
    assertObjectId(productId, 'Product ID');
    const wishlist = await RetailerRepository.removeFromWishlist(retailerId, productId);
    return wishlist.products;
  }

  /**
   * Returns
   */
  static async getReturns(retailerId, query = {}) {
    return RetailerRepository.findReturns(retailerId, query);
  }

  static async createReturn(retailerId, returnData) {
    const { orderId, items, reason, note, images } = returnData;
    assertObjectId(orderId, 'Order ID');
    const order = await Order.findOne({ _id: orderId, retailerId });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.orderStatus !== 'DELIVERED') {
      throw new BadRequestError('Returns can only be requested for delivered orders');
    }

    const returnNumber = generateReference('RET');
    let totalRefundAmount = 0;

    const existingReturn = await Return.findOne({
      orderId,
      retailerId,
      status: { $nin: ['CANCELLED', 'REJECTED'] },
      'items.productId': { $in: items.map((item) => item.productId) },
    });
    if (existingReturn) {
      throw new ConflictError('A return request already exists for one or more selected items', 'DUPLICATE_RETURN');
    }

    const returnItems = items.map((i) => {
      const orderItem = order.items.find((oi) => String(oi.productId) === String(i.productId));
      if (!orderItem) {
        throw new BadRequestError('Return item does not belong to this order', 'INVALID_RETURN_ITEM');
      }
      if (i.quantity > orderItem.quantity) {
        throw new BadRequestError('Return quantity cannot exceed purchased quantity', 'INVALID_RETURN_QUANTITY');
      }
      const price = orderItem?.pricePerUnit || 0;
      totalRefundAmount += price * i.quantity;
      return {
        productId: i.productId,
        name: orderItem?.name || 'Product',
        sku: orderItem?.sku || '',
        quantity: i.quantity,
        reason: i.reason || reason,
        pricePerUnit: price,
      };
    });

    const returnDoc = await RetailerRepository.createReturn({
      returnNumber,
      orderId: order._id,
      retailerId,
      wholesalerId: order.wholesalerId,
      items: returnItems,
      totalRefundAmount,
      reason,
      retailerNote: note || '',
      images: images || [],
      status: 'REQUESTED',
    });

    return returnDoc;
  }

  static async getReturnById(retailerId, returnId) {
    assertObjectId(returnId, 'Return ID');
    const returnDoc = await RetailerRepository.findReturnById(returnId, retailerId);
    if (!returnDoc) throw new NotFoundError('Return request not found');
    return returnDoc;
  }

  static async cancelReturn(retailerId, returnId) {
    assertObjectId(returnId, 'Return ID');
    const returnDoc = await RetailerRepository.findReturnById(returnId, retailerId);
    if (!returnDoc) throw new NotFoundError('Return request not found');
    if (returnDoc.status !== 'REQUESTED') {
      throw new BadRequestError('Only pending return requests can be cancelled');
    }
    returnDoc.status = 'CANCELLED';
    await returnDoc.save();
    return returnDoc;
  }

  /**
   * Support Tickets
   */
  static async getSupportTickets(retailerId) {
    return RetailerRepository.findSupportTickets(retailerId);
  }

  static async createSupportTicket(retailerUser, ticketData) {
    const typeByCategory = {
      ORDER_ISSUE: 'Order',
      ORDER: 'Order',
      PAYMENT_ISSUE: 'Payment',
      PAYMENT: 'Payment',
      PRODUCT_DEFECT: 'Product',
      PRODUCT: 'Product',
      DELIVERY_DELAY: 'Order',
      DELIVERY: 'Order',
      RETURN: 'Order',
      ACCOUNT_HELP: 'Account',
      GENERAL: 'Other',
      OTHER: 'Other',
    };
    const priority = ({ LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'High' })[ticketData.priority] || 'Medium';
    return SupportService.createTicket(retailerUser, {
      type: typeByCategory[ticketData.category] || 'Other',
      subject: ticketData.subject,
      message: ticketData.message,
      priority,
      relatedOrderId: ticketData.orderId || null,
      attachments: (ticketData.attachments || []).map((url) => ({ url, publicId: '' })),
    });
  }

  static async getSupportTicketById(retailerId, ticketId) {
    assertObjectId(ticketId, 'Ticket ID');
    const ticket = await RetailerRepository.findSupportTicketById(ticketId, retailerId);
    if (!ticket) throw new NotFoundError('Support ticket not found');
    return ticket;
  }

  static async sendSupportMessage(retailerUser, ticketId, messageData) {
    return SupportService.replyAsOwner(retailerUser, ticketId, messageData.message, messageData.attachments || []);
  }

  /**
   * Retailer Financials (Payments, Wallet, Analytics)
   */
  static async getPayments(retailerId, query = {}) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = { retailerId };

    const [payments, total] = await Promise.all([
      Payment.find(filter).populate('orderId').sort(sort).skip(skip).limit(limit).lean(),
      Payment.countDocuments(filter),
    ]);

    return { payments, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async getWallet(retailerId) {
    return WalletService.getOrCreateWallet(retailerId, 'RETAILER');
  }

  static async getWalletTransactions(retailerId, query = {}) {
    const { page, limit, skip, sort } = parsePagination(query);
    const [transactions, total] = await Promise.all([
      WalletTransaction.find({ ownerId: retailerId }).sort(sort).skip(skip).limit(limit).lean(),
      WalletTransaction.countDocuments({ ownerId: retailerId }),
    ]);

    return { transactions, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async getTransactions(retailerId, query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { retailerId, isReport: true };
    if (query.status && query.status !== 'all') {
      const status = String(query.status).toUpperCase();
      const paymentStatuses = {
        PENDING: ['PENDING', 'PROCESSING'],
        VERIFIED: ['PAID'],
        FAILED: ['REJECTED', 'FAILED'],
      }[status];
      if (!paymentStatuses) throw new BadRequestError('Choose Pending, Verified, or Failed transaction status.', 'INVALID_TRANSACTION_STATUS');
      filter.status = { $in: paymentStatuses };
    }
    if (query.startDate) {
      const startDate = new Date(query.startDate);
      if (Number.isNaN(startDate.getTime())) throw new BadRequestError('Enter a valid transaction start date.', 'INVALID_START_DATE');
      startDate.setHours(0, 0, 0, 0);
      filter.createdAt = { ...filter.createdAt, $gte: startDate };
    }
    if (query.endDate) {
      const endDate = new Date(query.endDate);
      if (Number.isNaN(endDate.getTime())) throw new BadRequestError('Enter a valid transaction end date.', 'INVALID_END_DATE');
      endDate.setHours(23, 59, 59, 999);
      filter.createdAt = { ...filter.createdAt, $lte: endDate };
    }

    const [reports, total, paidReports, outstandingOrders] = await Promise.all([
      Payment.find(filter)
        .populate('orderId', 'orderNumber grandTotal discount isCreditOrder paymentMethod directPaidPaise creditPaidAmount')
        .populate('orderAllocations.orderId', 'orderNumber grandTotal discount isCreditOrder paymentMethod directPaidPaise creditPaidAmount')
        .populate('wholesalerId', 'name businessName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(filter),
      Payment.aggregate([
        { $match: { retailerId, isReport: true, status: 'PAID' } },
        {
          $group: {
            _id: null,
            totalPaise: {
              $sum: {
                $ifNull: ['$amountPaise', { $round: [{ $multiply: ['$amount', 100] }, 0] }],
              },
            },
          },
        },
      ]),
      Order.find({
        retailerId,
        orderStatus: { $nin: ['CANCELLED', 'RETURNED', 'REFUNDED'] },
      }).select('grandTotal isCreditOrder directPaidPaise creditPaidAmount').lean(),
    ]);

    const orderIds = reports.flatMap((report) => [
      report.orderId?._id || report.orderId,
      ...(report.orderAllocations || []).map((allocation) => allocation.orderId?._id || allocation.orderId),
    ]).filter(Boolean);
    const paidByOrder = orderIds.length
      ? await Payment.aggregate([
          {
            $match: {
              retailerId,
              orderId: { $in: orderIds },
              isReport: true,
              isCreditRepayment: { $ne: true },
              status: 'PAID',
            },
          },
          {
            $group: {
              _id: '$orderId',
              paidPaise: {
                $sum: {
                  $ifNull: ['$amountPaise', { $round: [{ $multiply: ['$amount', 100] }, 0] }],
                },
              },
            },
          },
        ])
      : [];
    const paidByOrderId = new Map(paidByOrder.map((item) => [String(item._id), item.paidPaise]));
    const wholesalerIds = [...new Set(reports.map((report) => String(report.wholesalerId?._id || report.wholesalerId)).filter(Boolean))];
    const wholesalerProfiles = wholesalerIds.length
      ? await WholesalerProfile.find({ userId: { $in: wholesalerIds } }).select('userId businessName').lean()
      : [];
    const businessNames = new Map(wholesalerProfiles.map((profile) => [String(profile.userId), profile.businessName]));

    const transactions = reports.flatMap((report) => {
      const allocations = report.orderAllocations?.length
        ? report.orderAllocations
        : [{ orderId: report.orderId, amountPaise: report.amountPaise || Math.round(Number(report.amount || 0) * 100) }];
      return allocations.map((allocation) => {
        const order = allocation.orderId && typeof allocation.orderId === 'object'
          ? allocation.orderId
          : report.orderId;
        const totalPaise = Math.round(Number(order?.grandTotal || 0) * 100);
        const paidPaise = order?.isCreditOrder
          ? Math.round(Number(order.creditPaidAmount || 0) * 100)
          : Number.isSafeInteger(order?.directPaidPaise)
            ? order.directPaidPaise
            : paidByOrderId.get(String(order?._id || order)) || 0;
        const status = report.status === 'PAID'
          ? 'VERIFIED'
          : ['REJECTED', 'FAILED'].includes(report.status) ? 'FAILED' : 'PENDING';
        const wholesalerId = String(report.wholesalerId?._id || report.wholesalerId || '');

        return {
          transactionId: String(report._id),
          orderId: order?.orderNumber || String(order?._id || order || ''),
          wholesalerName: businessNames.get(wholesalerId) || report.wholesalerId?.businessName || report.wholesalerId?.name || 'Wholesaler',
          transactionDate: report.paidAt || report.createdAt,
          paymentMethod: report.isCreditRepayment || order?.isCreditOrder ? 'Credit' : 'Direct UPI',
          totalOrderAmount: totalPaise / 100,
          couponDiscount: Number(order?.discount || 0),
          amountPaid: Number.isSafeInteger(allocation.amountPaise)
            ? allocation.amountPaise / 100
            : Number(report.amount || 0),
          remainingDueAmount: Math.max(0, totalPaise - paidPaise) / 100,
          status,
        };
      });
    });

    const allOrderIds = outstandingOrders
      .filter((order) => !order.isCreditOrder && !Number.isSafeInteger(order.directPaidPaise))
      .map((order) => order._id);
    const allDirectPayments = allOrderIds.length
      ? await Payment.aggregate([
          {
            $match: {
              retailerId,
              orderId: { $in: allOrderIds },
              isReport: true,
              isCreditRepayment: { $ne: true },
              status: 'PAID',
            },
          },
          {
            $group: {
              _id: '$orderId',
              paidPaise: {
                $sum: {
                  $ifNull: ['$amountPaise', { $round: [{ $multiply: ['$amount', 100] }, 0] }],
                },
              },
            },
          },
        ])
      : [];
    const allDirectPaidByOrder = new Map(allDirectPayments.map((item) => [String(item._id), item.paidPaise]));
    const totalOutstandingPaise = outstandingOrders.reduce((sum, order) => {
      const totalPaise = Math.round(Number(order.grandTotal || 0) * 100);
      const paidPaise = order.isCreditOrder
        ? Math.round(Number(order.creditPaidAmount || 0) * 100)
        : Number.isSafeInteger(order.directPaidPaise)
          ? order.directPaidPaise
          : allDirectPaidByOrder.get(String(order._id)) || 0;
      return sum + Math.max(0, totalPaise - paidPaise);
    }, 0);

    return {
      transactions,
      summary: {
        totalPaidAmount: (paidReports[0]?.totalPaise || 0) / 100,
        totalOutstandingAmount: totalOutstandingPaise / 100,
      },
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  static async getAnalyticsSummary(retailerId) {
    const [orders, spending, wishlist, cart] = await Promise.all([
      Order.countDocuments({ retailerId }),
      Order.aggregate([
        { $match: { retailerId, orderStatus: { $ne: 'CANCELLED' } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, averageOrderValue: { $avg: '$grandTotal' } } },
      ]),
      RetailerRepository.findWishlist(retailerId),
      RetailerRepository.findCart(retailerId),
    ]);

    return {
      totalOrders: orders,
      totalSpending: spending[0]?.total || 0,
      averageOrderValue: spending[0]?.averageOrderValue || 0,
      wishlistCount: wishlist?.products?.length || 0,
      cartCount: cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
    };
  }

  static async getAnalyticsOrders(retailerId) {
    return Order.aggregate([
      { $match: { retailerId } },
      { $group: { _id: '$orderStatus', count: { $sum: 1 }, value: { $sum: '$grandTotal' } } },
      { $sort: { _id: 1 } },
    ]);
  }

  static async getAnalyticsSpending(retailerId) {
    const monthlySpend = await Order.aggregate([
      { $match: { retailerId, orderStatus: { $ne: 'CANCELLED' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          total: { $sum: '$grandTotal' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return { monthlySpend };
  }

  static async getAnalyticsProducts(retailerId) {
    return Order.aggregate([
      { $match: { retailerId, orderStatus: { $ne: 'CANCELLED' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          sku: { $first: '$items.sku' },
          quantity: { $sum: '$items.quantity' },
          spending: { $sum: '$items.total' },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 20 },
    ]);
  }

  static async getAnalytics(retailerId) {
    const [summary, orders, spending, products] = await Promise.all([
      this.getAnalyticsSummary(retailerId),
      this.getAnalyticsOrders(retailerId),
      this.getAnalyticsSpending(retailerId),
      this.getAnalyticsProducts(retailerId),
    ]);

    return {
      summary,
      orders,
      spending,
      products,
      monthlySpend: spending.monthlySpend,
    };
  }

  static async acceptInvitation(retailerUser, token, req = null) {
    return InvitationService.acceptInvitation(token, retailerUser, req);
  }

  static async switchWholesalerByReferral(retailerUser, referralCode) {
    if (retailerUser.role !== ROLES.RETAILER) {
      throw new ForbiddenError('Only retailers can switch wholesaler connections.', 'FORBIDDEN_ROLE');
    }

    const { profile: wholesalerProfile, wholesaler } = await ReferralService.resolveActiveCode(
      referralCode,
      { requireSignupsEnabled: false },
    );
    const retailerProfile = await RetailerProfile.findOne({ userId: retailerUser._id });
    if (!retailerProfile) {
      throw new NotFoundError('Retailer profile not found', 'RETAILER_PROFILE_NOT_FOUND');
    }

    const targetWholesalerId = wholesaler._id;
    const retailerWholesalerUpdate = {
      assignedWholesalerId: targetWholesalerId,
      wholesalerId: targetWholesalerId,
      createdByWholesalerId: targetWholesalerId,
      referralCodeUsed: wholesalerProfile.retailerReferralCode,
      wholesalerInfo: {
        businessName: wholesalerProfile.businessName || wholesaler.name || '',
        ownerName: wholesaler.name || '',
        email: wholesaler.email || '',
        phone: wholesaler.phone || '',
      },
    };
    const currentRelationship = await WholesalerRetailerRelationship.findOne({
      retailerId: retailerUser._id,
      status: RELATIONSHIP_STATUS.ACTIVE,
    });

    if (
      wholesalerProfile.retailerSignupsEnabled === false &&
      (!currentRelationship || String(currentRelationship.wholesalerId) !== String(targetWholesalerId))
    ) {
      throw new ForbiddenError(
        'This wholesaler has temporarily paused new retailer sign-ups.',
        'SIGNUPS_PAUSED',
      );
    }

    if (currentRelationship && String(currentRelationship.wholesalerId) === String(targetWholesalerId)) {
      currentRelationship.referralCode = wholesalerProfile.retailerReferralCode;
      await currentRelationship.save();
      const profileUpdate = await RetailerProfile.updateOne(
        { _id: retailerProfile._id },
        { $set: { ...retailerWholesalerUpdate, activeRelationshipId: currentRelationship._id } },
      );
      if (profileUpdate.matchedCount !== 1) {
        throw new NotFoundError('Retailer profile not found', 'RETAILER_PROFILE_NOT_FOUND');
      }
      return {
        message: 'You are already connected to this wholesaler.',
        relationship: currentRelationship,
      };
    }

    const now = new Date();
    const relationshipData = {
      wholesalerId: targetWholesalerId,
      retailerId: retailerUser._id,
      referralCode: wholesalerProfile.retailerReferralCode,
      status: RELATIONSHIP_STATUS.ACTIVE,
      joinedAt: now,
      approvedAt: now,
    };
    let session = null;
    const topologyType = mongoose.connection?.client?.topology?.description?.type;
    if (topologyType && topologyType.includes('ReplicaSet')) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    let relationship;
    try {
      const options = session ? { session } : {};
      if (currentRelationship) {
        const ended = await WholesalerRetailerRelationship.updateOne(
          { _id: currentRelationship._id, status: RELATIONSHIP_STATUS.ACTIVE },
          { $set: { status: RELATIONSHIP_STATUS.TERMINATED, terminatedAt: now } },
          options,
        );
        if (ended.modifiedCount !== 1) {
          throw new ConflictError('The retailer connection changed. Please retry the invitation.', 'RELATIONSHIP_CHANGED');
        }
      }

      relationship = await WholesalerRetailerRelationship.create(
        [{ ...relationshipData }],
        options,
      ).then(([created]) => created);

      const updatedProfile = await RetailerProfile.updateOne(
        { userId: retailerUser._id },
        { $set: { ...retailerWholesalerUpdate, activeRelationshipId: relationship._id } },
        options,
      );
      if (updatedProfile.matchedCount !== 1) {
        throw new NotFoundError('Retailer profile not found', 'RETAILER_PROFILE_NOT_FOUND');
      }

      if (session) await session.commitTransaction();
    } catch (error) {
      if (session?.inTransaction()) await session.abortTransaction();
      if (!session) {
        if (relationship) {
          await WholesalerRetailerRelationship.deleteOne({ _id: relationship._id });
        }
        if (currentRelationship) {
          await WholesalerRetailerRelationship.updateOne(
            { _id: currentRelationship._id },
            { $set: { status: RELATIONSHIP_STATUS.ACTIVE }, $unset: { terminatedAt: 1 } },
          );
        }
        const associationFields = {
          assignedWholesalerId: retailerProfile.assignedWholesalerId,
          wholesalerId: retailerProfile.wholesalerId,
          createdByWholesalerId: retailerProfile.createdByWholesalerId,
          referralCodeUsed: retailerProfile.referralCodeUsed,
          wholesalerInfo: retailerProfile.wholesalerInfo,
          activeRelationshipId: retailerProfile.activeRelationshipId,
        };
        const restoreProfile = Object.fromEntries(
          Object.entries(associationFields).filter(([, value]) => value !== undefined),
        );
        const unsetProfile = Object.fromEntries(
          Object.entries(associationFields)
            .filter(([, value]) => value === undefined)
            .map(([key]) => [key, 1]),
        );
        await RetailerProfile.updateOne(
          { _id: retailerProfile._id },
          {
            ...(Object.keys(restoreProfile).length ? { $set: restoreProfile } : {}),
            ...(Object.keys(unsetProfile).length ? { $unset: unsetProfile } : {}),
          },
        );
      }
      if (error.code === 11000) {
        throw new ConflictError('The retailer connection changed. Please retry the invitation.', 'RELATIONSHIP_CHANGED');
      }
      throw error;
    } finally {
      if (session) await session.endSession();
    }

    return {
      message: 'Successfully switched to the invited wholesaler.',
      relationship,
    };
  }
}

module.exports = RetailerService;
