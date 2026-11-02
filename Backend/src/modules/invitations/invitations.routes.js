const express = require('express');
const router = express.Router();
const invitationController = require('./invitations.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../config/constants');
const { requireActiveWholesaler } = require('../../middleware/wholesalerAccess');

// Retain listing/revocation of legacy links, but prevent issuing alternate registration links.
router.get('/', authenticate, authorize(ROLES.WHOLESALER), requireActiveWholesaler, invitationController.getWholesalerInvitations);
router.patch('/:id/revoke', authenticate, authorize(ROLES.WHOLESALER), requireActiveWholesaler, invitationController.revokeInvitation);

// Named subroutes when mounted on root router
router.get('/wholesaler/invite-links', authenticate, authorize(ROLES.WHOLESALER), requireActiveWholesaler, invitationController.getWholesalerInvitations);
router.patch('/wholesaler/invite-links/:id/revoke', authenticate, authorize(ROLES.WHOLESALER), requireActiveWholesaler, invitationController.revokeInvitation);

// Public / Retailer invitation validation and acceptance
router.get('/invitations/:token', invitationController.validateToken);
router.post('/invitations/:token/accept', authenticate, authorize(ROLES.RETAILER), invitationController.acceptInvitation);

router.get('/:token', invitationController.validateToken);
router.post('/:token/accept', authenticate, authorize(ROLES.RETAILER), invitationController.acceptInvitation);

module.exports = router;
