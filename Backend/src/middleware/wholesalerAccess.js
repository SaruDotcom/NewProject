const { assertWholesalerBusinessActivated } = require('../services/wholesaler-access.service');
const { ROLES } = require('../config/constants');

/**
 * requireActiveWholesaler middleware
 * Ensures the requesting wholesaler has:
 *  1. kycStatus === 'APPROVED'
 *  2. subscription status is ACTIVE and its renewal date is in the future
 *
 * Super Admins and Admins bypass this check.
 */
const requireActiveWholesaler = async (req, res, next) => {
  try {
    if (!req.user || req.user.role === ROLES.SUPER_ADMIN || req.user.role === ROLES.ADMIN) {
      return next();
    }

    if (req.user.role !== ROLES.WHOLESALER) {
      return next();
    }

    const userId = req.user._id || req.user.id;
    const { profile, subscription } = await assertWholesalerBusinessActivated(userId);
    req.wholesalerProfile = profile;
    req.wholesalerSubscription = subscription;

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  requireActiveWholesaler,
};
