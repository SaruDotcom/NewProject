const AdminService = require('./admins.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const AuditService = require('../../services/audit.service');
const { AUDIT_ACTION } = require('../../config/constants');

class AdminController {
  getDashboard = asyncHandler(async (req, res) => {
    const data = await AdminService.getDashboardMetrics(req.query);
    return ApiResponse.success(res, data, 'Admin dashboard metrics retrieved');
  });

  getAnalytics = asyncHandler(async (req, res) => {
    const data = await AdminService.getAnalytics(req.query);
    return ApiResponse.success(res, data, 'Analytics data retrieved');
  });

  getRelationships = asyncHandler(async (req, res) => {
    const data = await AdminService.getRelationships(req.query);
    return ApiResponse.success(res, data, 'Relationships retrieved successfully');
  });

  createRelationship = asyncHandler(async (req, res) => {
    const data = await AdminService.createRelationship(req.body);
    return ApiResponse.success(res, data, 'Relationship created successfully', 201);
  });

  updateRelationshipStatus = asyncHandler(async (req, res) => {
    const data = await AdminService.updateRelationshipStatus(req.params.id, req.body.status);
    return ApiResponse.success(res, data, 'Relationship status updated successfully');
  });

  deleteRelationship = asyncHandler(async (req, res) => {
    const data = await AdminService.deleteRelationship(req.params.id);
    return ApiResponse.success(res, data, 'Relationship deleted successfully');
  });

  getRelationship = asyncHandler(async (req, res) => {
    const data = await AdminService.getRelationshipById(req.params.id);
    return ApiResponse.success(res, data, 'Relationship details retrieved successfully');
  });

  getDashboardStats = asyncHandler(async (req, res) => {
    const data = await AdminService.getDashboardStats(req.query);
    return ApiResponse.success(res, data, 'Dashboard stats retrieved');
  });

  getDashboardChart = asyncHandler(async (req, res) => {
    const { chartType } = req.params;
    const data = await AdminService.getDashboardChart(chartType, req.query);
    return ApiResponse.success(res, data, `Dashboard chart ${chartType} retrieved`);
  });

  getDashboardRecent = asyncHandler(async (req, res) => {
    const data = await AdminService.getDashboardRecent();
    return ApiResponse.success(res, data, 'Dashboard recent records retrieved');
  });

  getReports = asyncHandler(async (req, res) => {
    const data = await AdminService.getReports(req.query);
    return ApiResponse.success(res, data, 'Reports retrieved successfully');
  });

  getPaymentsSummary = asyncHandler(async (req, res) => {
    const data = await AdminService.getPaymentsSummary();
    return ApiResponse.success(res, data, 'Payments summary retrieved');
  });

  getPayments = asyncHandler(async (req, res) => {
    const data = await AdminService.getPayments(req.query);
    return ApiResponse.success(res, data, 'Payments retrieved successfully');
  });

  getPaymentById = asyncHandler(async (req, res) => {
    const data = await AdminService.getPaymentById(req.params.id);
    return ApiResponse.success(res, data, 'Payment details retrieved');
  });

  getPaymentReceipt = asyncHandler(async (req, res) => {
    const data = await AdminService.getPaymentById(req.params.id);
    return ApiResponse.success(res, data, 'Payment receipt retrieved');
  });

  verifyPayment = asyncHandler(async (req, res) => {
    const result = await AdminService.verifyPayment(req.params.id, req.body);
    return ApiResponse.success(res, result, 'Payment verified successfully');
  });

  refundPayment = asyncHandler(async (req, res) => {
    const result = await AdminService.refundPayment(req.params.id, req.body);
    return ApiResponse.success(res, result, 'Payment refunded successfully');
  });

  getTransactions = asyncHandler(async (req, res) => {
    const data = await AdminService.getTransactions(req.query);
    return ApiResponse.success(res, data, 'Transactions retrieved successfully');
  });

  getCommissions = asyncHandler(async (req, res) => {
    const data = await AdminService.getCommissions(req.query);
    return ApiResponse.success(res, data, 'Commissions retrieved successfully');
  });

  getCommissionsRules = asyncHandler(async (req, res) => {
    const settings = await AdminService.getSettings();
    return ApiResponse.success(res, {
      rate: settings.platformCommissionRate || 3.5,
      minimum: settings.minCommissionPerOrder || 25,
      cap: settings.maxCommissionPerOrder || 5000,
    }, 'Commission rules retrieved');
  });

  updateCommissionsRules = asyncHandler(async (req, res) => {
    const settings = await AdminService.updateSettings({
      platformCommissionRate: req.body.rate,
      minCommissionPerOrder: req.body.minimum,
      maxCommissionPerOrder: req.body.cap,
    }, req.user);
    return ApiResponse.success(res, settings, 'Commission rules updated');
  });

  getReviews = asyncHandler(async (req, res) => {
    const data = await AdminService.getReviews(req.query);
    return ApiResponse.success(res, data, 'Reviews retrieved');
  });

  createReview = asyncHandler(async (req, res) => {
    const data = await AdminService.createReview(req.user, req.body);
    return ApiResponse.success(res, data, 'Review/Feedback submitted successfully', 201);
  });

  updateReviewStatus = asyncHandler(async (req, res) => {
    const data = await AdminService.updateReviewStatus(req.params.id, req.body.status);
    return ApiResponse.success(res, data, 'Review status updated');
  });

  deleteReview = asyncHandler(async (req, res) => {
    const data = await AdminService.deleteReview(req.params.id);
    return ApiResponse.success(res, data, 'Review deleted');
  });

  getCoupons = asyncHandler(async (req, res) => {
    const data = await AdminService.getCoupons(req.query);
    return ApiResponse.success(res, data, 'Coupons retrieved');
  });

  createCoupon = asyncHandler(async (req, res) => {
    const data = await AdminService.createCoupon(req.body, req.user);
    return ApiResponse.success(res, data, 'Coupon created successfully', 201);
  });

  updateCouponStatus = asyncHandler(async (req, res) => {
    const data = await AdminService.updateCouponStatus(req.params.id, req.body.isActive);
    return ApiResponse.success(res, data, 'Coupon status updated');
  });

  updateCoupon = asyncHandler(async (req, res) => {
    const data = await AdminService.updateCoupon(req.params.id, req.body);
    return ApiResponse.success(res, data, 'Coupon updated successfully');
  });

  deleteCoupon = asyncHandler(async (req, res) => {
    const data = await AdminService.deleteCoupon(req.params.id);
    return ApiResponse.success(res, data, 'Coupon deleted');
  });

  validateCoupon = asyncHandler(async (req, res) => {
    const { code, amount } = req.body;
    const data = await AdminService.validateCoupon(code, amount);
    return ApiResponse.success(res, data, 'Coupon validated successfully');
  });

  getContent = asyncHandler(async (req, res) => {
    const data = await AdminService.getContent(req.query);
    return ApiResponse.success(res, data, 'Content items retrieved');
  });

  getNotifications = asyncHandler(async (req, res) => {
    const data = await AdminService.getAdminNotifications(req.query, req.user);
    return ApiResponse.success(res, data, 'Notifications retrieved');
  });

  markAllNotificationsRead = asyncHandler(async (req, res) => {
    const data = await AdminService.markAllAdminNotificationsRead(req.user);
    return ApiResponse.success(res, data, 'All notifications marked as read');
  });

  markNotificationRead = asyncHandler(async (req, res) => {
    const data = await AdminService.markAdminNotificationRead(req.params.id, req.user);
    return ApiResponse.success(res, data, 'Notification marked as read');
  });

  deleteNotification = asyncHandler(async (req, res) => {
    const data = await AdminService.deleteAdminNotification(req.params.id, req.user);
    return ApiResponse.success(res, data, 'Notification deleted');
  });

  getUsers = asyncHandler(async (req, res) => {
    const data = await AdminService.getUsers(req.query);
    return ApiResponse.success(res, data, 'System users retrieved');
  });

  getActivityLogs = asyncHandler(async (req, res) => {
    const data = await AdminService.getActivityLogs(req.query);
    return ApiResponse.success(res, data, 'Activity logs retrieved');
  });

  getSettings = asyncHandler(async (req, res) => {
    const data = await AdminService.getSettings();
    return ApiResponse.success(res, data, 'Platform settings retrieved');
  });

  updateSettings = asyncHandler(async (req, res) => {
    const data = await AdminService.updateSettings(req.body, req.user);

    await AuditService.log({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: AUDIT_ACTION.SETTINGS_UPDATED,
      entityType: 'PlatformSetting',
      entityId: 'global',
      after: req.body,
      req,
    });

    return ApiResponse.success(res, data, 'Platform settings updated successfully');
  });
}

module.exports = new AdminController();
