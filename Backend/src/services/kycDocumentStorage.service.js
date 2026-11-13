const fs = require('fs');
const mongoose = require('mongoose');
const { pipeline } = require('stream/promises');
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
  static async store(file) {
    const bucket = getBucket();
    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype,
      metadata: { kind: 'kyc-document' },
    });

    try {
      await pipeline(fs.createReadStream(file.path), uploadStream);
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
    await Promise.all(files.filter((file) => file.path).map(async (file) => {
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
