const mongoose = require('mongoose');
const CouponService = require('../src/modules/coupons/coupons.service');

async function test() {
  console.log('Testing CouponService logic compilation...');
  console.log('CouponService loaded successfully:', typeof CouponService.createCoupon === 'function');
  console.log('CouponService.validateCoupon:', typeof CouponService.validateCoupon === 'function');
  console.log('CouponService.incrementCouponUsage:', typeof CouponService.incrementCouponUsage === 'function');
}

test();
