const ReferralService = require('./referrals.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

class ReferralController {
  lookup = asyncHandler(async (req, res) => {
    const wholesaler = await ReferralService.getPublicReferral(req.params.code);
    return ApiResponse.success(res, { wholesaler }, 'Referral code is valid');
  });

  getWholesalerReferral = asyncHandler(async (req, res) => {
    const referral = await ReferralService.getWholesalerReferral(req.user);
    return ApiResponse.success(res, referral, 'Referral settings retrieved');
  });

  regenerate = asyncHandler(async (req, res) => {
    const referral = await ReferralService.regenerateCode(req.user);
    return ApiResponse.success(res, referral, 'Referral code regenerated');
  });

  updateSettings = asyncHandler(async (req, res) => {
    const referral = await ReferralService.setSignupsEnabled(req.user, req.body.enabled);
    return ApiResponse.success(res, referral, 'Referral sign-up settings updated');
  });
}

module.exports = new ReferralController();
