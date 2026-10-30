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
} = require('../models');
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
      businessName: profile?.businessName || wholesalerUser.name,
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
        businessName: profile?.businessName || wholesalerUser.name,
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
    const categoryIds = (await Product.distinct('categoryId', {
      wholesalerId: wholesalerUser._id,
      ...(query.status ? { status: query.status } : { status: 'ACTIVE' }),
      isDeleted: false,
      isDemo: { $ne: true },
    })).filter(Boolean);

    const filter = {
      _id: { $in: categoryIds },
      isDeleted: false,
      isDemo: { $ne: true },
    };

    if (query.status) {
      filter.isActive = String(query.status).toUpperCase() === 'ACTIVE' || query.status === 'true';
    }

    if (query.search) {
      const search = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: search }, { slug: search }, { description: search }];
    }

    const { page, limit, skip, sort } = parsePagination(query);
    const [categories, total] = await Promise.all([
      Category.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Category.countDocuments(filter),
    ]);

    return { categories, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async getProducts(retailerId, query = {}) {
    const wholesalerUser = await this.getActiveWholesalerOrThrow(retailerId);
    const { page, limit, skip, sort } = parsePagination(query);

    const filter = {
      wholesalerId: wholesalerUser._id,
      status: 'ACTIVE',
      isDeleted: false,
      isDemo: { $ne: true },
    };

    if (query.category && query.category !== 'All') {
      if (objectIdPattern.test(query.category)) {
        filter.categoryId = query.category;
      } else {
        const cat = await Category.findOne({
          $or: [{ name: new RegExp(escapeRegex(query.category), 'i') }, { slug: query.category }],
          isDemo: { $ne: true },
        });
        if (cat) filter.categoryId = cat._id;
      }
    }

    if (query.subcategory) {
      filter.subcategoryId = query.subcategory;
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
      filter.$or = [
        { name: search },
        { title: search },
        { sku: search },
        { brand: search },
      ];
    }

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
    }).populate('categoryId subcategoryId');

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
  static async checkout(retailerUser, checkoutPayload, req = null) {
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
      items,
      shippingAddress: checkoutPayload.shippingAddress,
      billingAddress: checkoutPayload.billingAddress,
      couponCode: checkoutPayload.couponCode,
    };
    // Call unified OrderService for authoritative pricing, stock reservation, order & payment creation
    const result = await OrderService.createOrder(
      retailerUser,
      {
        ...normalizedPayload,
        paymentMethod: checkoutPayload.paymentMethod,
        idempotencyKey: checkoutPayload.idempotencyKey,
      },
      req
    );

    // Clear cart after checkout
    await RetailerRepository.clearCart(retailerId);

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
    return this.getWalletTransactions(retailerId, query);
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
}

module.exports = RetailerService;
