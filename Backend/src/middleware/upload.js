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
  const isBusinessProof = file.fieldname === 'businessProof';
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const businessProofMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  const businessProofExts = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  const acceptedMimeTypes = isBusinessProof ? businessProofMimeTypes : allowedMimeTypes;
  const acceptedExts = isBusinessProof ? businessProofExts : allowedExts;

  if (acceptedMimeTypes.includes(file.mimetype) && acceptedExts.includes(ext)) {
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
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10,
  },
  fileFilter,
});

const kycUpload = upload;

// Product images and business logos use memory storage for their upload providers.
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

const businessLogoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.includes(file.mimetype) && allowedExts.includes(ext)) return cb(null, true);
    return cb(new BadRequestError('Only JPG, JPEG, PNG, and WEBP business logos are allowed.', 'INVALID_IMAGE_TYPE'), false);
  },
});

const shippingDir = path.join(uploadBaseDir, 'shipping');
if (!fs.existsSync(shippingDir)) {
  fs.mkdirSync(shippingDir, { recursive: true });
}

const shippingDocumentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, shippingDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `bilty-${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const shippingDocumentUpload = multer({
  storage: shippingDocumentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.includes(file.mimetype) && allowedExts.includes(ext)) return cb(null, true);
    return cb(new BadRequestError('Only PDF, JPG, JPEG, and PNG shipping documents or bilty files are allowed.', 'INVALID_FILE_TYPE'), false);
  },
});

module.exports = upload;
module.exports.kycUpload = kycUpload;
module.exports.productImageUpload = productImageUpload;
module.exports.businessLogoUpload = businessLogoUpload;
module.exports.shippingDocumentUpload = shippingDocumentUpload;
