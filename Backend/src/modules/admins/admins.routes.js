const express = require('express');
const router = express.Router();
const adminController = require('./admins.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../config/constants');

// Protect all admin routes with SUPER_ADMIN / ADMIN authorization
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

// Dashboard
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/charts/:chartType', adminController.getDashboardChart);
router.get('/dashboard/recent', adminController.getDashboardRecent);
router.get('/dashboard', adminController.getDashboard);
router.get('/analytics', adminController.getAnalytics);

// Payments & Financials
router.get('/payments/summary', adminController.getPaymentsSummary);
router.get('/payments', adminController.getPayments);
router.get('/payments/:id', adminController.getPaymentById);
router.get('/payments/:id/receipt', adminController.getPaymentReceipt);
router.patch('/payments/:id/verify', adminController.verifyPayment);
router.post('/payments/:id/refund', adminController.refundPayment);
router.get('/transactions', adminController.getTransactions);

// Commissions
router.get('/commissions/rules', adminController.getCommissionsRules);
router.put('/commissions/rules', adminController.updateCommissionsRules);
router.get('/commissions', adminController.getCommissions);

// Reports
router.get('/reports', adminController.getReports);

// Reviews & Content & Coupons & Notifications
router.get('/reviews', adminController.getReviews);
router.post('/reviews', adminController.createReview);
router.patch('/reviews/:id/status', adminController.updateReviewStatus);
router.delete('/reviews/:id', adminController.deleteReview);
router.get('/coupons', adminController.getCoupons);
router.post('/coupons', adminController.createCoupon);
router.post('/coupons/validate', adminController.validateCoupon);
router.patch('/coupons/:id/status', adminController.updateCouponStatus);
router.patch('/coupons/:id', adminController.updateCoupon);
router.put('/coupons/:id', adminController.updateCoupon);
router.delete('/coupons/:id', adminController.deleteCoupon);
router.get('/content', adminController.getContent);
router.get('/notifications', adminController.getNotifications);
router.patch('/notifications/read-all', adminController.markAllNotificationsRead);
router.patch('/notifications/:id/read', adminController.markNotificationRead);
router.delete('/notifications/:id', adminController.deleteNotification);

// System Users & Activity
router.get('/users', adminController.getUsers);
router.get('/activity', adminController.getActivityLogs);

// Wholesaler-Retailer Relationships
router.get('/relationships', adminController.getRelationships);
router.get('/relationships/:id', adminController.getRelationship);
router.post('/relationships', adminController.createRelationship);
router.patch('/relationships/:id/status', adminController.updateRelationshipStatus);
router.delete('/relationships/:id', adminController.deleteRelationship);

router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

module.exports = router;
