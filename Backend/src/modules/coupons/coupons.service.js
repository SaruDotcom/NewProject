const { Coupon, WholesalerRetailerRelationship } = require('../../models');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../../utils/errors');

class CouponService {
  /**
   * Create a new wholesaler coupon
   */
  static async createCoupon(wholesalerUser, couponData) {
    const wholesalerId = wholesalerUser._id;
    const {
      code,
      title,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscountCap,
      validFrom,
      validUntil,
      usageLimit,
      perRetailerLimit,
      isActive,
    } = couponData;

    if (!code || !title || discountValue === undefined || discountValue === null) {
      throw new BadRequestError('Code, title, and discount value are required', 'MISSING_FIELDS');
    }

    const cleanCode = String(code).trim().toUpperCase();

    // Check if code already exists for this wholesaler or active globally
    const existing = await Coupon.findOne({
      code: cleanCode,
      $or: [{ wholesalerId }, { wholesalerId: null }],
      isDeleted: false,
    });

    if (existing) {
      throw new BadRequestError(`Coupon code '${cleanCode}' already exists`, 'DUPLICATE_CODE');
    }

    const numValue = Number(discountValue);
    if (isNaN(numValue) || numValue <= 0) {
      throw new BadRequestError('Discount value must be a positive number', 'INVALID_DISCOUNT_VALUE');
    }

    if (discountType === 'PERCENTAGE' && numValue > 100) {
      throw new BadRequestError('Percentage discount cannot exceed 100%', 'INVALID_PERCENTAGE');
    }

    const coupon = await Coupon.create({
      wholesalerId,
      code: cleanCode,
      title: String(title).trim(),
      description: description ? String(description).trim() : '',
      discountType: discountType === 'FLAT' ? 'FLAT' : 'PERCENTAGE',
      discountValue: numValue,
      minOrderValue: Math.max(0, Number(minOrderValue) || 0),
      maxDiscountCap: Math.max(0, Number(maxDiscountCap) || 0),
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      usageLimit: Math.max(0, Number(usageLimit) || 0),
      perRetailerLimit: Math.max(0, Number(perRetailerLimit) || 0),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      applicableFor: 'RETAILER_ORDER',
    });

    return coupon;
  }

