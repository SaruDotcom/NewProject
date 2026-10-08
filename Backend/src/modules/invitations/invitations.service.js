const mongoose = require('mongoose');
const {
  Invitation,
  WholesalerRetailerRelationship,
  WholesalerProfile,
  RetailerProfile,
  User,
} = require('../../models');
const {
  INVITATION_STATUS,
  RELATIONSHIP_STATUS,
  AUDIT_ACTION,
  KYC_STATUS,
  ROLES,
} = require('../../config/constants');
const {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} = require('../../utils/errors');
const { generateSecureToken, hashToken } = require('../../utils/crypto');
const AuditService = require('../../services/audit.service');
const NotificationService = require('../../services/notification.service');

class InvitationService {
  /**
   * Wholesaler generates retailer invitation link
   */
  static async createInvitation(wholesalerUser, options = {}, req = null) {
    const wholesalerId = wholesalerUser._id;

    // Check wholesaler KYC status
    const profile = await WholesalerProfile.findOne({ userId: wholesalerId });
    if (!profile || profile.kycStatus !== KYC_STATUS.APPROVED) {
      throw new ForbiddenError(
        'Wholesaler must have an APPROVED KYC status to generate retailer invitation links',
        'KYC_APPROVAL_REQUIRED'
      );
    }

    const rawToken = generateSecureToken(24);
    const tokenHash = hashToken(rawToken);

    const expiresDays = options.expiresInDays || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresDays);

    const invitation = await Invitation.create({
      wholesalerId,
      tokenHash,
      status: INVITATION_STATUS.ACTIVE,
      expiresAt,
      maxUses: options.maxUses || 0, // 0 = unlimited
      createdBy: wholesalerId,
    });

    await AuditService.log({
      actorId: wholesalerId,
      actorRole: wholesalerUser.role,
      action: AUDIT_ACTION.CREATE,
      entityType: 'Invitation',
      entityId: invitation._id,
      metadata: { expiresAt, maxUses: options.maxUses },
      req,
    });

