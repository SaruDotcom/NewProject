const express = require('express');
const router = express.Router();
const Controller = require('./coupons.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../config/constants');

// Wholesaler routes
router.post(
  '/wholesaler',
  authenticate,
  authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN),
  Controller.createCoupon
);

router.get(
  '/wholesaler',
  authenticate,
  authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN),
  Controller.getWholesalerCoupons
);

router.put(
  '/wholesaler/:id',
  authenticate,
  authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN),
  Controller.updateCoupon
);

router.patch(
  '/wholesaler/:id',
  authenticate,
  authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN),
  Controller.updateCoupon
);

router.patch(
  '/wholesaler/:id/toggle',
  authenticate,
  authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN),
  Controller.toggleCouponStatus
);

router.delete(
  '/wholesaler/:id',
  authenticate,
  authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN),
  Controller.deleteCoupon
);

// Retailer routes
router.get(
  '/retailer',
  authenticate,
  authorize(ROLES.RETAILER),
  Controller.getRetailerCoupons
);

router.post(
  '/retailer/validate',
  authenticate,
  authorize(ROLES.RETAILER),
  Controller.validateCoupon
);

module.exports = router;
