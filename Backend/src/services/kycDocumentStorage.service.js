const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const logger = require('../config/logger');
const { NotFoundError } = require('../utils/errors');

const BUCKET_NAME = 'kycDocuments';

function getBucket() {
  if (!mongoose.connection.db) {
    throw new Error('KYC document storage is unavailable before the database connects');
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
}

function getFileId(fileKey) {
  if (!mongoose.Types.ObjectId.isValid(fileKey)) {
    throw new NotFoundError('KYC document is not available in persistent storage');
  }
  return new mongoose.Types.ObjectId(fileKey);
}

class KycDocumentStorageService {
  /**
   * Stores an uploaded file (memory buffer or disk path) directly into GridFS
   */
  static async store(file) {
    const bucket = getBucket();
    const originalName = file.originalname || 'kyc-document';
    const mimeType = file.mimetype || 'application/octet-stream';
    const uploadStream = bucket.openUploadStream(originalName, {
      contentType: mimeType,
      metadata: { kind: 'kyc-document' },
    });

    try {
      if (file.buffer) {
        await pipeline(Readable.from(file.buffer), uploadStream);
      } else if (file.path) {
        await pipeline(fs.createReadStream(file.path), uploadStream);
      } else {
        throw new Error('No file buffer or path provided for KYC document storage');
      }
    } catch (error) {
      try {
        if (await bucket.find({ _id: uploadStream.id }).hasNext()) {
          await bucket.delete(uploadStream.id);
        }
      } catch (cleanupError) {
        logger.error('Unable to remove incomplete KYC document upload', {
          fileId: String(uploadStream.id),
          error: cleanupError.message,
        });
      }
      throw error;
    }

    return String(uploadStream.id);
  }

  /**
   * Stores a legacy file from disk into GridFS
   */
  static async storeLegacyFile(filePath, originalName = 'legacy-document', mimeType = 'application/octet-stream') {
    const bucket = getBucket();
    const uploadStream = bucket.openUploadStream(originalName, {
      contentType: mimeType,
      metadata: { kind: 'kyc-document', source: 'legacy-migration' },
    });

    try {
      await pipeline(fs.createReadStream(filePath), uploadStream);
    } catch (error) {
      try {
        if (await bucket.find({ _id: uploadStream.id }).hasNext()) {
          await bucket.delete(uploadStream.id);
        }
      } catch (cleanupError) {
        logger.error('Unable to remove incomplete legacy KYC upload', {
          fileId: String(uploadStream.id),
          error: cleanupError.message,
        });
      }
      throw error;
    }

    return String(uploadStream.id);
  }

  /**
   * Finds the disk file for a legacy KYC document from tracked legacy folders
   */
  static findLegacyFilePath(doc) {
    if (!doc) return null;
    const env = require('../config/env');

    const searchDirs = [
      path.resolve(__dirname, '../../legacy-kyc-files'),
      path.resolve(__dirname, '../../uploads/kyc'),
      path.resolve(process.cwd(), 'legacy-kyc-files'),
      path.resolve(process.cwd(), 'Backend/legacy-kyc-files'),
      path.resolve(process.cwd(), 'uploads/kyc'),
      path.resolve(process.cwd(), 'Backend/uploads/kyc'),
      env.UPLOAD_PATH ? path.join(env.UPLOAD_PATH, 'kyc') : null,
    ].filter(Boolean);

    // 1. Direct match by filename from doc.fileKey
    if (doc.fileKey) {
      const baseFilename = path.basename(doc.fileKey);
      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        const candidate = path.join(dir, baseFilename);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }

    // 2. Direct match by originalName
    if (doc.originalName) {
      const baseOriginal = path.basename(doc.originalName);
      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        const candidate = path.join(dir, baseOriginal);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }

    // 3. Fallback match by exact fileSize and extension in legacy-kyc-files
    if (doc.fileSize && typeof doc.fileSize === 'number') {
      const ext = doc.originalName
        ? path.extname(doc.originalName).toLowerCase()
        : (doc.fileKey && doc.fileKey.includes('.') ? path.extname(doc.fileKey).toLowerCase() : '');
      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        try {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.size === doc.fileSize) {
              if (!ext || path.extname(file).toLowerCase() === ext) {
                return filePath;
              }
            }
          }
        } catch {
          // ignore directory read errors
        }
      }
    }

    return null;
  }

  /**
   * Migrates all legacy disk KYC documents into GridFS
   */
  static async migrateLegacyDocuments() {
    try {
      const KycDocument = require('../models/KycDocument');
      const bucket = getBucket();
      const allDocs = await KycDocument.find({});

      if (!allDocs.length) {
        logger.info('[KYC Migration] No KYC documents in database to verify/migrate');
        return;
      }

      logger.info(`[KYC Migration] Checking ${allDocs.length} documents for GridFS persistence`);
      let migratedCount = 0;
      let alreadyInGridCount = 0;
      let missingCount = 0;

      for (const doc of allDocs) {
        let isPersisted = false;

        if (!doc.fileUrl) {
          doc.fileUrl = `/api/v1/kyc/documents/${doc._id}`;
        }

        if (doc.storageProvider === 'GRIDFS' && doc.fileKey) {
          try {
            const fileId = getFileId(doc.fileKey);
            const exists = await bucket.find({ _id: fileId }).hasNext();
            if (exists) {
              isPersisted = true;
              alreadyInGridCount++;
            }
          } catch {
            isPersisted = false;
          }
        }

        if (!isPersisted) {
          const legacyPath = KycDocumentStorageService.findLegacyFilePath(doc);
          if (legacyPath) {
            try {
              const newFileKey = await KycDocumentStorageService.storeLegacyFile(
                legacyPath,
                doc.originalName || 'legacy-kyc-document',
                doc.mimeType || 'application/octet-stream'
              );
              doc.fileKey = newFileKey;
              doc.storageProvider = 'GRIDFS';
              doc.fileUrl = `/api/v1/kyc/documents/${doc._id}`;
              await doc.save();
              migratedCount++;
              logger.info(`[KYC Migration] Migrated doc ${doc._id} (${doc.originalName}) to GridFS fileKey: ${newFileKey}`);
            } catch (migrateErr) {
              logger.error(`[KYC Migration] Failed migrating doc ${doc._id}: ${migrateErr.message}`);
            }
          } else {
            missingCount++;
            logger.warn(`[KYC Migration] Could not locate legacy disk file for doc ${doc._id} (fileKey: ${doc.fileKey})`);
          }
        }
      }

      logger.info(`[KYC Migration Summary] Migrated: ${migratedCount}, Already GridFS: ${alreadyInGridCount}, Missing: ${missingCount}`);
    } catch (err) {
      logger.error(`[KYC Migration] Unexpected error during migration: ${err.message}`);
    }
  }

  static async openReadStream(fileKey) {
    const bucket = getBucket();
    const fileId = getFileId(fileKey);
    const [file] = await bucket.find({ _id: fileId }).toArray();
    if (!file) {
      throw new NotFoundError('KYC document file is missing from persistent storage');
    }

    return {
      stream: bucket.openDownloadStream(fileId),
      mimeType: file.contentType || 'application/octet-stream',
    };
  }

  static async delete(fileKey) {
    const bucket = getBucket();
    const fileId = getFileId(fileKey);
    if (await bucket.find({ _id: fileId }).hasNext()) {
      await bucket.delete(fileId);
    }
  }

  static async removeTemporaryUploads(files = []) {
    await Promise.all((files || []).filter((file) => file && file.path).map(async (file) => {
      try {
        await fs.promises.unlink(file.path);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.error('Unable to remove temporary KYC upload', {
            path: file.path,
            error: error.message,
          });
        }
      }
    }));
  }
}

module.exports = KycDocumentStorageService;