    return {
      invitationId: invitation._id,
      token: rawToken,
      inviteUrl: `/join/${rawToken}`,
      expiresAt: invitation.expiresAt,
      maxUses: invitation.maxUses,
      usedCount: invitation.usedCount,
      status: invitation.status,
    };
  }

  /**
   * Wholesaler lists all active/past invitation links
   */
  static async getWholesalerInvitations(wholesalerUser) {
    const invitations = await Invitation.find({ wholesalerId: wholesalerUser._id })
      .sort({ createdAt: -1 })
      .lean();

    return invitations.map((inv) => ({
      _id: inv._id,
      status: inv.status,
      expiresAt: inv.expiresAt,
      maxUses: inv.maxUses,
      usedCount: inv.usedCount,
      createdAt: inv.createdAt,
      isExpired: new Date() > new Date(inv.expiresAt),
    }));
  }

  /**
   * Wholesaler revokes an invitation link
   */
  static async revokeInvitation(invitationId, wholesalerUser, req = null) {
    const invitation = await Invitation.findOne({
      _id: invitationId,
      wholesalerId: wholesalerUser._id,
    });

    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }

    invitation.status = INVITATION_STATUS.REVOKED;
    invitation.revokedAt = new Date();
    invitation.revokedBy = wholesalerUser._id;
    await invitation.save();

    await AuditService.log({
      actorId: wholesalerUser._id,
      actorRole: wholesalerUser.role,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'Invitation',
      entityId: invitation._id,
      after: { status: INVITATION_STATUS.REVOKED },
      req,
    });

    return { message: 'Invitation link revoked successfully' };
  }

  /**
   * Public / Retailer checks validity of invitation token
   */
  static async validateInvitationToken(rawToken) {
    if (!rawToken) {
      throw new BadRequestError('Invitation token is required', 'MISSING_INVITE_TOKEN');
    }

    const tokenHash = hashToken(rawToken);
    const invitation = await Invitation.findOne({ tokenHash })
      .populate('wholesalerId', 'name email phone')
      .lean();

    if (!invitation) {
      throw new NotFoundError('Invitation link is invalid or does not exist', 'INVALID_INVITATION');
    }

    if (invitation.status === INVITATION_STATUS.REVOKED) {
      throw new BadRequestError('This invitation link has been revoked', 'INVITATION_REVOKED');
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      throw new BadRequestError('This invitation link has expired', 'INVITATION_EXPIRED');
    }

    if (invitation.maxUses > 0 && invitation.usedCount >= invitation.maxUses) {
      throw new BadRequestError('This invitation link has reached its maximum usage limit', 'INVITATION_EXHAUSTED');
    }

    const wholesalerProfile = await WholesalerProfile.findOne({ userId: invitation.wholesalerId._id })
      .select('businessName businessLogoUrl description city state')
      .lean();

    return {
      isValid: true,
      wholesaler: {
        id: invitation.wholesalerId._id,
        name: invitation.wholesalerId.name,
        businessName: wholesalerProfile?.businessName || invitation.wholesalerId.name,
        businessLogoUrl: wholesalerProfile?.businessLogoUrl || '',
        description: wholesalerProfile?.description || '',
      },
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * CRITICAL REQUIREMENT: Accept invitation & link Retailer to Wholesaler
   * Strict ACID transaction enforcing 1 Retailer = 1 Active Wholesaler Relationship!
   */
  static async acceptInvitation(rawToken, retailerUser, req = null) {
    const retailerId = retailerUser._id;

    if (retailerUser.role !== ROLES.RETAILER) {
      throw new ForbiddenError('Only retailers can accept wholesaler invitations', 'FORBIDDEN_ROLE');
    }

    const tokenHash = hashToken(rawToken);
    const invitation = await Invitation.findOne({ tokenHash });

    if (!invitation || !invitation.isValid()) {
      throw new BadRequestError('Invalid, expired, or exhausted invitation link', 'INVALID_INVITATION');
    }

    const wholesalerId = invitation.wholesalerId;

    // Check if retailer already belongs to ANY active wholesaler
    const existingActiveRel = await WholesalerRetailerRelationship.findOne({
      retailerId,
      status: RELATIONSHIP_STATUS.ACTIVE,
    });

    if (existingActiveRel) {
      if (String(existingActiveRel.wholesalerId) === String(wholesalerId)) {
        return {
          message: 'You are already actively connected to this wholesaler.',
          relationship: existingActiveRel,
        };
      } else {
        // Attempting to connect to a second active wholesaler -> REJECT!
        throw new ConflictError(
          'Retailer is already connected to another active wholesaler. A retailer can belong to only one wholesaler at a time.',
          'RETAILER_ALREADY_LINKED'
        );
      }
    }

    // Use session transaction if replica set/transaction supported by MongoDB deployment
    let session = null;
    try {
      const topologyType = mongoose.connection?.client?.topology?.description?.type;
      if (topologyType && topologyType.includes('ReplicaSet')) {
        session = await mongoose.startSession();
        session.startTransaction();
      }
    } catch (e) {
      session = null;
    }

    try {
      // Create Relationship
      const relationshipData = {
        wholesalerId,
        retailerId,
        invitationId: invitation._id,
        status: RELATIONSHIP_STATUS.ACTIVE,
        joinedAt: new Date(),
        approvedAt: new Date(),
      };

      const [wholesalerUser, wholesalerProfile] = await Promise.all([
        User.findById(wholesalerId).select('name email phone').lean(),
        WholesalerProfile.findOne({ userId: wholesalerId }).lean(),
      ]);
      const retailerWholesalerUpdate = {
        assignedWholesalerId: wholesalerId,
        wholesalerId,
        createdByWholesalerId: wholesalerId,
        wholesalerInfo: {
          businessName: wholesalerProfile?.businessName || wholesalerUser?.name || '',
          ownerName: wholesalerUser?.name || '',
          email: wholesalerUser?.email || '',
          phone: wholesalerUser?.phone || '',
        },
      };

      let relationship;
      if (session) {
        relationship = (await WholesalerRetailerRelationship.create([relationshipData], { session }))[0];
        invitation.usedCount += 1;
        await invitation.save({ session });
        await RetailerProfile.findOneAndUpdate(
          { userId: retailerId },
          { ...retailerWholesalerUpdate, activeRelationshipId: relationship._id },
          { session }
        );
        await session.commitTransaction();
      } else {
        relationship = await WholesalerRetailerRelationship.create(relationshipData);
        invitation.usedCount += 1;
        await invitation.save();
        await RetailerProfile.findOneAndUpdate(
          { userId: retailerId },
          { ...retailerWholesalerUpdate, activeRelationshipId: relationship._id }
        );
      }

      // Audit Log
      await AuditService.log({
        actorId: retailerId,
        actorRole: retailerUser.role,
        action: AUDIT_ACTION.CREATE,
        entityType: 'WholesalerRetailerRelationship',
        entityId: relationship._id,
        metadata: { wholesalerId, retailerId, invitationId: invitation._id },
        req,
      });

      // Notifications
      const retailerProfile = await RetailerProfile.findOne({ userId: retailerId });
      const connectedWholesalerProfile = await WholesalerProfile.findOne({ userId: wholesalerId });

      await NotificationService.notify({
        recipientId: wholesalerId,
        title: 'New Retailer Connected',
        message: `${retailerProfile?.businessName || retailerUser.name} has accepted your invitation and is now linked to your catalog.`,
        data: { retailerId, relationshipId: relationship._id },
      });

      await NotificationService.notify({
        recipientId: retailerId,
        title: 'Connected to Wholesaler',
        message: `You are now successfully connected to ${connectedWholesalerProfile?.businessName || 'the wholesaler'}. You can browse products and place orders.`,
        data: { wholesalerId, relationshipId: relationship._id },
      });

      return {
        message: 'Successfully joined wholesaler marketplace',
        relationship,
      };
    } catch (error) {
      if (session && session.inTransaction && session.inTransaction()) {
        await session.abortTransaction();
      }
      if (error.code === 11000) {
        throw new ConflictError(
          'Retailer is already connected to another active wholesaler.',
          'RETAILER_ALREADY_LINKED'
        );
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }
}

module.exports = InvitationService;
