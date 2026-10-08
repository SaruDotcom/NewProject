const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../config/constants');
const Controller = require('./wholesalerPortal.controller');
const payoutController = require('../payouts/payouts.controller');
const idempotency = require('../../middleware/idempotency');
const wholesalerController = require('./wholesalers.controller');

router.use(authenticate, authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN));
router.get('/profile', Controller.getProfile);
router.patch('/profile', Controller.updateProfile);
router.get('/store', Controller.getProfile);
router.patch('/store', Controller.updateProfile);
router.get('/credit-policy', wholesalerController.getCreditPolicy);
router.patch('/credit-policy', wholesalerController.updateCreditPolicy);
router.patch('/retailers/:retailerId/credit-limit', wholesalerController.setRetailerCreditLimit);
router.get('/credit-overview', wholesalerController.getCreditOverview);
router.post('/credit/settle-order/:orderId', wholesalerController.settleOrderCredit);
router.get('/retailers', Controller.getConnectedRetailers);
router.get('/retailers/:id', Controller.getRetailerDetails);
router.patch('/retailers/:id/password', Controller.resetRetailerPassword);
router.patch('/retailers/:id/status', Controller.updateRetailerStatus);
router.get('/inventory', Controller.listInventory);
router.get('/inventory/:productId/history', Controller.inventoryHistory);
router.post('/inventory/:productId/adjustments', Controller.adjustInventory);
router.get('/analytics', Controller.analytics);
router.get('/analytics/export', Controller.exportAnalytics);
const couponController = require('../coupons/coupons.controller');

router.get('/coupons', couponController.getWholesalerCoupons);
router.post('/coupons', couponController.createCoupon);
router.patch('/coupons/:id', couponController.updateCoupon);
router.put('/coupons/:id', couponController.updateCoupon);
router.patch('/coupons/:id/toggle', couponController.toggleCouponStatus);
router.delete('/coupons/:id', couponController.deleteCoupon);

module.exports = router;
