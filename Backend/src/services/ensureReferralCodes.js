const { WholesalerProfile } = require('../models');
const logger = require('../config/logger');
const ReferralService = require('../modules/referrals/referrals.service');

const ensureReferralCodes = async () => {
  try {
    const profiles = await WholesalerProfile.find({
      isDeleted: { $ne: true },
    });

    for (const profile of profiles) {
      let needsSave = false;
      const code = String(profile.retailerReferralCode || '').trim();

      if (!/^[A-Z0-9]{4,10}$/i.test(code)) {
        await ReferralService.ensureCode(profile);
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
          logger.info(`Ensured referral settings for wholesaler profile ${profile._id}`);
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
