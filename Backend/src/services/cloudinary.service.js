const { v2: cloudinary } = require('cloudinary');
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
const env = require('../config/env');
const { BadRequestError } = require('../utils/errors');

let configured = false;

function getClient() {
  env.assertCloudinaryConfigured();
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

function uploadProductImage(file, req = null) {
  if (!file?.buffer) throw new Error('Product image data is missing.');

  const hasCloudinary = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  if (hasCloudinary) {
    return new Promise((resolve, reject) => {
      getClient().uploader.upload_stream(
        {
          folder: 'wholesaler/products',
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        },
        (error, result) => {
          if (error) return reject(error);
          return resolve({ url: result.secure_url, publicId: result.public_id });
        },
      ).end(file.buffer);
    });
  }

  // Fallback to MongoDB GridFS productImages bucket
  return new Promise((resolve, reject) => {
    try {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'productImages' });
      const filename = file.originalname || `product-${Date.now()}.jpg`;
      const uploadStream = bucket.openUploadStream(filename, {
        contentType: file.mimetype || 'image/jpeg',
        metadata: { kind: 'product-image' },
      });
      uploadStream.on('error', reject);
      uploadStream.on('finish', () => {
        const host = req ? `${req.protocol}://${req.get('host')}` : `http://localhost:${env.PORT || 5001}`;
        const url = `${host}/product-images/${uploadStream.id}`;
        resolve({ url, publicId: String(uploadStream.id) });
      });
      uploadStream.end(file.buffer);
    } catch (err) {
      reject(err);
    }
  });
}

function validateBusinessLogo(file) {
  const extension = path.extname(file?.originalname || '').toLowerCase();
  const expectedType = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  }[extension];
  if (!file?.buffer || file.buffer.length > 5 * 1024 * 1024 || !expectedType || file.mimetype !== expectedType) {
    throw new BadRequestError('Only JPG, JPEG, PNG, and WEBP business logos up to 5 MB are allowed.', 'INVALID_BUSINESS_LOGO');
  }

  const buffer = file.buffer;
  const validSignature = (
    expectedType === 'image/jpeg' &&
    buffer.length >= 3 &&
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  ) || (
    expectedType === 'image/png' &&
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) || (
    expectedType === 'image/webp' &&
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  );
  if (!validSignature) {
    throw new BadRequestError('The business logo file content does not match its image type.', 'INVALID_BUSINESS_LOGO_CONTENT');
  }
  return extension.slice(1);
}

function uploadBusinessLogo(file, wholesalerId, req = null) {
  const format = validateBusinessLogo(file);
  const hasCloudinary = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  if (hasCloudinary) {
    return new Promise((resolve, reject) => {
      getClient().uploader.upload_stream(
        {
          public_id: `wholesalers/branding/${wholesalerId}/${crypto.randomUUID()}`,
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        },
        (error, result) => {
          if (error) return reject(error);
          return resolve({ url: result.secure_url, publicId: result.public_id });
        },
      ).end(file.buffer);
    });
  }

  return new Promise((resolve, reject) => {
    try {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'productImages' });
      const uploadStream = bucket.openUploadStream(`business-logo-${wholesalerId}.${format}`, {
        contentType: file.mimetype,
        metadata: { kind: 'business-logo', wholesalerId: String(wholesalerId) },
      });
      uploadStream.on('error', reject);
      uploadStream.on('finish', () => {
        const host = req ? `${req.protocol}://${req.get('host')}` : `http://localhost:${env.PORT || 5001}`;
        resolve({ url: `${host}/product-images/${uploadStream.id}`, publicId: String(uploadStream.id) });
      });
      uploadStream.end(file.buffer);
    } catch (error) {
      reject(error);
    }
  });
}

async function deleteUploadedProductImage(publicId) {
  if (!publicId) return;

  const hasCloudinary = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  if (hasCloudinary) {
    const result = await getClient().uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });
    if (!['deleted', 'not found'].includes(result.result)) {
      throw new Error(`Image provider did not confirm deletion for asset ${publicId}.`);
    }
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(publicId)) {
    throw new Error('Image asset cannot be deleted because no configured storage provider recognizes it.');
  }
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'productImages' });
  const fileId = new mongoose.Types.ObjectId(publicId);
  const [file] = await bucket.find({ _id: fileId }).toArray();
  if (file) await bucket.delete(fileId);
}

module.exports = {
  uploadProductImage,
  uploadBusinessLogo,
  deleteUploadedProductImage,
  validateBusinessLogo,
};
