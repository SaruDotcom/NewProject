const express = require('express');
const router = express.Router();
const reportController = require('./reports.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../config/constants');

router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/:type', reportController.exportReport);

module.exports = router;
