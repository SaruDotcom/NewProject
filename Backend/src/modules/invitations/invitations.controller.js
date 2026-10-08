const InvitationService = require('./invitations.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

class InvitationController {
  // Wholesaler creates invitation
  createInvitation = asyncHandler(async (req, res) => {
    const result = await InvitationService.createInvitation(req.user, req.body, req);
    return ApiResponse.created(res, result, 'Invitation link created successfully');
  });

  // Wholesaler lists invitations
  getWholesalerInvitations = asyncHandler(async (req, res) => {
    const invitations = await InvitationService.getWholesalerInvitations(req.user);
    return ApiResponse.success(res, invitations, 'Invitation links retrieved');
  });

  // Wholesaler revokes invitation
  revokeInvitation = asyncHandler(async (req, res) => {
    const result = await InvitationService.revokeInvitation(req.params.id, req.user, req);
    return ApiResponse.success(res, result, result.message);
  });

  // Public validates invitation token
  validateToken = asyncHandler(async (req, res) => {
    const result = await InvitationService.validateInvitationToken(req.params.token);
    return ApiResponse.success(res, result, 'Invitation token is valid');
  });

  // Retailer accepts invitation
  acceptInvitation = asyncHandler(async (req, res) => {
    const result = await InvitationService.acceptInvitation(req.params.token, req.user, req);
    return ApiResponse.success(res, result, result.message);
  });
}

module.exports = new InvitationController();
