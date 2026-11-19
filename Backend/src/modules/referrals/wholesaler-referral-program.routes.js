const express = require('express');
const controller = require('./wholesaler-referral-program.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { referralLookupRateLimiter } = require('../../middleware/rateLimiter');
const { ROLES } = require('../../config/constants');

const publicRoutes = express.Router();
publicRoutes.get('/:code/validate', referralLookupRateLimiter, controller.validateCode);

const wholesalerRoutes = express.Router();
wholesalerRoutes.use(authenticate, authorize(ROLES.WHOLESALER));
wholesalerRoutes.get('/', controller.getWholesalerDashboard);

const adminRoutes = express.Router();
adminRoutes.use(authenticate, authorize(ROLES.SUPER_ADMIN));
adminRoutes.get('/summary', controller.getAdminSummary);
adminRoutes.get('/settings', controller.getSettings);
adminRoutes.put('/settings', controller.updateSettings);
adminRoutes.get('/', controller.listAdminCommissions);
adminRoutes.get('/:id/payout-details', controller.getPayoutBankDetails);
adminRoutes.patch('/:id/review', controller.reviewCommission);
adminRoutes.patch('/:id/process', controller.startManualPayout);
adminRoutes.patch('/:id/paid', controller.confirmManualPayment);

module.exports = { publicRoutes, wholesalerRoutes, adminRoutes };
