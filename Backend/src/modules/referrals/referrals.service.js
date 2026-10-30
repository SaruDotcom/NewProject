const crypto = require('crypto');
const { User, WholesalerProfile, WholesalerRetailerRelationship } = require('../../models');
const { ROLES, USER_STATUS, KYC_STATUS } = require('../../config/constants');
const { BadRequestError, ForbiddenError, ConflictError } = require('../../utils/errors');

const INVALID_REFERRAL_MESSAGE = 'This link is not valid. Please ask your wholesaler for a new link.';
const REFERRAL_CODE_CHARACTERS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const generateReferralCode = () => Array.from(
  { length: 6 },
  () => REFERRAL_CODE_CHARACTERS[crypto.randomInt(REFERRAL_CODE_CHARACTERS.length)]
).join('');

class ReferralService {
  static invalidReferral() {
    return new ForbiddenError(INVALID_REFERRAL_MESSAGE, 'INVALID_REFERRAL_CODE');
  }

  static async resolveActiveCode(code) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      throw this.invalidReferral();
    }

    const profile = await WholesalerProfile.findOne({
      retailerReferralCode: normalizedCode,
      retailerSignupsEnabled: true,
      kycStatus: KYC_STATUS.APPROVED,
      isDeleted: false,
    }).lean();
    if (!profile) throw this.invalidReferral();

    const wholesaler = await User.findOne({
      _id: profile.userId,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
      isDeleted: false,
    }).select('_id').lean();
    if (!wholesaler) throw this.invalidReferral();

    return { profile, wholesaler };
  }

  static async findApprovedWholesaler(wholesalerUser) {
    const activeUser = await User.findOne({
      _id: wholesalerUser._id,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
      isDeleted: false,
    }).select('_id').lean();
    const profile = await WholesalerProfile.findOne({ userId: wholesalerUser._id });
    if (!activeUser || !profile || profile.kycStatus !== KYC_STATUS.APPROVED || profile.isDeleted) {
      throw new ForbiddenError('Wholesaler must have approved KYC to manage retailer referrals.', 'KYC_APPROVAL_REQUIRED');
    }
    return profile;
  }

  static async ensureCode(profile) {
    const existingCode = String(profile.retailerReferralCode || '').trim();
    if (/^[A-Z0-9]{6}$/.test(existingCode)) return existingCode;

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
    const { profile } = await this.resolveActiveCode(code);
    const { Category, Product } = require('../../models');

    const productCategoryIds = await Product.distinct('categoryId', {
      wholesalerId: profile.userId,
      status: { $ne: 'INACTIVE' },
      isDeleted: false,
    });
    const categoryDetails = productCategoryIds.length > 0
      ? await Category.find({
        _id: { $in: productCategoryIds },
        isDeleted: false,
        $or: [{ wholesalerId: profile.userId }, { wholesalerId: null }],
      })
        .sort({ sortOrder: 1, name: 1 })
        .limit(3)
        .select('_id name slug description imageUrl parentId')
        .lean()
      : [];
    const categories = categoryDetails.map((category) => category.name);

    const { normalizeBusinessType, getPresetsForType } = require('../../config/businessTypeBanners');
    const businessCategory = normalizeBusinessType(profile.businessCategory || profile.khataBook?.businessType);
    let banners = profile.promotionalBanners;
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
      _id: String(profile.userId),
      id: String(profile.userId),
      wholesalerId: String(profile.userId),
      businessName: profile.businessName,
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
    const { Product } = require('../../models');
    const { PRODUCT_STATUS } = require('../../config/constants');
    const { parsePagination } = require('../../utils/pagination');
    const { page, limit, skip, sort } = parsePagination(query);

    const filter = {
      wholesalerId: profile.userId,
      status: PRODUCT_STATUS.ACTIVE,
      isDeleted: false,
    };

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
}

module.exports = ReferralService;