  /**
   * Get coupons for wholesaler with stats
   */
  static async getWholesalerCoupons(wholesalerUser) {
    const wholesalerId = wholesalerUser._id;
    const coupons = await Coupon.find({
      wholesalerId,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    return coupons;
  }

  /**
   * Update existing wholesaler coupon
   */
  static async updateCoupon(wholesalerUser, couponId, updateData) {
    const wholesalerId = wholesalerUser._id;
    const coupon = await Coupon.findOne({
      _id: couponId,
      wholesalerId,
      isDeleted: false,
    });

    if (!coupon) {
      throw new NotFoundError('Coupon not found', 'COUPON_NOT_FOUND');
    }

    const fields = [
      'title',
      'description',
      'discountType',
      'discountValue',
      'minOrderValue',
      'maxDiscountCap',
      'validFrom',
      'validUntil',
      'usageLimit',
      'perRetailerLimit',
      'isActive',
    ];

    fields.forEach((field) => {
      if (updateData[field] !== undefined) {
        if (field === 'discountType') {
          coupon[field] = updateData[field] === 'FLAT' ? 'FLAT' : 'PERCENTAGE';
        } else if (['discountValue', 'minOrderValue', 'maxDiscountCap', 'usageLimit', 'perRetailerLimit'].includes(field)) {
          coupon[field] = Math.max(0, Number(updateData[field]) || 0);
        } else if (['validFrom', 'validUntil'].includes(field)) {
          coupon[field] = updateData[field] ? new Date(updateData[field]) : null;
        } else {
          coupon[field] = updateData[field];
        }
      }
    });

    if (updateData.code) {
      const cleanCode = String(updateData.code).trim().toUpperCase();
      if (cleanCode !== coupon.code) {
        const existing = await Coupon.findOne({
          code: cleanCode,
          wholesalerId,
          _id: { $ne: couponId },
          isDeleted: false,
        });
        if (existing) {
          throw new BadRequestError(`Coupon code '${cleanCode}' is already in use`, 'DUPLICATE_CODE');
        }
        coupon.code = cleanCode;
      }
    }

    await coupon.save();
    return coupon;
  }

  /**
   * Toggle active state
   */
  static async toggleCouponStatus(wholesalerUser, couponId) {
    const wholesalerId = wholesalerUser._id;
    const coupon = await Coupon.findOne({
      _id: couponId,
      wholesalerId,
      isDeleted: false,
    });

    if (!coupon) {
      throw new NotFoundError('Coupon not found', 'COUPON_NOT_FOUND');
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();
    return coupon;
  }

  /**
   * Soft delete coupon
   */
  static async deleteCoupon(wholesalerUser, couponId) {
    const wholesalerId = wholesalerUser._id;
    const coupon = await Coupon.findOne({
      _id: couponId,
      wholesalerId,
      isDeleted: false,
    });

    if (!coupon) {
      throw new NotFoundError('Coupon not found', 'COUPON_NOT_FOUND');
    }

    coupon.isDeleted = true;
    coupon.isActive = false;
    await coupon.save();
    return { success: true, message: 'Coupon deleted successfully' };
  }

  /**
   * Retailer browsing active coupons from connected wholesaler(s)
   */
  static async getRetailerCoupons(retailerUser) {
    const retailerId = retailerUser._id;

    // Get active relationships
    const relationships = await WholesalerRetailerRelationship.find({
      retailerId,
      status: 'ACTIVE',
    });

    const wholesalerIds = relationships.map((r) => r.wholesalerId);

    const now = new Date();
    const coupons = await Coupon.find({
      $or: [
        { wholesalerId: { $in: wholesalerIds } },
        { wholesalerId: null },
      ],
      isActive: true,
      isDeleted: false,
      applicableFor: { $in: ['RETAILER_ORDER', 'ALL'] },
      validFrom: { $lte: now },
      $and: [
        { $or: [{ validUntil: null }, { validUntil: { $gte: now } }] },
      ],
    }).populate('wholesalerId', 'name businessName companyName email');

    // Add metadata for retailer eligibility
    return coupons.map((c) => {
      const cObj = c.toObject();
      let userCount = 0;
      if (Array.isArray(cObj.perRetailerUsage)) {
        const found = cObj.perRetailerUsage.find(
          (u) => String(u.retailerId) === String(retailerId)
        );
        if (found) userCount = found.count;
      }

      const totalLimitExceeded = cObj.usageLimit > 0 && cObj.usageCount >= cObj.usageLimit;
      const perUserLimitExceeded = cObj.perRetailerLimit > 0 && userCount >= cObj.perRetailerLimit;

      cObj.userUsageCount = userCount;
      cObj.isAvailable = !totalLimitExceeded && !perUserLimitExceeded;
      cObj.unavailableReason = totalLimitExceeded
        ? 'Total limit reached'
        : perUserLimitExceeded
        ? 'Your usage limit reached'
        : null;

      return cObj;
    });
  }

  /**
   * Validate and calculate coupon discount for cart/checkout
   */
  static async validateCoupon(retailerUser, { code, wholesalerId, subtotal }) {
    if (!code) {
      throw new BadRequestError('Coupon code is required', 'MISSING_CODE');
    }

    const retailerId = retailerUser._id;
    const cleanCode = String(code).trim().toUpperCase();
    const orderSubtotal = Math.max(0, Number(subtotal) || 0);

    const coupon = await Coupon.findOne({
      code: cleanCode,
      isActive: true,
      isDeleted: false,
    });

    if (!coupon) {
      throw new BadRequestError('Invalid or inactive coupon code', 'INVALID_COUPON');
    }

    // Check wholesaler ownership
    if (coupon.wholesalerId && wholesalerId) {
      if (String(coupon.wholesalerId) !== String(wholesalerId)) {
        throw new BadRequestError('This coupon is not valid for the selected wholesaler', 'WHOLESALER_MISMATCH');
      }
    }

    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) {
      throw new BadRequestError('This coupon is not yet active', 'COUPON_NOT_STARTED');
    }

    if (coupon.validUntil && coupon.validUntil < now) {
      throw new BadRequestError('This coupon has expired', 'COUPON_EXPIRED');
    }

    if (orderSubtotal < coupon.minOrderValue) {
      throw new BadRequestError(
        `Minimum order value of ₹${coupon.minOrderValue} required for coupon '${cleanCode}'`,
        'MIN_ORDER_NOT_MET'
      );
    }

    if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestError('Coupon usage limit has been reached', 'USAGE_LIMIT_EXCEEDED');
    }

    // Check per-retailer usage
    let retailerUsageCount = 0;
    if (Array.isArray(coupon.perRetailerUsage)) {
      const match = coupon.perRetailerUsage.find(
        (u) => String(u.retailerId) === String(retailerId)
      );
      if (match) retailerUsageCount = match.count;
    }

    if (coupon.perRetailerLimit > 0 && retailerUsageCount >= coupon.perRetailerLimit) {
      throw new BadRequestError('You have already reached the usage limit for this coupon', 'PER_USER_LIMIT_EXCEEDED');
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'FLAT') {
      discountAmount = Math.min(orderSubtotal, coupon.discountValue);
    } else {
      // PERCENTAGE
      discountAmount = (orderSubtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountCap > 0) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountCap);
      }
      discountAmount = Math.min(discountAmount, orderSubtotal);
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalTotal = Math.max(0, Math.round((orderSubtotal - discountAmount) * 100) / 100);

    return {
      valid: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderValue: coupon.minOrderValue,
        maxDiscountCap: coupon.maxDiscountCap,
      },
      discountAmount,
      finalTotal,
    };
  }

  /**
   * Helper to increment usage when order is placed
   */
  static async incrementCouponUsage(couponId, retailerId) {
    if (!couponId) return;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) return;

    coupon.usageCount = (coupon.usageCount || 0) + 1;

    if (!Array.isArray(coupon.perRetailerUsage)) {
      coupon.perRetailerUsage = [];
    }

    const index = coupon.perRetailerUsage.findIndex(
      (u) => String(u.retailerId) === String(retailerId)
    );

    if (index >= 0) {
      coupon.perRetailerUsage[index].count += 1;
    } else {
      coupon.perRetailerUsage.push({
        retailerId,
        count: 1,
      });
    }

    await coupon.save();
  }
}

module.exports = CouponService;
