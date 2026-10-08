const fs = require('fs');
const KycService = require('./kyc.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

class KycController {
  // Wholesaler submits KYC
  submitKyc = asyncHandler(async (req, res) => {
    const files = req.files || (req.file ? [req.file] : []);
    const application = await KycService.submitKyc(req.user, req.body, files, req);
    return ApiResponse.created(res, application, 'KYC application submitted successfully');
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
    const application = await KycService.getKycById(req.params.id);
    return ApiResponse.success(res, application, 'KYC application retrieved successfully');
  });

  // Admin approves KYC
  approveKyc = asyncHandler(async (req, res) => {
    const application = await KycService.approveKyc(req.params.id, req.user, req);
    return ApiResponse.success(res, application, 'KYC application approved successfully');
  });

  // Admin rejects KYC
  rejectKyc = asyncHandler(async (req, res) => {
    const application = await KycService.rejectKyc(req.params.id, req.body.reason, req.user, req);
    return ApiResponse.success(res, application, 'KYC application rejected');
  });

  // Admin requests resubmission
  requestResubmission = asyncHandler(async (req, res) => {
    const application = await KycService.requestResubmission(req.params.id, req.body.reason, req.user, req);
    return ApiResponse.success(res, application, 'KYC resubmission requested');
  });

  // Secure document download/stream
  getDocumentFile = asyncHandler(async (req, res) => {
    const { filePath, mimeType, originalName } = await KycService.getDocumentFile(
      req.params.docId,
      req.user
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${originalName}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  });
}

module.exports = new KycController();
