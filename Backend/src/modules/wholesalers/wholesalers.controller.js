const WholesalerService = require('./wholesalers.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

class WholesalerController {
  listWholesalers = asyncHandler(async (req, res) => {
    const { wholesalers, meta, filters } = await WholesalerService.listWholesalers(req.query);
    return ApiResponse.success(
      res,
      { items: wholesalers, pagination: meta, filters },
      'Wholesalers retrieved successfully'
    );
  });

  getWholesalerById = asyncHandler(async (req, res) => {
    const data = await WholesalerService.getWholesalerById(req.params.id);
    return ApiResponse.success(res, data, 'Wholesaler profile retrieved successfully');
  });

  updateWholesaler = asyncHandler(async (req, res) => {
    const updated = await WholesalerService.updateWholesaler(req.params.id, req.body, req.user, req);
    return ApiResponse.success(res, updated, 'Wholesaler updated successfully');
  });

  updateStatus = asyncHandler(async (req, res) => {
    const result = await WholesalerService.updateStatus(req.params.id, req.body, req.user, req);
    return ApiResponse.success(res, result, 'Wholesaler status updated successfully');
  });

  setBlocked = asyncHandler(async (req, res) => {
    const result = await WholesalerService.setBlocked(req.params.id, req.body.blocked, req.user, req);
    return ApiResponse.success(res, result, result.message);
  });

  deleteWholesaler = asyncHandler(async (req, res) => {
    const result = await WholesalerService.deleteWholesaler(req.params.id, req.user, req);
    return ApiResponse.success(res, result, result.message);
  });

  getCreditPolicy = asyncHandler(async (req, res) => {
    const policy = await WholesalerService.getCreditPolicy(req.user);
    return ApiResponse.success(res, policy, 'Credit policy retrieved');
  });

  updateCreditPolicy = asyncHandler(async (req, res) => {
    const policy = await WholesalerService.updateCreditPolicy(req.user, req.body, req);
    return ApiResponse.success(res, policy, 'Credit policy updated successfully');
  });

  setRetailerCreditLimit = asyncHandler(async (req, res) => {
    const relationship = await WholesalerService.setRetailerCreditLimit(
      req.user,
      req.params.retailerId,
      req.body.customCreditLimit,
      req
    );
    return ApiResponse.success(res, relationship, 'Retailer credit limit updated');
  });

  updateRetailerCreditPolicy = asyncHandler(async (req, res) => {
    const relationship = await WholesalerService.updateRetailerCreditPolicy(
      req.user,
      req.params.retailerId,
      req.body,
      req
    );
    return ApiResponse.success(res, relationship, 'Retailer credit policy updated');
  });

  getCreditOverview = asyncHandler(async (req, res) => {
    const overview = await WholesalerService.getCreditOverview(req.user);
    return ApiResponse.success(res, overview, 'Credit overview retrieved');
  });

}

module.exports = new WholesalerController();
