const { v2: cloudinary } = require('cloudinary');
const mongoose = require('mongoose');
const env = require('../config/env');

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

module.exports = { uploadProductImage, deleteUploadedProductImage };
