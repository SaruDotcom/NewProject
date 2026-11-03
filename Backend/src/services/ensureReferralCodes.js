const { WholesalerProfile, User } = require('../models');
const { ROLES, USER_STATUS, KYC_STATUS } = require('../config/constants');
const logger = require('../config/logger');
const crypto = require('crypto');

const REFERRAL_CODE_CHARACTERS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const generateReferralCode = () => Array.from(
  { length: 6 },
  () => REFERRAL_CODE_CHARACTERS[crypto.randomInt(REFERRAL_CODE_CHARACTERS.length)]
).join('');

const ensureReferralCodes = async () => {
  try {
    // 1. Specifically ensure WDE15J is mapped to Sarita Store (or primary approved wholesaler)
    const existingWde15j = await WholesalerProfile.findOne({ retailerReferralCode: 'WDE15J' });
    if (!existingWde15j) {
      const saritaProfile = await WholesalerProfile.findOne({
        $or: [
          { businessName: new RegExp('^Sarita Store$', 'i') },
          { retailerReferralCode: 'YX0GYK' },
        ],
      });

      if (saritaProfile) {
        saritaProfile.retailerReferralCode = 'WDE15J';
        saritaProfile.retailerSignupsEnabled = true;
        if (!saritaProfile.businessTagline || saritaProfile.businessTagline.trim() === '') {
          saritaProfile.businessTagline = 'Premium Ethnic Wear & Wholesale Garments';
        }
        await saritaProfile.save();
        logger.info(`Assigned referral code WDE15J to Sarita Store (${saritaProfile._id})`);
      }
    } else {
      if (!existingWde15j.businessTagline || existingWde15j.businessTagline.trim() === '') {
        existingWde15j.businessTagline = 'Premium Ethnic Wear & Wholesale Garments';
        existingWde15j.retailerSignupsEnabled = true;
        await existingWde15j.save();
      }
    }

    // 2. Ensure all other approved wholesalers have a valid referral code
    const approvedProfiles = await WholesalerProfile.find({
      kycStatus: KYC_STATUS.APPROVED,
      isDeleted: false,
    });

    for (const profile of approvedProfiles) {
      let needsSave = false;
      const code = String(profile.retailerReferralCode || '').trim();

      if (!/^[A-Z0-9]{4,10}$/.test(code)) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const newCode = generateReferralCode();
          const collision = await WholesalerProfile.findOne({ retailerReferralCode: newCode });
          if (!collision) {
            profile.retailerReferralCode = newCode;
            needsSave = true;
            break;
          }
        }
      }

      if (profile.retailerSignupsEnabled === undefined || profile.retailerSignupsEnabled === null) {
        profile.retailerSignupsEnabled = true;
        needsSave = true;
      }

      if (!profile.businessTagline && profile.businessName) {
        profile.businessTagline = `${profile.businessName} Wholesale Catalog & Supplies`;
        needsSave = true;
      }

      if (needsSave) {
        try {
          await profile.save();
          logger.info(`Ensured referral code and settings for wholesaler: ${profile.businessName} (${profile.retailerReferralCode})`);
        } catch (saveErr) {
          logger.warn(`Could not update referral profile for ${profile._id}: ${saveErr.message}`);
        }
      }
    }
  } catch (error) {
    logger.error(`Error in ensureReferralCodes: ${error.message}`);
  }
};

module.exports = ensureReferralCodes;
