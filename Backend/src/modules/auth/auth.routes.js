const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authRateLimiter } = require('../../middleware/rateLimiter');
const asyncHandler = require('../../utils/asyncHandler');
const ReferralService = require('../referrals/referrals.service');
const { ROLES } = require('../../config/constants');
const { ForbiddenError } = require('../../utils/errors');
const { registrationMiddleware } = require('../wholesaler-invites/wholesalerInvites.routes');
const {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('./auth.validation');

const validateRetailerInvite = asyncHandler(async (req, res, next) => {
  const role = String(req.body?.role || ROLES.RETAILER).trim().toUpperCase();
  if (![ROLES.WHOLESALER, ROLES.RETAILER].includes(role)) {
    throw new ForbiddenError('Only wholesaler and retailer accounts can self-register.', 'INVALID_REGISTRATION_ROLE');
  }
  if (role === ROLES.RETAILER) {
    req.retailerReferral = await ReferralService.resolveActiveCode(req.body?.referralCode);
  }
  next();
});

router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/register', authRateLimiter, validateRetailerInvite, validate(registerSchema), registrationMiddleware, authController.register);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);

module.exports = router;
