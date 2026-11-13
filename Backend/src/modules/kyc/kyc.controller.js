const fs = require('fs');
const KycService = require('./kyc.service');
const KycDocumentStorageService = require('../../services/kycDocumentStorage.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

class KycController {
  // Wholesaler submits KYC
  submitKyc = asyncHandler(async (req, res) => {
    const files = req.files || (req.file ? [req.file] : []);
    try {
      const application = await KycService.submitKyc(req.user, req.body, files, req);
      return ApiResponse.created(res, application, 'KYC application submitted successfully');
    } finally {
      await KycDocumentStorageService.removeTemporaryUploads(files);
    }
  });

  // Wholesaler gets own KYC
  getMyKyc = asyncHandler(async (req, res) => {
    const application = await KycService.getWholesalerKyc(req.user);
    return ApiResponse.success(res, application, 'Wholesaler KYC details retrieved');
  });

  // Admin lists all applications
  listKyc = asyncHandler(async (req, res) => {
    const { applications, meta } = await KycService.listKycApplications(req.query);
    return ApiResponse.paginated(res, applications, meta, 'KYC applications retrieved successfully');
  });

  // Admin gets single KYC
  getKycById = asyncHandler(async (req, res) => {
    const application = await KycService.getKycById(req.params.id, req.user, req);
    return ApiResponse.success(res, application, 'KYC application retrieved successfully');
  });

  // Admin approves KYC
  approveKyc = asyncHandler(async (req, res) => {
    const application = await KycService.approveKyc(req.params.id, req.user, req);
    return ApiResponse.success(res, application, 'KYC application approved successfully');
  });

  // Admin rejects KYC
  rejectKyc = asyncHandler(async (req, res) => {
    const application = await KycService.rejectKyc(req.params.id, req.body.reason || req.body.note, req.user, req);
    return ApiResponse.success(res, application, 'KYC application rejected');
  });

  // Admin requests resubmission
  requestResubmission = asyncHandler(async (req, res) => {
    const reason = req.body.reason || req.body.note;
    const application = await KycService.requestResubmission(
      req.params.id,
      reason,
      req.user,
      req,
      req.body.documentsToResubmit
    );
    return ApiResponse.success(res, application, 'KYC resubmission requested');
  });

  // Secure document download/stream
  getDocumentFile = asyncHandler(async (req, res, next) => {
    const { filePath, fileStream, mimeType, originalName } = await KycService.getDocumentFile(
      req.params.docId,
      req.user,
      req
    );

    const isDownload = req.query.download === 'true' || req.query.download === '1';
    const dispositionType = isDownload ? 'attachment' : 'inline';
    const cleanAsciiName = (originalName || 'document').replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
    const encodedName = encodeURIComponent(originalName || 'document');

    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${cleanAsciiName}"; filename*=UTF-8''${encodedName}`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const stream = fileStream || fs.createReadStream(filePath);
    stream.on('error', (error) => {
      if (res.headersSent) {
        res.destroy(error);
      } else {
        next(error);
      }
    });
    stream.pipe(res);
  });
}

module.exports = new KycController();
