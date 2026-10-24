const mongoose = require('mongoose');
const {
  KycApplication,
  KycDocument,
  WholesalerProfile,
  User,
  WholesalerRetailerRelationship,
  Product,
  Order,
  AuditLog,
} = require('../../models');
const { KYC_STATUS, AUDIT_ACTION, ROLES } = require('../../config/constants');
const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} = require('../../utils/errors');
const { parsePagination } = require('../../utils/pagination');
const AuditService = require('../../services/audit.service');
const NotificationService = require('../../services/notification.service');
const StorageService = require('../../services/storage.service');

const maskAccountNumber = (accountNumber) => {
  const value = String(accountNumber || '');
  return value ? `•••• ${value.slice(-4)}` : '';
};

class KycService {
  /**
   * Wholesaler submits or updates KYC application
   */
  static async submitKyc(wholesalerUser, kycData, uploadedFiles = [], req = null) {
    const wholesalerId = wholesalerUser._id;

    let application = await KycApplication.findOne({ wholesalerId });

    if (application && application.status === KYC_STATUS.APPROVED) {
      throw new ConflictError('KYC application is already approved', 'KYC_ALREADY_APPROVED');
    }

    const existingDocuments = application?.documents?.length
      ? await KycDocument.find({ _id: { $in: application.documents } }).select('documentType').lean()
      : [];
    const providedTypes = new Set([
      ...existingDocuments.map((document) => document.documentType),
      ...(uploadedFiles || []).map((file) => req?.body?.[`${file.fieldname}_type`]),
    ]);
    const requiredDocumentTypes = ['PAN_CARD', 'AADHAAR_FRONT', 'AADHAAR_BACK'];
    const missingDocumentTypes = requiredDocumentTypes.filter((type) => !providedTypes.has(type));
    if (missingDocumentTypes.length > 0) {
      throw new BadRequestError(
        'Upload a PAN card image and both front and back Aadhaar images',
        'KYC_DOCUMENTS_REQUIRED'
      );
    }

    // Process uploaded documents
    const documentIds = application ? [...application.documents] : [];

    if (uploadedFiles && uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        const doc = await KycDocument.create({
          wholesalerId,
          documentType: req?.body?.[`${file.fieldname}_type`] || 'OTHER',
          originalName: file.originalname,
          fileKey: file.filename,
          mimeType: file.mimetype,
          fileSize: file.size,
        });
        documentIds.push(doc._id);
      }
    }

