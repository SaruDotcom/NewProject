const RetailerService = require('./retailers.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

class RetailerController {
  listRetailers = asyncHandler(async (req, res) => {
    const { retailers, meta, filters } = await RetailerService.listRetailers(req.query);
    return ApiResponse.success(res, {
      items: retailers,
      pagination: meta,
      filters,
    }, 'Retailers retrieved successfully');
  });

  getRetailerById = asyncHandler(async (req, res) => {
    const data = await RetailerService.getRetailerById(req.params.id);
    return ApiResponse.success(res, data, 'Retailer retrieved successfully');
  });

  createRetailer = asyncHandler(async (req, res) => {
    const data = await RetailerService.createRetailer(req.body, req.user, req);
    return ApiResponse.created(res, data, 'Retailer created successfully');
  });

  updateRetailer = asyncHandler(async (req, res) => {
    const data = await RetailerService.updateRetailer(req.params.id, req.body, req.user, req);
    return ApiResponse.success(res, data, 'Retailer updated successfully');
  });

  changeWholesaler = asyncHandler(async (req, res) => {
    const data = await RetailerService.changeWholesaler(req.params.id, req.body, req.user, req);
    return ApiResponse.success(res, data, 'Wholesaler changed successfully');
  });

  updateStatus = asyncHandler(async (req, res) => {
    const result = await RetailerService.updateStatus(req.params.id, req.body, req.user, req);
    return ApiResponse.success(res, result, 'Retailer status updated successfully');
  });

  deleteRetailer = asyncHandler(async (req, res) => {
    const result = await RetailerService.deleteRetailer(req.params.id, req.user, req);
    return ApiResponse.success(res, result, result.message);
  });
}

module.exports = new RetailerController();

