const crypto = require('crypto');
const { User, WholesalerProfile, WholesalerRetailerRelationship } = require('../../models');
const { ROLES, USER_STATUS, KYC_STATUS } = require('../../config/constants');
const { BadRequestError, ForbiddenError, NotFoundError, ConflictError } = require('../../utils/errors');

const INVALID_REFERRAL_MESSAGE = 'Invalid invitation link. This referral code does not exist.';
const REFERRAL_CODE_CHARACTERS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const generateReferralCode = () => Array.from(
  { length: 6 },
  () => REFERRAL_CODE_CHARACTERS[crypto.randomInt(REFERRAL_CODE_CHARACTERS.length)]
).join('');

class ReferralService {
  static invalidReferral(message = INVALID_REFERRAL_MESSAGE) {
    return new NotFoundError(message, 'INVALID_REFERRAL_CODE');
  }

  static async resolveActiveCode(code, { requireSignupsEnabled = true } = {}) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(normalizedCode)) {
      throw this.invalidReferral();
    }

    let profile = await WholesalerProfile.findOne({
      retailerReferralCode: normalizedCode,
      isDeleted: { $ne: true },
    }).lean();

    if (!profile) {
      profile = await WholesalerProfile.findOne({
        retailerReferralCode: new RegExp(`^${escapeRegex(normalizedCode)}$`, 'i'),
        isDeleted: { $ne: true },
      }).lean();
    }

    if (!profile) throw this.invalidReferral();

    if (profile.kycStatus !== KYC_STATUS.APPROVED) {
      throw new ForbiddenError('This wholesaler is currently undergoing verification.', 'WHOLESALER_KYC_PENDING');
    }

    if (requireSignupsEnabled && profile.retailerSignupsEnabled === false) {
      throw new ForbiddenError('This wholesaler has temporarily paused new retailer sign-ups.', 'SIGNUPS_PAUSED');
    }

    const wholesaler = await User.findOne({
      _id: profile.userId,
      role: ROLES.WHOLESALER,
      isDeleted: { $ne: true },
    }).select('_id status name email phone').lean();

    if (!wholesaler) throw this.invalidReferral('Wholesaler account associated with this link was not found.');

    if (wholesaler.status === USER_STATUS.BLOCKED || wholesaler.status === USER_STATUS.SUSPENDED) {
      throw new ForbiddenError('This wholesaler is currently unavailable.', 'WHOLESALER_UNAVAILABLE');
    }

    if (wholesaler.status !== USER_STATUS.ACTIVE) {
      throw new ForbiddenError('This wholesaler account is currently inactive.', 'WHOLESALER_INACTIVE');
    }

    return { profile, wholesaler };
  }

  static async findApprovedWholesaler(wholesalerUser) {
    const activeUser = await User.findOne({
      _id: wholesalerUser._id,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
      isDeleted: { $ne: true },
    }).select('_id').lean();

    if (!activeUser) {
      throw new ForbiddenError('Wholesaler must have an active account to manage retailer referrals.', 'WHOLESALER_UNAVAILABLE');
    }

    const profile = await WholesalerProfile.findOne({
      userId: wholesalerUser._id,
      isDeleted: { $ne: true },
    });
    if (!profile) {
      throw new ForbiddenError('Wholesaler must have approved KYC to manage retailer referrals.', 'KYC_APPROVAL_REQUIRED');
    }

    if (profile.kycStatus !== KYC_STATUS.APPROVED) {
      throw new ForbiddenError('Wholesaler must have approved KYC to manage retailer referrals.', 'KYC_APPROVAL_REQUIRED');
    }

    return profile;
  }

  static async ensureCode(profile) {
    const existingCode = String(profile.retailerReferralCode || '').trim();
    if (/^[A-Z0-9]{4,10}$/i.test(existingCode)) return existingCode.toUpperCase();

    const filter = {
      _id: profile._id,
      isDeleted: { $ne: true },
    };
    if (profile.retailerReferralCode !== undefined && profile.retailerReferralCode !== null) {
      filter.retailerReferralCode = profile.retailerReferralCode;
    } else {
      filter.retailerReferralCode = { $in: [null, ''] };
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const newCode = generateReferralCode();
      try {
        const savedProfile = await WholesalerProfile.findOneAndUpdate(
          filter,
          { $set: { retailerReferralCode: newCode } },
          { new: true, runValidators: true },
        );
        if (savedProfile) {
          profile.retailerReferralCode = savedProfile.retailerReferralCode;
          return savedProfile.retailerReferralCode;
        }

        const latestProfile = await WholesalerProfile.findById(profile._id)
          .select('retailerReferralCode isDeleted')
          .lean();
        const latestCode = String(latestProfile?.retailerReferralCode || '').trim();
        if (latestProfile && latestProfile.isDeleted !== true && /^[A-Z0-9]{4,10}$/i.test(latestCode)) {
          profile.retailerReferralCode = latestCode;
          return latestCode.toUpperCase();
        }
        throw new ConflictError('Unable to save a unique referral code. Please try again.', 'REFERRAL_CODE_GENERATION_FAILED');
      } catch (error) {
        if (error.code !== 11000 || attempt === 9) throw error;
      }
    }
    throw new ConflictError('Unable to generate a unique referral code. Please try again.', 'REFERRAL_CODE_GENERATION_FAILED');
  }

  static async getWholesalerReferral(wholesalerUser) {
    const profile = await this.findApprovedWholesaler(wholesalerUser);
    const code = await this.ensureCode(profile);
    const joinedCount = await WholesalerRetailerRelationship.countDocuments({
      wholesalerId: wholesalerUser._id,
      referralCode: { $ne: '' },
    });

    return {
      code,
      signupsEnabled: profile.retailerSignupsEnabled !== false,
      joinedCount,
    };
  }

  static async getAdminReferralLink(wholesalerId) {
    let profile = null;
    if (/^[a-f\d]{24}$/i.test(String(wholesalerId))) {
      profile = await WholesalerProfile.findById(wholesalerId);
    }
    if (!profile) {
      profile = await WholesalerProfile.findOne({ userId: wholesalerId });
    }
    if (!profile || profile.isDeleted) throw new NotFoundError('Wholesaler not found');

    const code = await this.ensureCode(profile);
    const user = await User.findById(profile.userId).select('status').lean();
    return {
      code,
      wholesalerId: String(profile.userId),
      businessName: profile.businessName || '',
      businessTagline: profile.businessTagline || '',
      businessLogoUrl: profile.businessLogoUrl || '',
      kycStatus: profile.kycStatus || '',
      accountStatus: user?.status || 'UNAVAILABLE',
      signupsEnabled: profile.retailerSignupsEnabled !== false,
    };
  }

  static async regenerateCode(wholesalerUser) {
    const profile = await this.findApprovedWholesaler(wholesalerUser);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      profile.retailerReferralCode = generateReferralCode();
      try {
        await profile.save();
        return this.getWholesalerReferral(wholesalerUser);
      } catch (error) {
        if (error.code !== 11000 || attempt === 4) throw error;
      }
    }
    throw new ConflictError('Unable to generate a unique referral code. Please try again.', 'REFERRAL_CODE_GENERATION_FAILED');
  }

  static async setSignupsEnabled(wholesalerUser, enabled) {
    if (typeof enabled !== 'boolean') {
      throw new BadRequestError('The enabled field must be true or false.', 'INVALID_REFERRAL_SETTING');
    }
    const profile = await this.findApprovedWholesaler(wholesalerUser);
    profile.retailerSignupsEnabled = enabled;
    await profile.save();
    return this.getWholesalerReferral(wholesalerUser);
  }

  static async getPublicReferral(code) {
    const { profile, wholesaler } = await this.resolveActiveCode(code, { requireSignupsEnabled: false });
    const { Category, Coupon } = require('../../models');

    // 1. Fetch only active categories owned by this wholesaler.
    const categoryDetails = await Category.find({
      wholesalerId: profile.userId,
      isActive: true,
      isDeleted: { $ne: true },
      isDemo: { $ne: true },
    })
      .sort({ sortOrder: 1, name: 1 })
      .select('_id name slug description imageUrl parentId level')
      .lean();

    const categories = categoryDetails.map((category) => category.name);

    // 2. Promotional banners
    const { normalizeBusinessType } = require('../../config/businessTypeBanners');
    const businessCategory = normalizeBusinessType(profile.businessCategory || profile.khataBook?.businessType);
    const activeBanners = (Array.isArray(profile.promotionalBanners) ? profile.promotionalBanners : [])
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
    const now = new Date();
    const coupons = await Coupon.find({
      $or: [{ wholesalerId: profile.userId }, { wholesalerId: null }],
      isActive: true,
      isDeleted: false,
      applicableFor: { $in: ['RETAILER_ORDER', 'ALL'] },
      validFrom: { $lte: now },
      $and: [{ $or: [{ validUntil: null }, { validUntil: { $gte: now } }] }],
    })
      .select('code title description discountType discountValue minOrderValue maxDiscountCap validFrom validUntil wholesalerId')
      .sort({ createdAt: -1 })
      .lean();

    return {
      _id: String(profile.userId),
      id: String(profile.userId),
      wholesalerId: String(profile.userId),
      businessName: profile.businessName || wholesaler?.name || '',
      businessTagline: profile.businessTagline || '',
      businessLogoUrl: profile.businessLogoUrl || '',
      logo: profile.businessLogoUrl || '',
      city: profile.address?.city || '',
      categories,
      categoryDetails,
      businessCategory,
      activeStoreTheme: profile.activeStoreTheme || 'DEFAULT',
      banners: activeBanners,
      coupons: coupons.map((coupon) => ({
        _id: String(coupon._id),
        code: coupon.code,
        title: coupon.title,
        description: coupon.description || '',
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderValue: coupon.minOrderValue || 0,
        maxDiscountCap: coupon.maxDiscountCap || 0,
        validFrom: coupon.validFrom,
        validUntil: coupon.validUntil,
        wholesalerId: coupon.wholesalerId ? String(coupon.wholesalerId) : null,
        isAvailable: true,
      })),
    };
  }

  static async getReferralProducts(code, query = {}) {
    const { profile } = await this.resolveActiveCode(code, { requireSignupsEnabled: false });
    const { Product, Category } = require('../../models');
    const { PRODUCT_STATUS } = require('../../config/constants');
    const { parsePagination } = require('../../utils/pagination');
    const { page, limit, skip, sort } = parsePagination(query);

    const filter = {
      wholesalerId: profile.userId,
      status: PRODUCT_STATUS.ACTIVE,
      isDeleted: { $ne: true },
      isDemo: { $ne: true },
    };

    const activeCategories = await Category.find({
      wholesalerId: profile.userId,
      isActive: true,
      isDeleted: { $ne: true },
      isDemo: { $ne: true },
    })
      .select('_id')
      .lean();
    const activeCategoryIds = activeCategories.map((category) => category._id);
    if (activeCategoryIds.length === 0) {
      return { products: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }
    filter.$and = [{
      $or: [
        { categoryId: { $in: activeCategoryIds } },
        { category: { $in: activeCategoryIds } },
        { subcategoryId: { $in: activeCategoryIds } },
        { subCategory: { $in: activeCategoryIds } },
        { subSubcategoryId: { $in: activeCategoryIds } },
      ],
    }];

    if (query.category && query.category !== 'All') {
      const selectedCategory = await Category.findOne({
        wholesalerId: profile.userId,
        isActive: true,
        isDeleted: { $ne: true },
        isDemo: { $ne: true },
        $or: [
          ...( /^[0-9a-fA-F]{24}$/.test(String(query.category)) ? [{ _id: query.category }] : [] ),
          { name: new RegExp('^' + escapeRegex(query.category) + '$', 'i') },
          { slug: query.category },
        ],
      }).select('_id').lean();

      if (!selectedCategory) {
        return { products: [], meta: { page, limit, total: 0, totalPages: 0 } };
      }
      filter.$and.push({
        $or: [
          { categoryId: selectedCategory._id },
          { category: selectedCategory._id },
          { subcategoryId: selectedCategory._id },
          { subCategory: selectedCategory._id },
          { subSubcategoryId: selectedCategory._id },
        ],
      });
    }

    if (query.search) {
      const search = new RegExp(escapeRegex(query.search), 'i');
      filter.$and.push({
        $or: [
        { name: search },
        { title: search },
        { sku: search },
        { description: search },
        ],
      });
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('categoryId', 'name slug imageUrl')
        .populate('category', 'name slug imageUrl')
        .populate('subcategoryId', 'name slug')
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
}

module.exports = ReferralService;
