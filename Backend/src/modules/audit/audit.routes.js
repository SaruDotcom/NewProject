const express = require('express');
const router = express.Router();
const auditController = require('./audit.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../config/constants');

// Super Admin Audit endpoints (Append-only / Read-only)
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/', auditController.listAuditLogs);

module.exports = router;
