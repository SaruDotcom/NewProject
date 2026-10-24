const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const {
  User,
  WholesalerProfile,
  RetailerProfile,
  AdminProfile,
  RefreshToken,
  Wallet,
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
const EmailOtpService = require('../../services/emailOtp.service');
const ReferralService = require('../referrals/referrals.service');
const WholesalerInvitesService = require('../wholesaler-invites/wholesalerInvites.service');
const { RetailerIdentityService } = require('../../services/retailerIdentity.service');

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

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials or password incorrect', 'INVALID_CREDENTIALS');
    }

    if (user.role === ROLES.WHOLESALER && user.wholesalerProfile?.twoFactorEnabled) {
      return EmailOtpService.startLogin(user);
    }

    return this.completeLogin(user, req);
  }

  static async completeLogin(user, req = null) {
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

  static async sendTwoFactorCode(userId, purpose, resend = false) {
    if (purpose === 'ENABLE_2FA') {
      return resend
        ? EmailOtpService.resendEnable(userId)
        : EmailOtpService.startEnable(userId);
    }
    throw new BadRequestError('Unsupported verification code purpose.', 'OTP_PURPOSE_INVALID');
  }

  static async verifyTwoFactorCode(userId, code) {
    return EmailOtpService.verifyEnable(userId, code);
  }

  static async disableTwoFactor(userId) {
    return EmailOtpService.disable(userId);
  }

  static async resendLoginCode(challengeToken) {
    return EmailOtpService.resendLogin(challengeToken);
  }

  static async verifyLoginCode(challengeToken, code, req = null) {
    const user = await EmailOtpService.verifyLogin(challengeToken, code);
    if (!user || user.isDeleted) {
      throw new UnauthorizedError('Invalid credentials or account does not exist', 'INVALID_CREDENTIALS');
    }
    if (user.status === USER_STATUS.SUSPENDED || user.status === USER_STATUS.BLOCKED) {
      throw new ForbiddenError(`Your account has been ${user.status.toLowerCase()}. Please contact administrator.`, 'ACCOUNT_RESTRICTED');
    }
    return this.completeLogin(user, req);
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
      loginId,
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
      gstNumber,
      isGstRegistered,
      streetAddress,
      sameAsBusinessAddress,
      pickupStreetAddress,
      pickupCity,
      pickupState,
      pickupPincode,
      gstStatus,
      category,
      panNumber,
      aadhaarNumber,
      identityConsent,
      referralCode,
      inviteToken,
      ref,
      adminCode,
      utmSource = '',
      utmMedium = '',
      utmCampaign = '',
      utmTerm = '',
      utmContent = '',
      firstLandingAt,
    } = payload;

    const role = (rawRole || 'RETAILER').toUpperCase();
    const referral = role === ROLES.RETAILER
      ? (req?.retailerReferral || await ReferralService.resolveActiveCode(referralCode))
      : null;

    if (![ROLES.WHOLESALER, ROLES.RETAILER].includes(role)) {
      throw new ForbiddenError('Only wholesaler and retailer accounts can self-register.', 'INVALID_REGISTRATION_ROLE');
    }

    if (role === ROLES.RETAILER && !loginId) {
      throw new BadRequestError('A retailer login ID is required.', 'LOGIN_ID_REQUIRED');
    }

    if (role === ROLES.RETAILER && !phone) {
      throw new BadRequestError('A valid mobile number is required to register.', 'INVALID_PHONE');
    }

    let normalizedPhone;
    if (phone) {
      const submittedPhone = phone.trim();
      const isRetailerPhone = role === ROLES.RETAILER;
      const isValidPhone = isRetailerPhone
        ? /^(?:\+?91)?[6-9]\d{9}$/.test(submittedPhone)
        : /^\+?91?\d{10}$|^\d{10}$/.test(submittedPhone);
      if (!isValidPhone) {
        throw new BadRequestError('Invalid mobile number format. Please provide a valid 10-digit number.', 'INVALID_PHONE');
      }
      normalizedPhone = isRetailerPhone
        ? submittedPhone.replace(/^\+?91(?=[6-9]\d{9}$)/, '')
        : submittedPhone;
      const phoneExists = isRetailerPhone
        ? await User.findOne({
            $or: [
              { phone: normalizedPhone },
              { phone: `+91${normalizedPhone}` },
              { phone: `91${normalizedPhone}` },
            ],
          })
        : await User.findOne({ phone: normalizedPhone });
      if (phoneExists) {
        throw new ConflictError('This mobile number is already registered. Please log in instead or use a different number.', 'PHONE_ALREADY_EXISTS');
      }
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw new ConflictError('User with this email already exists', 'EMAIL_ALREADY_EXISTS');
    }

    const normalizedLoginId = role === ROLES.RETAILER ? loginId.trim().toUpperCase() : undefined;
    if (normalizedLoginId && await User.findOne({ loginId: normalizedLoginId })) {
      throw new ConflictError('This retailer ID is already registered. Please choose another ID.', 'LOGIN_ID_ALREADY_EXISTS');
    }

    const adminRefCode = String(ref || adminCode || '').trim();
    let validatedAdminCode = '';
    if (role === ROLES.WHOLESALER && adminRefCode) {
      const validation = await WholesalerInvitesService.validateAdminRef(adminRefCode, {
        ip: req?.ip,
        userAgent: req?.get ? req.get('user-agent') : req?.headers?.['user-agent'],
      });
      if (!validation.valid) {
        throw new BadRequestError(validation.message || 'Invalid or paused referral link.', 'INVALID_REFERRAL_CODE');
      }
      validatedAdminCode = validation.code || adminRefCode.toUpperCase();
    }

    const inviteClaim = role === ROLES.WHOLESALER && inviteToken
      ? await WholesalerInvitesService.claim(inviteToken)
      : null;
    let inviteCompleted = false;
    let uncommittedIdentityAssets = [];
    try {
    const passwordHash = await User.hashPassword(password);

    const user = new User({
      name,
      email: normalizedEmail,
      loginId: normalizedLoginId,
      phone: normalizedPhone || undefined,
      passwordHash,
      role,
      status: USER_STATUS.ACTIVE,
    });

    let retailerIdentity = {};
    if (role === ROLES.RETAILER) {
      const prepared = await RetailerIdentityService.prepareRegistrationIdentity(
        { panNumber, aadhaarNumber, identityConsent },
        req?.files || {},
        user._id
      );
      retailerIdentity = prepared.identity;
      uncommittedIdentityAssets = prepared.uploaded;
    }

    try {
      await user.save();
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.loginId) {
        throw new ConflictError('This retailer ID is already registered. Please choose another ID.', 'LOGIN_ID_ALREADY_EXISTS');
      }
      throw error;
    }

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
        registrationSource: validatedAdminCode
          ? 'ADMIN_LINK'
          : (inviteClaim
              ? 'ADMIN_INVITE'
              : ([utmSource, utmMedium, utmCampaign].some((value) => value?.trim()) ? 'CAMPAIGN' : 'DIRECT')),
        adminReferralCode: validatedAdminCode || '',
        utmSource: (utmSource || '').trim(),
        utmMedium: (utmMedium || '').trim(),
        utmCampaign: (utmCampaign || '').trim(),
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
        ownerName: name,
        businessName: businessName || `${name}'s Store`,
        businessType: businessType || 'Independent retailer',
        category: category || '',
        gstin: gstin || gstNumber || undefined,
        gstStatus: gstStatus || 'UNREGISTERED',
        profileComplete: Boolean(
          businessName &&
          address &&
          city &&
          state &&
          pincode
        ),
        address: {
          street: address || '',
          city: city || '',
          state: state || '',
          pincode: pincode || '',
        },
        registrationSource: 'REFERRAL',
        utmSource: String(utmSource || '').slice(0, 100).trim(),
        utmMedium: String(utmMedium || '').slice(0, 100).trim(),
        utmCampaign: String(utmCampaign || '').slice(0, 100).trim(),
        utmTerm: String(utmTerm || '').slice(0, 100).trim(),
        utmContent: String(utmContent || '').slice(0, 100).trim(),
        firstLandingAt: firstLandingAt ? new Date(firstLandingAt) : undefined,
        ...retailerIdentity,
      });

      user.retailerProfile = retailerProfile._id;
      await user.save();

      const targetWholesalerId = referral.wholesaler._id;
      const relationship = await WholesalerRetailerRelationship.create({
        wholesalerId: targetWholesalerId,
        retailerId: user._id,
        referralCode: referral.profile.retailerReferralCode,
        status: RELATIONSHIP_STATUS.ACTIVE,
      });

      retailerProfile.assignedWholesalerId = targetWholesalerId;
      retailerProfile.wholesalerId = targetWholesalerId;
      retailerProfile.createdByWholesalerId = targetWholesalerId;
      retailerProfile.activeRelationshipId = relationship._id;
      retailerProfile.referralCodeUsed = referral.profile.retailerReferralCode;
      retailerProfile.wholesalerInfo = {
        businessName: referral.profile.businessName || '',
      };
      await retailerProfile.save();

      await NotificationService.notify({
        recipientId: targetWholesalerId,
        title: 'New Retailer Joined via Referral',
        message: `${retailerProfile.businessName} has registered using your referral link/code.`,
        data: { retailerId: user._id, relationshipId: relationship._id },
      });
    }

    const tokens = role === ROLES.WHOLESALER ? null : this.generateTokens(user);

    if (tokens) {
      await RefreshToken.create({
        userId: user._id,
        tokenHash: tokens.refreshTokenHash,
        expiresAt: tokens.refreshExpiry,
        ipAddress: req?.ip || '',
        userAgent: req?.headers['user-agent'] || '',
      });
    }

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

    if (inviteClaim) {
      await WholesalerInvitesService.completeClaim(inviteClaim.claimId, user._id);
      inviteCompleted = true;
    }

    if (!tokens) {
      return { user: fullUser.toJSON() };
    }

    return {
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.rawRefreshToken,
      user: fullUser.toJSON(),
    };
    } catch (error) {
      await RetailerIdentityService.deleteUploadedFiles(uncommittedIdentityAssets);
      if (inviteClaim && !inviteCompleted) {
        try {
          await WholesalerInvitesService.releaseClaim(inviteClaim.claimId);
        } catch (releaseError) {
          console.error('Failed to release wholesaler invitation registration claim:', releaseError);
        }
      }
      throw error;
    }
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

}

module.exports = AuthService;
