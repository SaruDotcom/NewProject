const express = require('express');
const Joi = require('joi');
const controller = require('./wholesalerInvites.controller');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const asyncHandler = require('../../utils/asyncHandler');
const WholesalerInvitesService = require('./wholesalerInvites.service');
const { ROLES } = require('../../config/constants');
const { BadRequestError } = require('../../utils/errors');

const adminRouter = express.Router();
adminRouter.use(authenticate, authorize(ROLES.SUPER_ADMIN));

// Permanent Reusable Admin Wholesaler Referral Link routes
adminRouter.get('/link', controller.getAdminLink);
adminRouter.post('/link/regenerate', controller.regenerateAdminLink);
adminRouter.patch('/link/pause', validate(Joi.object({
  isPaused: Joi.boolean().optional(),
})), controller.toggleAdminLinkPause);
adminRouter.get('/link/wholesalers', validate(Joi.object({
  search: Joi.string().trim().max(150).allow('').optional(),
  kycStatus: Joi.string().trim().optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}), 'query'), controller.listRegisteredWholesalers);

// Legacy single-use invites
adminRouter.post('/', validate(Joi.object({
  contactName: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email({ tlds: { allow: false } }).trim().lowercase().max(254).required(),
  phone: Joi.string().trim().pattern(/^[6-9]\d{9}$/).required(),
  businessName: Joi.string().trim().min(2).max(150).required(),
  note: Joi.string().trim().max(500).allow('').default(''),
})), controller.create);
adminRouter.get('/', validate(Joi.object({
  status: Joi.string().valid('ALL', 'SENT', 'OPENED', 'REGISTERED', 'EXPIRED', 'REVOKED').optional(),
  search: Joi.string().trim().max(150).allow('').optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}), 'query'), controller.list);
adminRouter.post('/:id/revoke', controller.revoke);
adminRouter.post('/:id/regenerate', controller.regenerate);

const publicRouter = express.Router();
const publicInviteLimiter = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many invitation lookups. Please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});
publicRouter.get('/wholesaler/:token', publicInviteLimiter, controller.publicPrefill);
publicRouter.get('/validate-ref/:code', publicInviteLimiter, controller.validateAdminRef);

const registrationMiddleware = asyncHandler(async (req, res, next) => {
  const role = String(req.body?.role || '').toUpperCase();
  if (role !== ROLES.WHOLESALER) return next();

  if (req.body?.inviteToken) {
    if (!/^[a-f0-9]{64}$/i.test(req.body.inviteToken)) {
      throw new BadRequestError('Invalid wholesaler invitation token.', 'INVALID_INVITE_TOKEN');
    }
    await WholesalerInvitesService.getPublicPrefill(req.body.inviteToken);
  } else if (req.body?.ref || req.body?.adminCode) {
    const code = req.body.ref || req.body.adminCode;
    const validation = await WholesalerInvitesService.validateAdminRef(code, {
      ip: req.ip,
      userAgent: req.get ? req.get('user-agent') : req.headers['user-agent'],
    });
    if (!validation.valid) {
      throw new BadRequestError(validation.message || 'Invalid or paused referral link.', 'INVALID_REFERRAL_CODE');
    }
  }
  next();
});

module.exports = { adminRouter, publicRouter, registrationMiddleware };
