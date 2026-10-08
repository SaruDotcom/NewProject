const express = require('express');
const router = express.Router();
const retailerController = require('./retailers.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../config/constants');

// Super Admin Retailer endpoints
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/', retailerController.listRetailers);
router.post('/', retailerController.createRetailer);
router.get('/:id', retailerController.getRetailerById);
router.put('/:id', retailerController.updateRetailer);
router.patch('/:id/wholesaler', retailerController.changeWholesaler);
router.patch('/:id/status', retailerController.updateStatus);
router.delete('/:id', retailerController.deleteRetailer);

module.exports = router;

