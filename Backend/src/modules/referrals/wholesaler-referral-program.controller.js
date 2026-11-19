const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const ReferralProgramService = require('./wholesaler-referral-program.service');

class WholesalerReferralProgramController {
  validateCode = asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const result = await ReferralProgramService.validateCode(req.params.code);
    return ApiResponse.success(res, result, 'Wholesaler referral code is valid');
  });

  getWholesalerDashboard = asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const result = await ReferralProgramService.getWholesalerDashboard(req.user, req.query);
    return ApiResponse.success(res, result, 'Wholesaler referral program retrieved');
  });

  getAdminSummary = asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const result = await ReferralProgramService.getAdminSummary();
    return ApiResponse.success(res, result, 'Referral commission summary retrieved');
  });

  listAdminCommissions = asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const result = await ReferralProgramService.listAdminCommissions(req.query);
    return ApiResponse.success(res, result, 'Referral commissions retrieved');
  });

  getSettings = asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const result = await ReferralProgramService.getCommissionSettings();
    return ApiResponse.success(res, result, 'Referral commission settings retrieved');
  });

  updateSettings = asyncHandler(async (req, res) => {
    const result = await ReferralProgramService.updateCommissionSettings(req.body, req.user, req);
    return ApiResponse.success(res, result, 'Referral commission settings updated');
  });

  getPayoutBankDetails = asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const result = await ReferralProgramService.getPayoutBankDetails(req.params.id, req.user, req);
    return ApiResponse.success(res, result, 'Approved payout bank details retrieved');
  });

  reviewCommission = asyncHandler(async (req, res) => {
    const result = await ReferralProgramService.reviewCommission(req.params.id, req.body, req.user, req);
    return ApiResponse.success(res, result, 'Referral commission review saved');
  });

  startManualPayout = asyncHandler(async (req, res) => {
    const result = await ReferralProgramService.startManualPayout(req.params.id, req.user, req);
    return ApiResponse.success(res, result, 'Manual referral payout started');
  });

  confirmManualPayment = asyncHandler(async (req, res) => {
    const result = await ReferralProgramService.confirmManualPayment(req.params.id, req.body, req.user, req);
    return ApiResponse.success(res, result, 'Referral payment recorded');
  });
}

module.exports = new WholesalerReferralProgramController();
