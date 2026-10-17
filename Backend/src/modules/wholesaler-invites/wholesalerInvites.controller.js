const WholesalerInvitesService = require('./wholesalerInvites.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const AuditService = require('../../services/audit.service');
const { AUDIT_ACTION } = require('../../config/constants');

class WholesalerInvitesController {
  create = asyncHandler(async (req, res) => {
    const result = await WholesalerInvitesService.create(req.body, req.user);
    await AuditService.log({
      actorId: req.user._id,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      action: AUDIT_ACTION.CREATE,
      entityType: 'WholesalerInvite',
      entityId: result.invite.id,
      after: { status: result.invite.status, businessName: result.invite.businessName },
      req,
    });
    return ApiResponse.success(res, result, 'Wholesaler invitation created', 201);
  });

  list = asyncHandler(async (req, res) => {
    const result = await WholesalerInvitesService.list(req.query);
    return ApiResponse.success(res, result, 'Wholesaler invitations retrieved');
  });

  revoke = asyncHandler(async (req, res) => {
    const result = await WholesalerInvitesService.revoke(req.params.id);
    await AuditService.log({
      actorId: req.user._id,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'WholesalerInvite',
      entityId: result.id,
      after: { status: result.status },
      req,
    });
    return ApiResponse.success(res, result, 'Wholesaler invitation revoked');
  });

  regenerate = asyncHandler(async (req, res) => {
    const result = await WholesalerInvitesService.regenerate(req.params.id, req.user);
    await AuditService.log({
      actorId: req.user._id,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'WholesalerInvite',
      entityId: result.invite.id,
      after: { status: result.invite.status, regeneratedFrom: req.params.id },
      req,
    });
    return ApiResponse.success(res, result, 'Wholesaler invitation regenerated');
  });

  publicPrefill = asyncHandler(async (req, res) => {
    const result = await WholesalerInvitesService.getPublicPrefill(req.params.token);
    return ApiResponse.success(res, result, 'Invitation details retrieved');
  });

  getAdminLink = asyncHandler(async (req, res) => {
    const result = await WholesalerInvitesService.getAdminLink();
    return ApiResponse.success(res, result, 'Wholesaler registration link retrieved');
  });

  regenerateAdminLink = asyncHandler(async (req, res) => {
    const result = await WholesalerInvitesService.regenerateAdminLink(req.user);
    await AuditService.log({
      actorId: req.user._id,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'PlatformSetting',
      entityId: 'ADMIN_WHOLESALER_REFERRAL_LINK',
      after: { code: result.code },
      req,
    });
    return ApiResponse.success(res, result, 'New wholesaler registration link generated');
  });

  toggleAdminLinkPause = asyncHandler(async (req, res) => {
    const isPaused = typeof req.body?.isPaused === 'boolean' ? req.body.isPaused : undefined;
    const result = await WholesalerInvitesService.toggleAdminLinkPause(isPaused, req.user);
    await AuditService.log({
      actorId: req.user._id,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'PlatformSetting',
      entityId: 'ADMIN_WHOLESALER_REFERRAL_LINK',
      after: { isPaused: result.isPaused },
      req,
    });
    return ApiResponse.success(
      res,
      result,
      result.isPaused ? 'Registrations paused for this link' : 'Registrations resumed for this link'
    );
  });

  validateAdminRef = asyncHandler(async (req, res) => {
    const result = await WholesalerInvitesService.validateAdminRef(req.params.code, {
      ip: req.ip,
      userAgent: req.get ? req.get('user-agent') : req.headers['user-agent'],
    });
    return ApiResponse.success(res, result, 'Referral code validated');
  });

  listRegisteredWholesalers = asyncHandler(async (req, res) => {
    const result = await WholesalerInvitesService.listRegisteredWholesalers(req.query);
    return ApiResponse.success(res, result, 'Registered wholesalers retrieved');
  });
}

module.exports = new WholesalerInvitesController();
