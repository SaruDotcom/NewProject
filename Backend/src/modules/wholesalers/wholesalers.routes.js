const express = require('express');
const router = express.Router();
const wholesalerController = require('./wholesalers.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../config/constants');

// Super Admin Wholesaler Management endpoints
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/', wholesalerController.listWholesalers);
router.get('/:id', wholesalerController.getWholesalerById);
router.patch('/:id', wholesalerController.updateWholesaler);
router.patch('/:id/status', wholesalerController.updateStatus);
router.delete('/:id', wholesalerController.deleteWholesaler);

module.exports = router;
