const crypto = require('crypto');
const https = require('https');
const path = require('path');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const env = require('../config/env');
const {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  InternalServerError,
} = require('../utils/errors');
const { User, RetailerProfile, WholesalerRetailerRelationship } = require('../models');
const { encryptIdentityNumber, decryptIdentityNumber } = require('../utils/retailerIdentityCrypto');
const AuditService = require('./audit.service');
const { ROLES } = require('../config/constants');

const FILES = [
  { name: 'shopPhoto', maxCount: 1 },
  { name: 'panImage', maxCount: 1 },
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
];
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_TYPES = new Set([...IMAGE_TYPES, 'application/pdf']);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const identityUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 4 },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const typeMatchesExtension = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
    };
    const isShopPhoto = file.fieldname === 'shopPhoto';
    const expectedTypes = isShopPhoto ? IMAGE_TYPES : ALLOWED_TYPES;
    if (!expectedTypes.has(file.mimetype) || !typeMatchesExtension[file.mimetype]?.includes(extension)) {
      return callback(new BadRequestError(
        'Upload JPG, JPEG, PNG, WEBP, or PDF files up to 5 MB.',
        'INVALID_IDENTITY_FILE'
      ));
    }
    return callback(null, true);
  },
}).fields(FILES);

function detectFileType(file, fieldName) {
  const { buffer } = file;
  let detected;
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    detected = 'image/jpeg';
  } else if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    detected = 'image/png';
  } else if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    detected = 'image/webp';
  } else if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') {
    detected = 'application/pdf';
  }

  if (
    !detected ||
    detected !== file.mimetype ||
    (fieldName === 'shopPhoto' && !IMAGE_TYPES.has(detected))
  ) {
    throw new BadRequestError(
      'The uploaded file content does not match an allowed image or PDF type.',
      'INVALID_IDENTITY_FILE_CONTENT'
    );
  }
  return detected;
}

