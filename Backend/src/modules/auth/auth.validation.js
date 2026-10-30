const Joi = require('joi');
const { ROLES } = require('../../config/constants');

const emailField = Joi.string().email({ tlds: { allow: false } }).trim().lowercase();

const loginSchema = Joi.object({
  email: emailField.optional(),
  loginId: Joi.string().trim().optional(),
  phone: Joi.string().optional(),
  mobile: Joi.string().optional(),
  password: Joi.string().required().min(6),
  role: Joi.string().valid(...Object.values(ROLES)).optional(),
}).or('email', 'loginId', 'phone', 'mobile');

const registerSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  email: emailField.required(),
  password: Joi.string().required().min(6).max(128),
  phone: Joi.string()
    .when('role', {
      is: Joi.string().valid(ROLES.WHOLESALER, 'wholesaler'),
      then: Joi.string().optional().allow('', null),
      otherwise: Joi.string().required().pattern(/^(?:\+?91)?[6-9]\d{9}$/),
    }),
  loginId: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z0-9_-]{4,32}$/)
    .when('role', {
      is: Joi.string().valid(ROLES.WHOLESALER, 'wholesaler'),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
  role: Joi.string()
    .valid(ROLES.WHOLESALER, ROLES.RETAILER, 'wholesaler', 'retailer')
    .default(ROLES.RETAILER),
  
  // Wholesaler specific
  businessName: Joi.string()
    .when('role', {
      is: Joi.string().valid(ROLES.WHOLESALER, 'wholesaler'),
      then: Joi.string().optional().allow('', null),
      otherwise: Joi.string().trim().required().min(2).max(150),
    }),
  businessLogoUrl: Joi.string().optional().allow('', null),
  businessType: Joi.string().optional().allow('', null),
  city: Joi.string()
    .when('role', {
      is: Joi.string().valid(ROLES.WHOLESALER, 'wholesaler'),
      then: Joi.string().optional().allow('', null),
      otherwise: Joi.string().trim().required(),
    }),
  state: Joi.string()
    .when('role', {
      is: Joi.string().valid(ROLES.WHOLESALER, 'wholesaler'),
      then: Joi.string().optional().allow('', null),
      otherwise: Joi.string().trim().required(),
    }),
  address: Joi.string()
    .when('role', {
      is: Joi.string().valid(ROLES.WHOLESALER, 'wholesaler'),
      then: Joi.string().optional().allow('', null),
      otherwise: Joi.string().trim().required(),
    }),
  pincode: Joi.string()
    .when('role', {
      is: Joi.string().valid(ROLES.WHOLESALER, 'wholesaler'),
      then: Joi.string().optional().allow('', null),
      otherwise: Joi.string().trim().pattern(/^\d{6}$/).required(),
    }),
  gstin: Joi.string().optional().allow('', null),
  pan: Joi.string().optional().allow('', null),
  isGstRegistered: Joi.boolean().optional(),
  sameAsBusinessAddress: Joi.boolean().optional(),
  streetAddress: Joi.string().optional().allow('', null),
  pickupStreetAddress: Joi.string().optional().allow('', null),
  pickupCity: Joi.string().optional().allow('', null),
  pickupState: Joi.string().optional().allow('', null),
  pickupPincode: Joi.string().optional().allow('', null),
  
  // Retailer specific
  gstStatus: Joi.string().optional().allow('', null),
  gstNumber: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/)
    .optional()
    .allow('', null),
  gstin: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/)
    .optional()
    .allow('', null),
  category: Joi.string().optional().allow('', null).max(100),
  panNumber: Joi.string().trim().uppercase().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/).optional().allow('', null),
  aadhaarNumber: Joi.string().trim().pattern(/^\d{12}$/).optional().allow('', null),
  identityConsent: Joi.alternatives()
    .try(Joi.boolean(), Joi.string().valid('true', 'false'))
    .optional(),
  referralCode: Joi.string().optional().allow('', null).trim().max(32),
  inviteToken: Joi.string().optional().trim().pattern(/^[a-f0-9]{64}$/i),
  ref: Joi.string().optional().trim().max(64).allow('', null),
  adminCode: Joi.string().optional().trim().max(64).allow('', null),
  utmSource: Joi.string().optional().trim().max(100).allow(''),
  utmMedium: Joi.string().optional().trim().max(100).allow(''),
  utmCampaign: Joi.string().optional().trim().max(100).allow(''),
  utmTerm: Joi.string().optional().trim().max(100).allow(''),
  utmContent: Joi.string().optional().trim().max(100).allow(''),
  firstLandingAt: Joi.date().iso().optional(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().optional(),
});

const forgotPasswordSchema = Joi.object({
  email: emailField.required(),
});

const verifyPasswordResetSchema = Joi.object({
  email: emailField.required(),
  code: Joi.string().required().pattern(/^\d{6}$/),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().required().min(6).max(128),
});

const otpCodeSchema = Joi.object({
  code: Joi.string().required().pattern(/^\d{6}$/),
});

const loginOtpSchema = otpCodeSchema.keys({
  challengeToken: Joi.string().required().hex().length(64),
});

const resendLoginOtpSchema = Joi.object({
  challengeToken: Joi.string().required().hex().length(64),
});

module.exports = {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  verifyPasswordResetSchema,
  resetPasswordSchema,
  otpCodeSchema,
  loginOtpSchema,
  resendLoginOtpSchema,
};
