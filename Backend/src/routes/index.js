const express = require('express');
const router = express.Router();

const authRoutes = require('../modules/auth/auth.routes');
const adminRoutes = require('../modules/admins/admins.routes');
const wholesalerRoutes = require('../modules/wholesalers/wholesalers.routes');
const retailerRoutes = require('../modules/retailers/retailers.routes');
const kycRoutes = require('../modules/kyc/kyc.routes');
const invitationRoutes = require('../modules/invitations/invitations.routes');
const categoryRoutes = require('../modules/categories/categories.routes');
const productRoutes = require('../modules/products/products.routes');
const orderRoutes = require('../modules/orders/orders.routes');
const earningRoutes = require('../modules/earnings/earnings.routes');
const payoutRoutes = require('../modules/payouts/payouts.routes');
const walletRoutes = require('../modules/wallets/wallets.routes');
const notificationRoutes = require('../modules/notifications/notifications.routes');
const auditRoutes = require('../modules/audit/audit.routes');
const reportRoutes = require('../modules/reports/reports.routes');
const couponRoutes = require('../modules/coupons/coupons.routes');
const referralRoutes = require('../modules/referrals/referrals.routes');

const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/constants');
const retailerPortalController = require('../modules/retailers/retailerPortal.controller');
const wholesalerPortalController = require('../modules/wholesalers/wholesalerPortal.controller');
const wholesalerPortalRoutes = require('../modules/wholesalers/wholesalerPortal.routes');
const supportRoutes = require('../modules/support/support.routes');
const wholesalerInviteRoutes = require('../modules/wholesaler-invites/wholesalerInvites.routes');

// Health Check
router.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

router.use('/support', supportRoutes.router);

// Mount this before the general /admin router to enforce SUPER_ADMIN-only access.
router.use('/admin/support', supportRoutes.adminRouter);
router.use('/admin/wholesaler-invites', wholesalerInviteRoutes.adminRouter);

// Auth module
router.use('/auth', authRoutes);
router.use('/referral', referralRoutes.publicRoutes);
router.use('/invites', wholesalerInviteRoutes.publicRouter);

// Super Admin Core Modules
router.use('/admin/wholesalers', wholesalerRoutes);
router.use('/admin/retailers', retailerRoutes);
router.use('/admin/kyc', kycRoutes);
router.use('/admin/categories', categoryRoutes);
router.use('/admin/products', productRoutes);
router.use('/admin/orders', orderRoutes);
router.use('/admin/earnings', earningRoutes);
router.use('/admin/payouts', payoutRoutes);
router.use('/admin/audit-logs', auditRoutes);
router.use('/admin/reports', reportRoutes);
router.use('/admin', adminRoutes);

// Specific Wholesaler Modules
router.use('/wholesaler/categories', categoryRoutes);
router.use('/wholesaler/products', productRoutes);
router.use('/wholesaler/kyc', kycRoutes);
router.use('/wholesaler/invite-links', invitationRoutes);
router.use('/wholesaler/referral', referralRoutes.wholesalerRoutes);
router.get(
  '/wholesaler/retailers',
  authenticate,
  authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN),
  wholesalerPortalController.getConnectedRetailers
);

// Wholesaler Portal Routes
router.use('/wholesaler', wholesalerPortalRoutes);

const retailerPortalRoutes = require('../modules/retailers/retailerPortal.routes');

// Retailer Portal Routes
router.use('/retailer', retailerPortalRoutes);

// General & Shared Modules
const wholesalerAdminController = require('../modules/wholesalers/wholesalers.controller');
const retailerAdminController = require('../modules/retailers/retailers.controller');
const adminController = require('../modules/admins/admins.controller');

router.post('/reviews', authenticate, adminController.createReview);
router.use('/kyc', kycRoutes);
router.use('/invitations', invitationRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/wallets', walletRoutes);
router.use('/payouts', payoutRoutes);
router.use('/payments', adminRoutes);
router.use('/dashboard', adminRoutes);
router.use('/relationships', adminRoutes);
router.use('/notifications', notificationRoutes);
router.use('/coupons', couponRoutes);

router.get(
  '/users/wholesalers',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  wholesalerAdminController.listWholesalers
);
router.get(
  '/users/retailers',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  retailerAdminController.listRetailers
);

module.exports = router;