function getCloudinary() {
  env.assertCloudinaryConfigured();
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

function hasIdentityData(body = {}, files = {}) {
  return Boolean(
    body.panNumber ||
    body.aadhaarNumber ||
    files.panImage?.length ||
    files.aadhaarFront?.length ||
    files.aadhaarBack?.length
  );
}

function consentAccepted(value) {
  return value === true || value === 'true';
}

class RetailerIdentityService {
  static async uploadOne(file, retailerId, fieldName) {
    const mimeType = detectFileType(file, fieldName);
    const resourceType = mimeType === 'application/pdf' ? 'raw' : 'image';
    const publicId = `retailer-identity/${retailerId}/${crypto.randomUUID()}`;
    return new Promise((resolve, reject) => {
      getCloudinary().uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: resourceType,
          type: 'authenticated',
          access_mode: 'authenticated',
          overwrite: false,
          use_filename: false,
          format: path.extname(file.originalname).slice(1).toLowerCase(),
        },
        (error, result) => {
          if (error) return reject(new InternalServerError('Unable to securely store the uploaded document.', 'IDENTITY_UPLOAD_FAILED'));
          return resolve({
            imageUrl: result.secure_url,
            publicId: result.public_id,
            resourceType,
            format: result.format || path.extname(file.originalname).slice(1).toLowerCase(),
          });
        }
      ).end(file.buffer);
    });
  }

  static async deleteUploadedFiles(documents = []) {
    for (const document of documents) {
      if (!document?.publicId) continue;
      try {
        await getCloudinary().uploader.destroy(document.publicId, {
          resource_type: document.resourceType,
          type: 'authenticated',
          invalidate: true,
        });
      } catch (error) {
        require('../config/logger').error('Unable to remove an uncommitted retailer identity upload', {
          error: error.message,
        });
      }
    }
  }

  static async prepareRegistrationIdentity(payload, files, retailerId) {
    const panNumber = String(payload.panNumber || '').trim().toUpperCase();
    const aadhaarNumber = String(payload.aadhaarNumber || '').trim();
    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) {
      throw new BadRequestError('Invalid PAN number format.', 'INVALID_PAN');
    }
    if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) {
      throw new BadRequestError('Aadhaar number must contain exactly 12 digits.', 'INVALID_AADHAAR');
    }
    const accepted = consentAccepted(payload.identityConsent);
    if ((hasIdentityData(payload, files) || files?.shopPhoto?.length) && !accepted) {
      throw new BadRequestError(
        'Please accept the identity verification consent before saving PAN or Aadhaar details.',
        'IDENTITY_CONSENT_REQUIRED'
      );
    }

    const uploaded = [];
    const identity = {
      consent: { accepted, at: accepted ? new Date() : null },
      verificationStatus: 'NOT_SUBMITTED',
    };
    try {
      for (const [fieldName, fieldFiles] of Object.entries(files || {})) {
        if (!fieldFiles?.[0]) continue;
        const asset = await this.uploadOne(fieldFiles[0], retailerId, fieldName);
        uploaded.push(asset);
        if (fieldName === 'shopPhoto') identity.shopPhoto = asset;
        if (fieldName === 'panImage') identity.pan = { ...(identity.pan || {}), ...asset };
        if (fieldName === 'aadhaarFront') identity.aadhaar = { ...(identity.aadhaar || {}), frontImage: asset };
        if (fieldName === 'aadhaarBack') identity.aadhaar = { ...(identity.aadhaar || {}), backImage: asset };
      }

      if (panNumber) {
        identity.pan = {
          ...(identity.pan || {}),
          numberEncrypted: encryptIdentityNumber(panNumber),
          last4: panNumber.slice(-4),
        };
      }

      if (aadhaarNumber) {
        identity.aadhaar = {
          ...(identity.aadhaar || {}),
          numberEncrypted: encryptIdentityNumber(aadhaarNumber),
          last4: aadhaarNumber.slice(-4),
        };
      }

      if (accepted && hasIdentityData(payload, files)) {
        identity.verificationStatus = 'SUBMITTED';
      }
      return { identity, uploaded };
    } catch (error) {
      await this.deleteUploadedFiles(uploaded);
      throw error;
    }
  }

  static async updateIdentity(retailerId, body, files) {
    const profile = await RetailerProfile.findOne({ userId: retailerId, isDeleted: false });
    if (!profile) throw new NotFoundError('Retailer profile not found');

    const accepted = consentAccepted(body.identityConsent);
    const panNumber = body.panNumber === undefined ? '' : String(body.panNumber).trim().toUpperCase();
    const aadhaarNumber = body.aadhaarNumber === undefined ? '' : String(body.aadhaarNumber).trim();
    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) {
      throw new BadRequestError('Invalid PAN number format.', 'INVALID_PAN');
    }
    if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) {
      throw new BadRequestError('Aadhaar number must contain exactly 12 digits.', 'INVALID_AADHAAR');
    }
    if ((hasIdentityData(body, files) || files?.shopPhoto?.length) && !accepted) {
      throw new BadRequestError(
        'Please accept the identity verification consent before saving PAN or Aadhaar details.',
        'IDENTITY_CONSENT_REQUIRED'
      );
    }

    const uploaded = [];
    const oldAssets = [];
    try {
      profile.pan = profile.pan || {};
      profile.aadhaar = profile.aadhaar || {};
      profile.shopPhoto = profile.shopPhoto || {};
      for (const [fieldName, fieldFiles] of Object.entries(files || {})) {
        if (!fieldFiles?.[0]) continue;
        const asset = await this.uploadOne(fieldFiles[0], retailerId, fieldName);
        uploaded.push(asset);
        if (fieldName === 'shopPhoto') {
          if (profile.shopPhoto?.publicId) oldAssets.push(profile.shopPhoto);
          profile.shopPhoto = asset;
        } else if (fieldName === 'panImage') {
          if (profile.pan?.publicId) oldAssets.push(profile.pan);
          profile.pan = { ...(profile.pan?.toObject?.() || profile.pan?.toJSON?.() || profile.pan || {}), ...asset };
        } else if (fieldName === 'aadhaarFront') {
          if (profile.aadhaar?.frontImage?.publicId) oldAssets.push(profile.aadhaar.frontImage);
          profile.aadhaar.frontImage = asset;
        } else if (fieldName === 'aadhaarBack') {
          if (profile.aadhaar?.backImage?.publicId) oldAssets.push(profile.aadhaar.backImage);
          profile.aadhaar.backImage = asset;
        }
      }

      if (panNumber) {
        profile.pan.numberEncrypted = encryptIdentityNumber(panNumber);
        profile.pan.last4 = panNumber.slice(-4);
      }
      if (aadhaarNumber) {
        profile.aadhaar.numberEncrypted = encryptIdentityNumber(aadhaarNumber);
        profile.aadhaar.last4 = aadhaarNumber.slice(-4);
      }

      if (accepted) {
        profile.consent = { accepted: true, at: new Date() };
        if (hasIdentityData(body, files)) profile.verificationStatus = 'SUBMITTED';
      }
      await profile.save();
      await this.deleteUploadedFiles(oldAssets);
      return this.formatIdentity(profile, { includePan: true });
    } catch (error) {
      await this.deleteUploadedFiles(uploaded);
      throw error;
    }
  }

  static formatIdentity(profile, { includePan = false } = {}) {
    const identityDocumentsSubmitted = Boolean(
      profile.pan?.numberEncrypted ||
      profile.pan?.publicId ||
      profile.aadhaar?.numberEncrypted ||
      profile.aadhaar?.frontImage?.publicId ||
      profile.aadhaar?.backImage?.publicId
    );
    return {
      pan: {
        number: includePan ? decryptIdentityNumber(profile.pan?.numberEncrypted) : '',
        last4: profile.pan?.last4 || '',
        hasImage: Boolean(profile.pan?.publicId),
      },
      aadhaar: {
        last4: profile.aadhaar?.last4 || '',
        hasFrontImage: Boolean(profile.aadhaar?.frontImage?.publicId),
        hasBackImage: Boolean(profile.aadhaar?.backImage?.publicId),
      },
      shopPhoto: { hasImage: Boolean(profile.shopPhoto?.publicId) },
      consent: { accepted: Boolean(profile.consent?.accepted), at: profile.consent?.at || null },
      verificationStatus: profile.verificationStatus || 'NOT_SUBMITTED',
      verificationNote: profile.verificationNote || '',
      documentsSubmitted: identityDocumentsSubmitted,
    };
  }

  static async assertAccess(retailerId, requester) {
    if (requester.role === ROLES.RETAILER && String(requester._id) === String(retailerId)) return;
    if (requester.role === ROLES.SUPER_ADMIN) return;
    if (requester.role === ROLES.WHOLESALER) {
      const relationship = await WholesalerRetailerRelationship.findOne({
        retailerId,
        wholesalerId: requester._id,
        status: 'ACTIVE',
      }).select('_id').lean();
      if (relationship) return;
    }
    throw new ForbiddenError('You are not allowed to access this retailer profile.', 'RETAILER_IDENTITY_FORBIDDEN');
  }

  static async getIdentityProfile(retailerId, requester) {
    await this.assertAccess(retailerId, requester);
    const profile = await RetailerProfile.findOne({ userId: retailerId, isDeleted: false }).lean();
    if (!profile) throw new NotFoundError('Retailer profile not found');
    return this.formatIdentity(profile, { includePan: true });
  }

  static async revealAadhaar(retailerId, requester, req) {
    if (requester.role === ROLES.RETAILER && String(requester._id) !== String(retailerId)) {
      throw new ForbiddenError('You are not allowed to access this retailer profile.', 'RETAILER_IDENTITY_FORBIDDEN');
    }
    await this.assertAccess(retailerId, requester);
    const profile = await RetailerProfile.findOne({ userId: retailerId, isDeleted: false }).lean();
    if (!profile?.aadhaar?.numberEncrypted) throw new NotFoundError('Aadhaar number has not been provided');
    const auditEntry = await AuditService.log({
      actorId: requester._id,
      actorRole: requester.role,
      action: 'VIEW_SENSITIVE_IDENTITY',
      entityType: 'RetailerProfile',
      entityId: retailerId,
      metadata: { identityField: 'aadhaar' },
      req,
    });
    if (!auditEntry) {
      throw new InternalServerError('The Aadhaar access could not be recorded. Please try again.', 'IDENTITY_AUDIT_FAILED');
    }
    return { number: decryptIdentityNumber(profile.aadhaar.numberEncrypted) };
  }

  static async updateVerification(retailerId, requester, status, note, req) {
    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      throw new BadRequestError('Verification status must be Verified or Rejected.', 'INVALID_VERIFICATION_STATUS');
    }
    if (status === 'REJECTED' && !String(note || '').trim()) {
      throw new BadRequestError('Add a note explaining which documents need to be re-uploaded.', 'VERIFICATION_NOTE_REQUIRED');
    }
    await this.assertAccess(retailerId, requester);
    const profile = await RetailerProfile.findOneAndUpdate(
      { userId: retailerId, isDeleted: false, verificationStatus: 'SUBMITTED' },
      { verificationStatus: status, verificationNote: String(note || '').trim().slice(0, 1000) },
      { new: true, runValidators: true }
    );
    if (!profile) {
      const exists = await RetailerProfile.exists({ userId: retailerId, isDeleted: false });
      if (!exists) throw new NotFoundError('Retailer profile not found');
      throw new BadRequestError('Only submitted retailer details can be verified or rejected.', 'RETAILER_IDENTITY_NOT_SUBMITTED');
    }
    await AuditService.log({
      actorId: requester._id,
      actorRole: requester.role,
      action: 'UPDATE',
      entityType: 'RetailerIdentityVerification',
      entityId: retailerId,
      after: { verificationStatus: status, note: String(note || '').trim().slice(0, 1000) },
      req,
    });
    return { verificationStatus: profile.verificationStatus, verificationNote: profile.verificationNote };
  }

  static async streamDocument(retailerId, documentType, requester, req, res) {
    await this.assertAccess(retailerId, requester);
    const profile = await RetailerProfile.findOne({ userId: retailerId, isDeleted: false }).lean();
    if (!profile) throw new NotFoundError('Retailer profile not found');

    const documentMap = {
      'shop-photo': profile.shopPhoto,
      pan: profile.pan,
      'aadhaar-front': profile.aadhaar?.frontImage,
      'aadhaar-back': profile.aadhaar?.backImage,
    };
    const document = documentMap[documentType];
    if (!document?.publicId || !document?.resourceType || !document?.format) {
      throw new NotFoundError('Document not found');
    }
    if (documentType !== 'shop-photo' && !profile.consent?.accepted) {
      throw new ForbiddenError('The retailer has not consented to sharing identity documents.', 'IDENTITY_CONSENT_REQUIRED');
    }
    const auditEntry = await AuditService.log({
      actorId: requester._id,
      actorRole: requester.role,
      action: 'VIEW_DOCUMENT',
      entityType: 'RetailerProfile',
      entityId: retailerId,
      metadata: { documentType },
      req,
    });
    if (!auditEntry) {
      throw new InternalServerError('The document access could not be recorded. Please try again.', 'IDENTITY_AUDIT_FAILED');
    }

    const client = getCloudinary();
    const downloadUrl = client.utils.private_download_url(document.publicId, document.format, {
      resource_type: document.resourceType,
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 60,
      attachment: false,
    });
    await new Promise((resolve, reject) => {
      const request = https.get(downloadUrl, (upstream) => {
        if (upstream.statusCode !== 200) {
          upstream.resume();
          reject(new InternalServerError('Unable to retrieve the private retailer document.', 'IDENTITY_DOCUMENT_RETRIEVAL_FAILED'));
          return;
        }
        const mimeType = document.format === 'pdf'
          ? 'application/pdf'
          : ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[document.format] || 'application/octet-stream');
        res.set({
          'Content-Type': mimeType,
          'Content-Disposition': `inline; filename="${documentType}.${document.format}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        upstream.on('error', reject);
        upstream.on('end', resolve);
        upstream.pipe(res);
      });
      request.on('error', reject);
      res.on('close', () => request.destroy());
    });
  }
}

module.exports = {
  RetailerIdentityService,
  identityUpload,
  detectFileType,
  hasIdentityData,
  consentAccepted,
};
