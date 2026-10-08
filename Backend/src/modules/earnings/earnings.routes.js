const express = require('express');
const router = express.Router();
const earningController = require('./earnings.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../config/constants');

// Super Admin Earnings endpoints
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/', earningController.listEarnings);
router.get('/summary', earningController.getSummary);

module.exports = router;
