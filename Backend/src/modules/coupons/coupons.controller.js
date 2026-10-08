const CouponService = require('./coupons.service');

class CouponController {
  // Wholesaler Controllers
  static async createCoupon(req, res, next) {
    try {
      const coupon = await CouponService.createCoupon(req.user, req.body);
      res.status(201).json({
        success: true,
        data: coupon,
        message: 'Coupon created successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  static async getWholesalerCoupons(req, res, next) {
    try {
      const coupons = await CouponService.getWholesalerCoupons(req.user);
      res.status(200).json({
        success: true,
        data: coupons,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateCoupon(req, res, next) {
    try {
      const coupon = await CouponService.updateCoupon(req.user, req.params.id, req.body);
      res.status(200).json({
        success: true,
        data: coupon,
        message: 'Coupon updated successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  static async toggleCouponStatus(req, res, next) {
    try {
      const coupon = await CouponService.toggleCouponStatus(req.user, req.params.id);
      res.status(200).json({
        success: true,
        data: coupon,
        message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCoupon(req, res, next) {
    try {
      const result = await CouponService.deleteCoupon(req.user, req.params.id);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  // Retailer Controllers
  static async getRetailerCoupons(req, res, next) {
    try {
      const coupons = await CouponService.getRetailerCoupons(req.user);
      res.status(200).json({
        success: true,
        data: coupons,
      });
    } catch (err) {
      next(err);
    }
  }

  static async validateCoupon(req, res, next) {
    try {
      const result = await CouponService.validateCoupon(req.user, req.body);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CouponController;
