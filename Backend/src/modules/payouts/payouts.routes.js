const express = require('express');
const router = express.Router();
const payoutController = require('./payouts.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const idempotency = require('../../middleware/idempotency');
const { ROLES } = require('../../config/constants');

// Wholesaler request payout
router.post(
  '/wholesaler/request',
  authenticate,
  authorize(ROLES.WHOLESALER),
  idempotency,
  payoutController.requestPayout
);

// Admin Payout endpoints
router.get('/admin', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), payoutController.listPayouts);
router.get('/admin/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), payoutController.getPayoutById);
router.patch('/admin/:id/approve', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), payoutController.approvePayout);
router.patch('/admin/:id/reject', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), payoutController.rejectPayout);
router.patch(
  '/admin/:id/process',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  idempotency,
  payoutController.processPayout
);

// Direct mounts if mounted under /admin/payouts
router.get('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), payoutController.listPayouts);
router.get('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), payoutController.getPayoutById);
router.patch('/:id/approve', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), payoutController.approvePayout);
router.patch('/:id/reject', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), payoutController.rejectPayout);
router.patch(
  '/:id/process',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  idempotency,
  payoutController.processPayout
);

module.exports = router;
