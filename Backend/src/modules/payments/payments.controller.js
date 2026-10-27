const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const PaymentsService = require('./payments.service');

module.exports = {
  getSettings: asyncHandler(async (req, res) => {
    const settings = await PaymentsService.getSettings(req.user._id);
    return ApiResponse.success(res, settings, 'Payment settings retrieved');
  }),

  updateSettings: asyncHandler(async (req, res) => {
    const settings = await PaymentsService.updateSettings(req.user._id, req.body, req.file, req.user, req);
    return ApiResponse.success(res, settings, 'Payment settings saved');
  }),

  getRetailerOptions: asyncHandler(async (req, res) => {
    const options = await PaymentsService.getRetailerPaymentOptions(req.user._id);
    return ApiResponse.success(res, options, 'Wholesaler payment options retrieved');
  }),

  createRetailerQrSession: asyncHandler(async (req, res) => {
    const session = await PaymentsService.createRetailerQrSession(req.user._id);
    res.set('Cache-Control', 'no-store');
    return ApiResponse.success(res, session, 'Payment QR session created');
  }),

  createReport: asyncHandler(async (req, res) => {
    const report = await PaymentsService.createPaymentReport(req.user._id, req.body, req.file, req);
    return ApiResponse.created(res, report, 'Payment reported for wholesaler verification');
  }),

  listRetailerReports: asyncHandler(async (req, res) => {
    const reports = await PaymentsService.listRetailerReports(req.user._id);
    return ApiResponse.success(res, reports, 'Payment reports retrieved');
  }),

  listWholesalerReports: asyncHandler(async (req, res) => {
    const reports = await PaymentsService.listWholesalerReports(req.user._id);
    return ApiResponse.success(res, reports, 'Payment reports retrieved');
  }),

  listAdminReports: asyncHandler(async (_req, res) => {
    const reports = await PaymentsService.listAdminReports();
    return ApiResponse.success(res, reports, 'Payment reports retrieved');
  }),

  reviewReport: asyncHandler(async (req, res) => {
    const report = await PaymentsService.verifyReport(
      req.user._id,
      req.params.reportId,
      req.body.action,
      req.body.note,
      req.user,
      req
    );
    return ApiResponse.success(res, report, req.body.action === 'VERIFY' ? 'Payment confirmed' : 'Payment report rejected');
  }),

  getScreenshot: asyncHandler(async (req, res) => {
    const filePath = await PaymentsService.getScreenshotPath(req.params.reportId, req.user, req);
    return res.sendFile(filePath);
  }),
};
