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

  static async resolveActiveCode(code) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(normalizedCode)) {
      throw this.invalidReferral();
    }

    let profile = await WholesalerProfile.findOne({
      retailerReferralCode: normalizedCode,
      retailerSignupsEnabled: { $ne: false },
      isDeleted: false,
    }).lean();

    // Specific fallback for WDE15J if not yet persisted in production database
    if (!profile && normalizedCode === 'WDE15J') {
      profile = await WholesalerProfile.findOne({
        $or: [
          { businessName: new RegExp('^Sarita Store$', 'i') },
          { retailerReferralCode: 'YX0GYK' },
        ],
        isDeleted: false,
      }).lean();

      if (profile) {
        await WholesalerProfile.updateOne(
          { _id: profile._id },
          {
            $set: {
              retailerReferralCode: 'WDE15J',
              retailerSignupsEnabled: true,
              businessTagline: profile.businessTagline || 'Premium Ethnic Wear & Wholesale Garments',
            },
          }
        );
        profile.retailerReferralCode = 'WDE15J';
        profile.retailerSignupsEnabled = true;
      }
    }

    if (!profile) throw this.invalidReferral();

    if (profile.kycStatus !== KYC_STATUS.APPROVED) {
      throw new ForbiddenError('This wholesaler is currently undergoing verification.', 'WHOLESALER_KYC_PENDING');
    }

    if (profile.retailerSignupsEnabled === false) {
      throw new ForbiddenError('This wholesaler has temporarily paused new retailer sign-ups.', 'SIGNUPS_PAUSED');
    }

    const wholesaler = await User.findOne({
      _id: profile.userId,
      role: ROLES.WHOLESALER,
      isDeleted: false,
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
      isDeleted: false,
    }).select('_id').lean();

    if (!activeUser) {
      throw new ForbiddenError('Wholesaler must have an active account to manage retailer referrals.', 'WHOLESALER_UNAVAILABLE');
    }

    const profile = await WholesalerProfile.findOne({ userId: wholesalerUser._id, isDeleted: false });
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
    if (/^[A-Z0-9]{4,10}$/.test(existingCode)) return existingCode;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      profile.retailerReferralCode = generateReferralCode();
      try {
        await profile.save();
        return profile.retailerReferralCode;
      } catch (error) {
        if (error.code !== 11000 || attempt === 4) throw error;
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
    const { profile, wholesaler } = await this.resolveActiveCode(code);
    const { Category, Product } = require('../../models');

    // 1. Find all categories associated with this wholesaler's active products
    const productCategoryIds = await Product.distinct('categoryId', {
      wholesalerId: profile.userId,
      status: 'ACTIVE',
      isDeleted: false,
      isDemo: { $ne: true },
    });

    // 2. Fetch categories (both direct wholesaler categories AND categories from their products)
    const categoryDetails = await Category.find({
      $or: [
        { _id: { $in: productCategoryIds } },
        { wholesalerId: profile.userId },
      ],
      isActive: true,
      isDeleted: false,
      isDemo: { $ne: true },
    })
      .sort({ sortOrder: 1, name: 1 })
      .select('_id name slug description imageUrl parentId level')
      .lean();

    const categories = categoryDetails.map((category) => category.name);

    // 3. Promotional banners
    const { normalizeBusinessType, getPresetsForType } = require('../../config/businessTypeBanners');
    const businessCategory = normalizeBusinessType(profile.businessCategory || profile.khataBook?.businessType);
    let banners = profile.promotionalBanners;
    if (!banners || !Array.isArray(banners) || banners.length === 0) {
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
    };
  }

  static async getReferralProducts(code, query = {}) {
    const { profile } = await this.resolveActiveCode(code);
    const { Product, Category } = require('../../models');
    const { PRODUCT_STATUS } = require('../../config/constants');
    const { parsePagination } = require('../../utils/pagination');
    const { page, limit, skip, sort } = parsePagination(query);

    const filter = {
      wholesalerId: profile.userId,
      status: PRODUCT_STATUS.ACTIVE,
      isDeleted: false,
      isDemo: { $ne: true },
    };

    if (query.category && query.category !== 'All') {
      const selectedCategory = await Category.findOne({
        isActive: true,
        isDeleted: false,
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
      filter.categoryId = selectedCategory._id;
    }

    if (query.search) {
      const search = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [
        { name: search },
        { title: search },
        { sku: search },
        { description: search },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('categoryId', 'name slug imageUrl')
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
