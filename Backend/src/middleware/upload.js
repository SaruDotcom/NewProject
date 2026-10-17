const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const { BadRequestError } = require('../utils/errors');

// Ensure upload directories exist
const uploadBaseDir = env.UPLOAD_PATH;
const kycDir = path.join(uploadBaseDir, 'kyc');
const productsDir = path.join(uploadBaseDir, 'products');

[uploadBaseDir, kycDir, productsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'kycDocument' || req.originalUrl.includes('kyc')) {
      cb(null, kycDir);
    } else {
      cb(null, productsDir);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];

  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestError(
        'Invalid file type. Only JPEG, PNG, WEBP, and PDF files are allowed.',
        'INVALID_FILE_TYPE'
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5,
  },
  fileFilter,
});

// Product images are uploaded to Cloudinary by the controller. KYC documents
// continue using disk storage because their secure retrieval flow depends on it.
const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.includes(file.mimetype) && allowedExts.includes(ext)) return cb(null, true);
    return cb(new BadRequestError('Only JPG, JPEG, PNG, and WEBP product images are allowed.', 'INVALID_IMAGE_TYPE'), false);
  },
});

module.exports = upload;
module.exports.productImageUpload = productImageUpload;
