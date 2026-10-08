const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const {
  User,
  WholesalerProfile,
  RetailerProfile,
  AdminProfile,
  RefreshToken,
  Wallet,
  Invitation,
  WholesalerRetailerRelationship,
} = require('../../models');
const { ROLES, USER_STATUS, KYC_STATUS, AUDIT_ACTION, RELATIONSHIP_STATUS } = require('../../config/constants');
const {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require('../../utils/errors');
const { hashToken, generateSecureToken } = require('../../utils/crypto');
const AuditService = require('../../services/audit.service');
const NotificationService = require('../../services/notification.service');

class AuthService {
  /**
   * Generate JWT access and refresh token pair
   */
  static generateTokens(user) {
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES,
    });

    const rawRefreshToken = generateSecureToken(40);
    const refreshTokenHash = hashToken(rawRefreshToken);

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    return {
      accessToken,
      rawRefreshToken,
      refreshTokenHash,
      refreshExpiry,
    };
  }

  /**
   * Authenticate user login
   */
  static async login({ email, loginId, phone, mobile, password, req = null }) {
    const loginIdentifier = email ? email.toLowerCase().trim() : (loginId || phone || mobile || '').trim();
    const query = email
      ? { email: loginIdentifier }
      : loginId
        ? { loginId: loginIdentifier.toUpperCase() }
        : { phone: loginIdentifier };

    const user = await User.findOne(query)
      .select('+passwordHash')
      .populate('wholesalerProfile')
      .populate('retailerProfile')
      .populate('adminProfile');

    if (!user || user.isDeleted) {
      throw new UnauthorizedError('Invalid credentials or account does not exist', 'INVALID_CREDENTIALS');
    }

    if (user.status === USER_STATUS.SUSPENDED || user.status === USER_STATUS.BLOCKED) {
      throw new ForbiddenError(`Your account has been ${user.status.toLowerCase()}. Please contact administrator.`, 'ACCOUNT_RESTRICTED');
    }

    if (user.role === ROLES.WHOLESALER && user.status === USER_STATUS.PENDING) {
      throw new ForbiddenError('Your wholesaler account is pending admin approval.', 'WHOLESALER_APPROVAL_PENDING');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials or password incorrect', 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const { accessToken, rawRefreshToken, refreshTokenHash, refreshExpiry } = this.generateTokens(user);

    // Save refresh token record
    await RefreshToken.create({
      userId: user._id,
      tokenHash: refreshTokenHash,
      expiresAt: refreshExpiry,
      ipAddress: req?.ip || '',
      userAgent: req?.headers['user-agent'] || '',
    });

    // Update last login info
    user.lastLoginAt = new Date();
    if (req) user.lastLoginIp = req.ip || '';
    await user.save();

    // Audit log
    await AuditService.log({
      actorId: user._id,
      actorRole: user.role,
      actorEmail: user.email,
      action: AUDIT_ACTION.LOGIN,
      entityType: 'User',
      entityId: user._id,
      req,
    });

    const userObj = user.toJSON();

    return {
      token: accessToken,
      accessToken,
      refreshToken: rawRefreshToken,
      user: userObj,
    };
  }

  /**
   * Register new user (Wholesaler or Retailer)
   */
  static async register(payload, req = null) {
    const {
      name,
      email,
      password,
      phone,
      role: rawRole,
      businessName,
      businessLogoUrl,
      businessType,
      city,
      state,
      address,
      pincode,
      gstin,
      pan,
      isGstRegistered,
      streetAddress,
      sameAsBusinessAddress,
      pickupStreetAddress,
      pickupCity,
      pickupState,
      pickupPincode,
      gstStatus,
      inviteToken,
      referralCode,
    } = payload;

    const role = (rawRole || 'RETAILER').toUpperCase();

    if (role === ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Cannot self-register as SUPER_ADMIN');
    }

    if (phone) {
      const normalizedPhone = phone.trim();
      const isValidPhone = /^\+?91?\d{10}$|^\d{10}$/.test(normalizedPhone);
      if (!isValidPhone) {
        throw new BadRequestError('Invalid mobile number format. Please provide a valid 10-digit number.', 'INVALID_PHONE');
      }
      
      const phoneExists = await User.findOne({ phone: normalizedPhone });
      if (phoneExists) {
        throw new ConflictError('This mobile number is already registered. Please log in instead or use a different number.', 'PHONE_ALREADY_EXISTS');
      }
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw new ConflictError('User with this email already exists', 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await User.hashPassword(password);

    const user = new User({
      name,
      email: normalizedEmail,
      phone: phone ? phone.trim() : undefined,
      passwordHash,
      role,
      status: role === ROLES.WHOLESALER ? USER_STATUS.PENDING : USER_STATUS.ACTIVE,
    });

    await user.save();

    // Create role-specific profiles
    if (role === ROLES.WHOLESALER) {
      const wholesalerProfile = await WholesalerProfile.create({
        userId: user._id,
        businessName: businessName || name,
        businessLogoUrl: businessLogoUrl || '',
        businessType: businessType || 'Proprietorship',
        gstin: isGstRegistered === false ? undefined : (gstin || undefined),
        gstStatus: isGstRegistered === false || gstStatus === 'UNREGISTERED' ? 'UNREGISTERED' : 'REGISTERED',
        pan: pan || undefined,
        address: {
          street: streetAddress || address || '',
          city: city || '',
          state: state || '',
          pincode: pincode || '',
        },
        pickupAddress: {
          street: sameAsBusinessAddress === false ? (pickupStreetAddress || '') : (streetAddress || address || ''),
          city: sameAsBusinessAddress === false ? (pickupCity || '') : (city || ''),
          state: sameAsBusinessAddress === false ? (pickupState || '') : (state || ''),
          pincode: sameAsBusinessAddress === false ? (pickupPincode || '') : (pincode || ''),
          country: 'India',
          sameAsBusinessAddress: sameAsBusinessAddress !== false,
        },
        kycStatus: KYC_STATUS.SUBMITTED,
        registrationDetails: {
          ownerName: name,
          email: normalizedEmail,
          phone: phone || '',
          isGstRegistered: isGstRegistered !== false,
          gstin: isGstRegistered === false ? '' : (gstin || ''),
          businessAddress: {
            street: streetAddress || address || '',
            city: city || '',
            state: state || '',
            pincode: pincode || '',
          },
          pickupAddress: {
            street: sameAsBusinessAddress === false ? (pickupStreetAddress || '') : (streetAddress || address || ''),
            city: sameAsBusinessAddress === false ? (pickupCity || '') : (city || ''),
            state: sameAsBusinessAddress === false ? (pickupState || '') : (state || ''),
            pincode: sameAsBusinessAddress === false ? (pickupPincode || '') : (pincode || ''),
          },
        },
      });

      // Create initial wallet for wholesaler
      const wallet = await Wallet.create({
        ownerId: user._id,
        ownerType: 'WHOLESALER',
      });

      wholesalerProfile.walletId = wallet._id;
      await wholesalerProfile.save();

      user.wholesalerProfile = wholesalerProfile._id;
      await user.save();
    } else if (role === ROLES.RETAILER) {
      const retailerProfile = await RetailerProfile.create({
        userId: user._id,
        businessName: businessName || `${name}'s Store`,
        gstin: gstin || undefined,
        gstStatus: gstStatus || 'UNREGISTERED',
        address: {
          street: address || '',
          city: city || '',
          state: state || '',
          pincode: pincode || '',
        },
      });

      user.retailerProfile = retailerProfile._id;
      await user.save();

      // If registered with invite token or referral code, process association immediately
      const tokenOrCode = referralCode || inviteToken;
      if (tokenOrCode) {
        try {
          const resolved = await this.resolveWholesalerFromCodeOrToken(tokenOrCode);
          if (resolved && resolved.wholesalerId) {
            const targetWholesalerId = resolved.wholesalerId;
            const [invitedWholesaler, invitedWholesalerProfile] = await Promise.all([
              User.findById(targetWholesalerId).select('name email phone').lean(),
              WholesalerProfile.findOne({ userId: targetWholesalerId }).lean(),
            ]);

            const relationshipData = {
              wholesalerId: targetWholesalerId,
              retailerId: user._id,
              status: RELATIONSHIP_STATUS.ACTIVE,
            };
            if (resolved.invitation) {
              relationshipData.invitationId = resolved.invitation._id;
            }

            const relationship = await WholesalerRetailerRelationship.create(relationshipData);

            retailerProfile.assignedWholesalerId = targetWholesalerId;
            retailerProfile.wholesalerId = targetWholesalerId;
            retailerProfile.createdByWholesalerId = targetWholesalerId;
            retailerProfile.activeRelationshipId = relationship._id;
            retailerProfile.wholesalerInfo = {
              businessName: invitedWholesalerProfile?.businessName || invitedWholesaler?.name || '',
              ownerName: invitedWholesaler?.name || '',
              email: invitedWholesaler?.email || '',
              phone: invitedWholesaler?.phone || '',
            };
            await retailerProfile.save();

            if (resolved.invitation) {
              resolved.invitation.usedCount += 1;
              await resolved.invitation.save();
            }

            await NotificationService.notify({
              recipientId: targetWholesalerId,
              title: 'New Retailer Joined via Referral',
              message: `${retailerProfile.businessName} (${name}) has self-registered using your referral link/code.`,
              data: { retailerId: user._id, relationshipId: relationship._id },
            });
          }
        } catch (inviteErr) {
          // Continue registration even if referral association encounters an issue
        }
      }
    }

    const { accessToken, rawRefreshToken, refreshTokenHash, refreshExpiry } = this.generateTokens(user);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: refreshTokenHash,
      expiresAt: refreshExpiry,
      ipAddress: req?.ip || '',
      userAgent: req?.headers['user-agent'] || '',
    });

    await AuditService.log({
      actorId: user._id,
      actorRole: user.role,
      actorEmail: user.email,
      action: AUDIT_ACTION.CREATE,
      entityType: 'User',
      entityId: user._id,
      req,
    });

    const fullUser = await User.findById(user._id)
      .populate('wholesalerProfile')
      .populate('retailerProfile');

    return {
      token: accessToken,
      accessToken,
      refreshToken: rawRefreshToken,
      user: fullUser.toJSON(),
    };
  }

  /**
   * Refresh JWT access token with refresh token rotation
   */
  static async refresh(rawRefreshToken, req = null) {
    if (!rawRefreshToken) {
      throw new UnauthorizedError('Refresh token required', 'REFRESH_TOKEN_REQUIRED');
    }

    const tokenHashVal = hashToken(rawRefreshToken);
    const storedToken = await RefreshToken.findOne({
      tokenHash: tokenHashVal,
      isRevoked: false,
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    // Invalidate old refresh token (Rotation)
    storedToken.isRevoked = true;
    await storedToken.save();

    const user = await User.findById(storedToken.userId)
      .populate('wholesalerProfile')
      .populate('retailerProfile')
      .populate('adminProfile');

    if (!user || user.isDeleted || user.status === USER_STATUS.BLOCKED || user.status === USER_STATUS.SUSPENDED) {
      throw new UnauthorizedError('User account not authorized', 'ACCOUNT_UNAUTHORIZED');
    }

    const { accessToken, rawRefreshToken: newRawRefresh, refreshTokenHash: newRefreshHash, refreshExpiry } =
      this.generateTokens(user);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: newRefreshHash,
      expiresAt: refreshExpiry,
      ipAddress: req?.ip || '',
      userAgent: req?.headers['user-agent'] || '',
    });

    return {
      token: accessToken,
      accessToken,
      refreshToken: newRawRefresh,
      user: user.toJSON(),
    };
  }

  /**
   * Invalidate refresh token session on logout
   */
  static async logout(rawRefreshToken, user = null, req = null) {
    if (rawRefreshToken) {
      const tokenHashVal = hashToken(rawRefreshToken);
      await RefreshToken.updateOne({ tokenHash: tokenHashVal }, { isRevoked: true });
    }

    if (user) {
      await AuditService.log({
        actorId: user._id,
        actorRole: user.role,
        actorEmail: user.email,
        action: AUDIT_ACTION.LOGOUT,
        entityType: 'User',
        entityId: user._id,
        req,
      });
    }
  }

  /**
   * Forgot password flow
   */
  static async forgotPassword(email) {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Return success to avoid email enumeration
      return { message: 'If the email exists, a password reset link has been dispatched.' };
    }

    const resetToken = generateSecureToken(32);
    user.resetPasswordTokenHash = hashToken(resetToken);
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // In production, dispatch email with reset link
    return {
      message: 'Password reset instructions dispatched.',
      resetToken, // Returned in dev/testing environments
    };
  }

  /**
   * Reset password with token
   */
  static async resetPassword(token, newPassword) {
    const tokenHashVal = hashToken(token);
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHashVal,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestError('Invalid or expired password reset token', 'INVALID_RESET_TOKEN');
    }

    user.passwordHash = await User.hashPassword(newPassword);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Invalidate all active sessions for security
    await RefreshToken.updateMany({ userId: user._id }, { isRevoked: true });

    return { message: 'Password updated successfully. Please log in with your new credentials.' };
  }

  /**
   * Resolve Wholesaler ID from invitation token, ObjectId, or Referral Code
   */
  static async resolveWholesalerFromCodeOrToken(codeOrToken) {
    if (!codeOrToken) return null;
    const cleanStr = String(codeOrToken).trim();

    // 1. Try invitation token hash
    try {
      const tokenHashVal = hashToken(cleanStr);
      const invitation = await Invitation.findOne({ tokenHash: tokenHashVal });
      if (invitation && invitation.isValid()) {
        return { wholesalerId: invitation.wholesalerId, invitation };
      }
    } catch {}

    // 2. Try direct Mongo ObjectId of wholesaler (User._id or WholesalerProfile._id)
    if (cleanStr.match(/^[0-9a-fA-F]{24}$/)) {
      const wholesaler = await User.findOne({ _id: cleanStr, role: ROLES.WHOLESALER });
      if (wholesaler) return { wholesalerId: wholesaler._id, invitation: null };

      const profile = await WholesalerProfile.findOne({ _id: cleanStr });
      if (profile) return { wholesalerId: profile.userId, invitation: null };
    }

    // 3. Try REF- referral code format (e.g. REF-SHOR-E3ADA9 or REF-E3ADA9 or E3ADA9)
    const upperStr = cleanStr.toUpperCase();
    const codeParts = upperStr.split('-');
    const suffixCandidate = codeParts[codeParts.length - 1];

    const profiles = await WholesalerProfile.find({}).select('_id userId businessName').lean();

    for (const p of profiles) {
      const uIdStr = String(p.userId || '').toUpperCase();
      const pIdStr = String(p._id || '').toUpperCase();

      const uShortId = uIdStr.slice(-6);
      const pShortId = pIdStr.slice(-6);

      const bNamePrefix = (p.businessName || 'WHOLESALER').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();

      const possibleCodes = [
        `REF-${bNamePrefix}-${uShortId}`,
        `REF-${bNamePrefix}-${pShortId}`,
        `REF-${uShortId}`,
        `REF-${pShortId}`,
        uShortId,
        pShortId,
        uIdStr,
        pIdStr,
      ];

      if (possibleCodes.includes(upperStr)) {
        return { wholesalerId: p.userId, invitation: null };
      }

      if (suffixCandidate && (suffixCandidate === uShortId || suffixCandidate === pShortId)) {
        return { wholesalerId: p.userId, invitation: null };
      }
    }

    return null;
  }
}

module.exports = AuthService;
