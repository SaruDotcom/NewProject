const mongoose = require('mongoose');

const kycDocumentSchema = new mongoose.Schema(
  {
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      enum: [
        'PAN_CARD',
        'AADHAAR_FRONT',
        'AADHAAR_BACK',
        'GST_CERTIFICATE',
        'BANK_STATEMENT_OR_CHEQUE',
        'BUSINESS_REGISTRATION_PROOF',
        'OWNER_ID_PROOF',
        'OTHER',
      ],
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    fileKey: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      default: '',
    },
    storageProvider: {
      type: String,
      enum: ['LOCAL', 'GRIDFS', 'CLOUDINARY'],
      default: 'GRIDFS',
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationNotes: {
      type: String,
      default: '',
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

kycDocumentSchema.pre('save', function (next) {
  if (!this.fileUrl && this._id) {
    this.fileUrl = `/api/v1/kyc/documents/${this._id}`;
  }
  next();
});

const KycDocument = mongoose.model('KycDocument', kycDocumentSchema);
module.exports = KycDocument;
