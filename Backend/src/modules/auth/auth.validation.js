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
  phone: Joi.string().optional().allow('', null),
  role: Joi.string()
    .valid(ROLES.WHOLESALER, ROLES.RETAILER, 'wholesaler', 'retailer')
    .default(ROLES.RETAILER),
  
  // Wholesaler specific
  businessName: Joi.string().optional().allow('', null),
  businessLogoUrl: Joi.string().optional().allow('', null),
  businessType: Joi.string().optional().allow('', null),
  city: Joi.string().optional().allow('', null),
  state: Joi.string().optional().allow('', null),
  address: Joi.string().optional().allow('', null),
  pincode: Joi.string().optional().allow('', null),
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
  gstNumber: Joi.string().optional().allow('', null),
  inviteToken: Joi.string().optional().allow('', null),
  referralCode: Joi.string().optional().allow('', null),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().optional(),
});

const forgotPasswordSchema = Joi.object({
  email: emailField.required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().required().min(6),
});

module.exports = {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
