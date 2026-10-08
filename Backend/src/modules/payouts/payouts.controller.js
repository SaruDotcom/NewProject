const PayoutService = require('./payouts.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

class PayoutController {
  // Wholesaler requests payout
  requestPayout = asyncHandler(async (req, res) => {
    const payout = await PayoutService.requestPayout(req.user, req.body, req);
    return ApiResponse.created(res, payout, 'Payout requested successfully');
  });

  // Admin lists payouts
  listPayouts = asyncHandler(async (req, res) => {
    const { payouts, meta } = await PayoutService.listPayouts(req.query);
    return ApiResponse.paginated(res, payouts, meta, 'Payouts retrieved successfully');
  });

  // Admin gets payout by ID
  getPayoutById = asyncHandler(async (req, res) => {
    const payout = await PayoutService.getPayoutById(req.params.id);
    return ApiResponse.success(res, payout, 'Payout retrieved successfully');
  });

  // Admin approves payout
  approvePayout = asyncHandler(async (req, res) => {
    const payout = await PayoutService.approvePayout(req.params.id, req.user, req);
    return ApiResponse.success(res, payout, 'Payout approved successfully');
  });

  // Admin rejects payout
  rejectPayout = asyncHandler(async (req, res) => {
    const payout = await PayoutService.rejectPayout(req.params.id, req.body, req.user, req);
    return ApiResponse.success(res, payout, 'Payout rejected and locked funds released');
  });

  // Admin processes payout
  processPayout = asyncHandler(async (req, res) => {
    const payout = await PayoutService.processPayout(req.params.id, req.body, req.user, req);
    return ApiResponse.success(res, payout, 'Payout processed and funds transferred');
  });
}

module.exports = new PayoutController();
