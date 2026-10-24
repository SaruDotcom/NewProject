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

    let categories = [];
    try {
      const productCategoryIds = await Product.distinct('categoryId', {
        wholesalerId: profile.userId,
        status: { $ne: 'INACTIVE' },
        isDeleted: false,
      });
      if (productCategoryIds && productCategoryIds.length > 0) {
        const found = await Category.find({ _id: { $in: productCategoryIds }, isDeleted: false })
          .limit(3)
          .select('name')
          .lean();
        categories = found.map((c) => c.name);
      }
      if (categories.length === 0) {
        const fallbackCats = await Category.find({ isDeleted: false }).limit(3).select('name').lean();
        categories = fallbackCats.map((c) => c.name);
      }
    } catch {
      categories = [];
    }

    return {
      businessName: profile.businessName,
      logo: profile.businessLogoUrl || '',
      city: profile.address?.city || '',
      categories,
    };
  }
}

module.exports = ReferralService;
