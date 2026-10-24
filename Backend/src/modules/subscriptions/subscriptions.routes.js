const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../config/constants');
const controller = require('./subscriptions.controller');

const publicRoutes = express.Router();
publicRoutes.get('/', controller.getPublicPlan);

const adminRoutes = express.Router();
adminRoutes.use(authenticate, authorize(ROLES.SUPER_ADMIN));
adminRoutes.get('/', controller.getAdminPlan);
adminRoutes.post('/', controller.createPlan);
adminRoutes.patch('/reorder', controller.reorderPlans);
adminRoutes.put('/:planId', controller.updatePlan);
adminRoutes.delete('/:planId', controller.deletePlan);
adminRoutes.post('/:planId/features', controller.addFeature);
adminRoutes.patch('/:planId/features/reorder', controller.reorderFeatures);
adminRoutes.patch('/:planId/features/:featureId', controller.updateFeature);
adminRoutes.delete('/:planId/features/:featureId', controller.removeFeature);

const wholesalerRoutes = express.Router();
wholesalerRoutes.use(authenticate, authorize(ROLES.WHOLESALER));
wholesalerRoutes.get('/', controller.getWholesalerSubscription);
wholesalerRoutes.post('/orders', controller.createOrder);
wholesalerRoutes.post('/verify', controller.verifyPayment);

module.exports = { publicRoutes, adminRoutes, wholesalerRoutes };
