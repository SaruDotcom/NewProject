const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const ReviewsService = require('./reviews.service');

module.exports = {
  create: asyncHandler(async (req, res) => {
    const review = await ReviewsService.create(req.user, req.body);
    return ApiResponse.success(res, review, 'Review submitted successfully', 201);
  }),
  listReceived: asyncHandler(async (req, res) => {
    const reviews = await ReviewsService.listReceived(req.user);
    return ApiResponse.success(res, reviews, 'Reviews retrieved');
  }),
  listSubmitted: asyncHandler(async (req, res) => {
    const reviews = await ReviewsService.listSubmitted(req.user);
    return ApiResponse.success(res, reviews, 'Submitted reviews retrieved');
  }),
  markReceivedRead: asyncHandler(async (req, res) => {
    const review = await ReviewsService.markReceivedRead(req.user, req.params.id);
    return ApiResponse.success(res, review, 'Review marked as read');
  }),
  listPartners: asyncHandler(async (req, res) => {
    const partners = await ReviewsService.getConnectedPartners(req.user);
    return ApiResponse.success(res, partners, 'Connected review partners retrieved');
  }),
};
