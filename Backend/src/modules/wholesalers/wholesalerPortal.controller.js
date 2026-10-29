const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const WholesalerPortalService = require('./wholesalerPortal.service');

class WholesalerPortalController {
  getProfile = asyncHandler(async (req, res) => ApiResponse.success(res, await WholesalerPortalService.getProfile(req.user._id), 'Wholesaler profile retrieved'));
  updateProfile = asyncHandler(async (req, res) => ApiResponse.success(res, await WholesalerPortalService.updateProfile(req.user._id, req.body, req.user, req), 'Wholesaler profile updated'));
  // Wholesaler gets connected retailers list
  getConnectedRetailers = asyncHandler(async (req, res) => {
    const { retailers, meta } = await WholesalerPortalService.listRetailers(req.user._id, req.query);
    return ApiResponse.paginated(res, retailers, meta, 'Connected retailers retrieved');
  });
  getRetailerDetails = asyncHandler(async (req, res) => ApiResponse.success(res, await WholesalerPortalService.getRetailerDetails(req.user._id, req.params.id), 'Retailer details retrieved'));
  updateRetailerStatus = asyncHandler(async (req, res) => ApiResponse.success(res, await WholesalerPortalService.updateRetailerStatus(req.user._id, req.params.id, req.body.status, req.user, req), 'Retailer relationship updated'));
  listInventory = asyncHandler(async (req, res) => { const result = await WholesalerPortalService.listInventory(req.user._id, req.query); return ApiResponse.paginated(res, result.inventory, result.meta, 'Inventory retrieved'); });
  inventoryHistory = asyncHandler(async (req, res) => { const result = await WholesalerPortalService.inventoryHistory(req.user._id, req.params.productId, req.query); return ApiResponse.paginated(res, result.transactions, result.meta, 'Inventory history retrieved'); });
  adjustInventory = asyncHandler(async (req, res) => ApiResponse.success(res, await WholesalerPortalService.adjustInventory(req.user._id, req.params.productId, req.body.quantity, req.body.notes, req.user, req), 'Inventory adjusted'));
  analytics = asyncHandler(async (req, res) => ApiResponse.success(res, await WholesalerPortalService.analytics(req.user._id, req.query), 'Wholesaler analytics retrieved'));
  exportAnalytics = asyncHandler(async (req, res) => {
    const { content, filename } = await WholesalerPortalService.exportAnalyticsCsv(req.user._id, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(content);
  });
  listPayouts = asyncHandler(async (req, res) => { const result = await WholesalerPortalService.listPayouts(req.user._id, req.query); return ApiResponse.paginated(res, result.payouts, result.meta, 'Payout history retrieved'); });
  submitHelpRequest = asyncHandler(async (req, res) => { const result = await WholesalerPortalService.submitHelpRequest(req.user._id, req.body); return ApiResponse.success(res, result, 'Help request submitted successfully', 201); });
  getBanners = asyncHandler(async (req, res) => ApiResponse.success(res, await WholesalerPortalService.getBanners(req.user._id), 'Wholesaler banners retrieved'));
  updateBanners = asyncHandler(async (req, res) => ApiResponse.success(res, await WholesalerPortalService.updateBanners(req.user._id, req.body, req.user, req), 'Wholesaler banners updated'));
  activatePreset = asyncHandler(async (req, res) => ApiResponse.success(res, await WholesalerPortalService.activatePreset(req.user._id, req.body.presetId, req.user, req), 'Banner preset activated'));
  updateBusinessCategory = asyncHandler(async (req, res) => ApiResponse.success(res, await WholesalerPortalService.updateBusinessCategory(req.user._id, req.body.businessCategory, req.user, req), 'Business category updated'));
}

module.exports = new WholesalerPortalController();