    const pan = (kycData.pan || '').trim().toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!pan || !panRegex.test(pan)) {
      throw new BadRequestError('Invalid PAN number format. Please enter a valid 10-character Indian PAN (e.g. ABCDE1234F).', 'INVALID_PAN');
    }

    const pincode = (kycData.pincode || kycData.registeredAddress?.pincode || '').trim();
    if (!pincode || !/^\d{6}$/.test(pincode)) {
      throw new BadRequestError('Invalid PIN code. Please enter a valid 6-digit Indian PIN code.', 'INVALID_PINCODE');
    }

    const accountNumber = (kycData.accountNumber || kycData.bankDetails?.accountNumber || '').trim();
    if (!accountNumber || !/^\d{9,18}$/.test(accountNumber)) {
      throw new BadRequestError('Invalid Bank Account Number. Must be between 9 and 18 numeric digits.', 'INVALID_ACCOUNT_NUMBER');
    }

    const ifscCode = (kycData.ifscCode || kycData.bankDetails?.ifscCode || '').trim().toUpperCase();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscCode || !ifscRegex.test(ifscCode)) {
      throw new BadRequestError('Invalid IFSC code format. Must be a valid 11-character Indian IFSC code (e.g. SBIN0001234 or PUNB0123400).', 'INVALID_IFSC');
    }

    const hasGst = String(kycData.hasGst) === 'true' || kycData.hasGst === true;
    const gstin = hasGst ? (kycData.gstin || kycData.gstNumber || '').trim().toUpperCase() : '';

    if (hasGst) {
      if (!gstin) {
        throw new BadRequestError('GST number is required when GST option is set to Yes', 'GST_REQUIRED');
      }
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(gstin)) {
        throw new BadRequestError('Invalid GSTIN format. Standard Indian GSTIN must be 15 alphanumeric characters (e.g. 22AAAAA0000A1Z5)', 'INVALID_GSTIN');
      }
    }

    const applicationPayload = {
      wholesalerId,
      businessName: kycData.businessName,
      ownerName: kycData.ownerName || wholesalerUser.name,
      businessType: kycData.businessType || 'Proprietorship',
      pan: kycData.pan,
      hasGst,
      gstin: gstin,
      registeredAddress: kycData.registeredAddress || {
        street: kycData.address || '',
        city: kycData.city || '',
        state: kycData.state || '',
        pincode: kycData.pincode || '',
      },
      bankDetails: kycData.bankDetails || {
        accountHolderName: kycData.accountHolderName || '',
        accountNumber: kycData.accountNumber || '',
        ifscCode: kycData.ifscCode || '',
        bankName: kycData.bankName || '',
        branch: kycData.branch || '',
      },
      documents: documentIds,
      status: KYC_STATUS.SUBMITTED,
      submittedAt: new Date(),
    };

    if (application) {
      Object.assign(application, applicationPayload);
      application.history.push({
        fromStatus: application.status,
        toStatus: KYC_STATUS.SUBMITTED,
        reason: 'Wholesaler resubmitted KYC application',
        changedBy: wholesalerId,
        changedAt: new Date(),
      });
      await application.save();
    } else {
      application = await KycApplication.create(applicationPayload);
    }

    // Update wholesaler profile
    await WholesalerProfile.findOneAndUpdate(
      { userId: wholesalerId },
      {
        businessName: kycData.businessName,
        businessType: applicationPayload.businessType,
        hasGst,
        gstin: gstin,
        gstStatus: hasGst ? 'REGISTERED' : 'UNREGISTERED',
        pan: kycData.pan,
        address: applicationPayload.registeredAddress,
        bankDetails: applicationPayload.bankDetails,
        kycStatus: KYC_STATUS.SUBMITTED,
        kycApplicationId: application._id,
      }
    );

    await AuditService.log({
      actorId: wholesalerId,
      actorRole: wholesalerUser.role,
      action: AUDIT_ACTION.CREATE,
      entityType: 'KycApplication',
      entityId: application._id,
      after: { status: KYC_STATUS.SUBMITTED },
      req,
    });

    await NotificationService.notifyAdmins({
      title: 'New KYC Application Submitted',
      message: `${kycData.businessName} has submitted their KYC application for verification.`,
      data: { kycId: application._id, wholesalerId },
    });

    return application;
  }

  /**
   * Wholesaler fetches their own KYC application
   */
  static async getWholesalerKyc(wholesalerUser) {
    const application = await KycApplication.findOne({ wholesalerId: wholesalerUser._id }).populate(
      'documents'
    );
    return application || { status: KYC_STATUS.DRAFT };
  }

  /**
   * Super Admin lists all KYC applications
   */
  static async listKycApplications(query = {}) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};

    if (query.status && query.status !== 'all') {
      if (query.status === 'PENDING') {
        filter.status = { $in: [KYC_STATUS.SUBMITTED, KYC_STATUS.UNDER_REVIEW, 'PENDING'] };
      } else if (
        query.status === 'RESUBMISSION_REQUIRED' ||
        query.status === 'RESUBMIT_REQUESTED'
      ) {
        filter.status = {
          $in: [KYC_STATUS.RESUBMIT_REQUESTED, KYC_STATUS.RESUBMISSION_REQUIRED],
        };
      } else {
        filter.status = query.status;
      }
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [{ businessName: searchRegex }, { ownerName: searchRegex }, { pan: searchRegex }, { gstin: searchRegex }];
    }

    const [applications, total] = await Promise.all([
      KycApplication.find(filter)
        .select('_id businessName ownerName pan gstin status submittedAt wholesalerId documents')
        .populate('wholesalerId', 'name email phone status')
        .populate('documents', 'documentType originalName mimeType fileSize createdAt')
        .populate('reviewedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      KycApplication.countDocuments(filter),
    ]);

    return {
      applications,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Super Admin gets single KYC application details with full wholesaler profile and activity
   */
  static async getKycById(kycId, requestingUser = null, req = null) {
    if (!mongoose.Types.ObjectId.isValid(kycId)) {
      throw new NotFoundError('KYC Application not found');
    }

    const application = await KycApplication.findById(kycId)
      .populate('wholesalerId', 'name email phone status lastLoginAt createdAt')
      .populate('documents', 'documentType originalName mimeType fileSize createdAt updatedAt')
      .populate('reviewedBy', 'name email')
      .populate('history.changedBy', 'name email role');

    if (!application) {
      throw new NotFoundError('KYC Application not found');
    }

    const wholesalerUserId = application.wholesalerId?._id || application.wholesalerId;

    const [wholesalerProfile, linkedRetailersCount, productsCount, ordersCount, auditLogs] = await Promise.all([
      WholesalerProfile.findOne({ userId: wholesalerUserId })
        .select('businessName businessType address pickupAddress bankDetails registrationSource adminReferralCode retailerReferralCode hasGst gstin pan kycStatus isVerified createdAt')
        .lean(),
      WholesalerRetailerRelationship.countDocuments({ wholesalerId: wholesalerUserId }),
      Product.countDocuments({ wholesalerId: wholesalerUserId, isDeleted: { $ne: true } }),
      Order.countDocuments({ wholesalerId: wholesalerUserId }),
      AuditLog.find({
        entityId: String(application._id),
        action: {
          $in: [
            AUDIT_ACTION.CREATE,
            AUDIT_ACTION.KYC_APPROVED,
            AUDIT_ACTION.KYC_REJECTED,
            AUDIT_ACTION.KYC_RESUBMISSION_REQUESTED,
            AUDIT_ACTION.KYC_VIEWED,
          ],
        },
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('actorId', 'name email role')
        .lean(),
    ]);

    if (requestingUser) {
      await AuditService.log({
        actorId: requestingUser._id,
        actorRole: requestingUser.role,
        action: AUDIT_ACTION.KYC_VIEWED,
        entityType: 'KycApplication',
        entityId: String(application._id),
        metadata: {
          businessName: application.businessName,
          wholesalerId: wholesalerUserId,
        },
        req,
      });
    }

    const responseData = application.toObject();
    responseData.profile = wholesalerProfile || {};
    responseData.stats = {
      linkedRetailersCount: linkedRetailersCount || 0,
      productsCount: productsCount || 0,
      ordersCount: ordersCount || 0,
    };
    responseData.auditLogs = auditLogs || [];
    if (responseData.bankDetails) {
      responseData.bankDetails.accountNumber = maskAccountNumber(
        responseData.bankDetails.accountNumber
      );
    }
    if (responseData.profile.bankDetails) {
      responseData.profile.bankDetails.accountNumber = maskAccountNumber(
        responseData.profile.bankDetails.accountNumber
      );
    }

    if (responseData.wholesalerId && typeof responseData.wholesalerId === 'object') {
      delete responseData.wholesalerId.passwordHash;
      delete responseData.wholesalerId.resetPasswordTokenHash;
      delete responseData.wholesalerId.resetPasswordExpires;
    }

    return responseData;
  }

  /**
   * Super Admin Approves KYC
   */
  static async approveKyc(kycId, adminUser, req = null) {
    const application = await KycApplication.findById(kycId);
    if (!application) {
      throw new NotFoundError('KYC Application not found');
    }

    const previousStatus = application.status;
    application.status = KYC_STATUS.APPROVED;
    application.reviewedBy = adminUser._id;
    application.reviewedAt = new Date();
    application.reviewReason = 'Verified and Approved';
    application.reviewNote = 'Verified and Approved';
    application.history.push({
      fromStatus: previousStatus,
      toStatus: KYC_STATUS.APPROVED,
      reason: 'Approved by Super Admin',
      changedBy: adminUser._id,
      changedAt: new Date(),
    });
    await application.save();

    // Mark Wholesaler Profile and User as active & verified
    await WholesalerProfile.findOneAndUpdate(
      { userId: application.wholesalerId },
      { kycStatus: KYC_STATUS.APPROVED, isVerified: true }
    );

    await User.findByIdAndUpdate(application.wholesalerId, { status: 'ACTIVE' });

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.KYC_APPROVED,
      entityType: 'KycApplication',
      entityId: application._id,
      before: { status: previousStatus },
      after: { status: KYC_STATUS.APPROVED, reviewedBy: adminUser._id },
      req,
    });

    await NotificationService.notify({
      recipientId: application.wholesalerId,
      title: 'KYC Application Approved 🎉',
      message: 'Congratulations! Your KYC application has been approved. You can now publish products, invite retailers, and receive orders.',
      data: { kycId: application._id, status: KYC_STATUS.APPROVED },
    });

    return application;
  }

  /**
   * Super Admin Rejects KYC
   */
  static async rejectKyc(kycId, reason, adminUser, req = null) {
    if (!reason) {
      throw new BadRequestError('A reason is required to reject a KYC application');
    }

    const application = await KycApplication.findById(kycId);
    if (!application) {
      throw new NotFoundError('KYC Application not found');
    }

    const previousStatus = application.status;
    application.status = KYC_STATUS.REJECTED;
    application.reviewedBy = adminUser._id;
    application.reviewedAt = new Date();
    application.reviewReason = reason;
    application.reviewNote = reason;
    application.history.push({
      fromStatus: previousStatus,
      toStatus: KYC_STATUS.REJECTED,
      reason,
      changedBy: adminUser._id,
      changedAt: new Date(),
    });
    await application.save();

    await WholesalerProfile.findOneAndUpdate(
      { userId: application.wholesalerId },
      { kycStatus: KYC_STATUS.REJECTED }
    );

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.KYC_REJECTED,
      entityType: 'KycApplication',
      entityId: application._id,
      before: { status: previousStatus },
      after: { status: KYC_STATUS.REJECTED, reason, reviewedBy: adminUser._id },
      metadata: { reason },
      req,
    });

    await NotificationService.notify({
      recipientId: application.wholesalerId,
      title: 'KYC Application Rejected',
      message: `Your KYC application was rejected. Reason: ${reason}`,
      data: { kycId: application._id, status: KYC_STATUS.REJECTED, reason },
    });

    return application;
  }

  /**
   * Super Admin Requests KYC Resubmission
   */
  static async requestResubmission(kycId, reason, adminUser, req = null, documentsToResubmit = []) {
    if (!reason) {
      throw new BadRequestError('A reason is required to request KYC resubmission');
    }

    const application = await KycApplication.findById(kycId);
    if (!application) {
      throw new NotFoundError('KYC Application not found');
    }

    const previousStatus = application.status;
    application.status = KYC_STATUS.RESUBMIT_REQUESTED;
    application.reviewedBy = adminUser._id;
    application.reviewedAt = new Date();
    application.reviewReason = reason;
    application.reviewNote = reason;
    application.history.push({
      fromStatus: previousStatus,
      toStatus: KYC_STATUS.RESUBMIT_REQUESTED,
      reason,
      changedBy: adminUser._id,
      changedAt: new Date(),
    });
    await application.save();

    await WholesalerProfile.findOneAndUpdate(
      { userId: application.wholesalerId },
      { kycStatus: KYC_STATUS.RESUBMIT_REQUESTED }
    );

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.KYC_RESUBMISSION_REQUESTED,
      entityType: 'KycApplication',
      entityId: application._id,
      before: { status: previousStatus },
      after: { status: KYC_STATUS.RESUBMIT_REQUESTED, reason },
      metadata: { reason, documentsToResubmit },
      req,
    });

    await NotificationService.notify({
      recipientId: application.wholesalerId,
      title: 'KYC Resubmission Required',
      message: `Please update and resubmit your KYC details. Reason: ${reason}`,
      data: { kycId: application._id, status: KYC_STATUS.RESUBMIT_REQUESTED, reason, documentsToResubmit },
    });

    return application;
  }

  /**
   * Securely stream KYC document with role/ownership authorization check
   */
  static async getDocumentFile(documentId, requestingUser, req = null) {
    const doc = await KycDocument.findById(documentId);
    if (!doc) {
      throw new NotFoundError('Document not found');
    }

    // Check authorization: Must be Super Admin / Admin or the owning wholesaler
    const isOwner = String(doc.wholesalerId) === String(requestingUser._id);
    const isAdmin = [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(requestingUser.role);

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('You do not have permission to access this document');
    }

    if (isAdmin) {
      await AuditService.log({
        actorId: requestingUser._id,
        actorRole: requestingUser.role,
        action: AUDIT_ACTION.KYC_DOCUMENT_VIEWED,
        entityType: 'KycDocument',
        entityId: String(doc._id),
        metadata: {
          documentType: doc.documentType,
          originalName: doc.originalName,
          wholesalerId: doc.wholesalerId,
        },
        req,
      });
    }

    const filePath = StorageService.getFilePath('kyc', doc.fileKey);
    return { filePath, mimeType: doc.mimeType, originalName: doc.originalName };
  }
}

module.exports = KycService;
