const express = require('express');
const controller = require('./referrals.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { referralLookupRateLimiter } = require('../../middleware/rateLimiter');
const { ROLES } = require('../../config/constants');

const publicRoutes = express.Router();
publicRoutes.get('/:code', referralLookupRateLimiter, controller.lookup);

const wholesalerRoutes = express.Router();
wholesalerRoutes.use(authenticate, authorize(ROLES.WHOLESALER));
wholesalerRoutes.get('/', controller.getWholesalerReferral);
wholesalerRoutes.post('/regenerate', controller.regenerate);
wholesalerRoutes.patch('/', controller.updateSettings);

module.exports = { publicRoutes, wholesalerRoutes };
