const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  authRateLimiter,
  registrationRateLimiter,
  identityUploadRateLimiter,
} = require('../../middleware/rateLimiter');
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
  verifyPasswordResetSchema,
  resetPasswordSchema,
  otpCodeSchema,
  loginOtpSchema,
  resendLoginOtpSchema,
} = require('./auth.validation');
const { identityUpload } = require('../../services/retailerIdentity.service');

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
router.post('/login/2fa/resend', authRateLimiter, validate(resendLoginOtpSchema), authController.resendLoginCode);
router.post('/login/2fa/verify', authRateLimiter, validate(loginOtpSchema), authController.verifyLoginCode);
router.post('/2fa/enable/send', authenticate, authorize(ROLES.WHOLESALER), authController.sendTwoFactorCode);
router.post('/2fa/enable/resend', authenticate, authorize(ROLES.WHOLESALER), authController.resendTwoFactorCode);
router.post('/2fa/enable/verify', authenticate, authorize(ROLES.WHOLESALER), validate(otpCodeSchema), authController.verifyTwoFactorCode);
router.post('/2fa/disable', authenticate, authorize(ROLES.WHOLESALER), authController.disableTwoFactor);
router.post(
  '/register',
  registrationRateLimiter,
  identityUploadRateLimiter,
  identityUpload,
  validateRetailerInvite,
  validate(registerSchema),
  registrationMiddleware,
  authController.register
);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/verify-password-reset', authRateLimiter, validate(verifyPasswordResetSchema), authController.verifyPasswordReset);
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);

module.exports = router;
