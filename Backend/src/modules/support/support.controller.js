const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { uploadProductImage } = require('../../services/cloudinary.service');
const SupportService = require('./support.service');

class SupportController {
  uploadAttachments = asyncHandler(async (req, res) => {
    if (!req.files?.length) return ApiResponse.error(res, 'Select at least one image to upload', 400);
    const attachments = await Promise.all(req.files.map((file) => uploadProductImage(file, req)));
    return ApiResponse.success(res, attachments, 'Support attachments uploaded');
  });

  create = asyncHandler(async (req, res) => {
    const ticket = await SupportService.createTicket(req.user, req.body);
    return ApiResponse.created(res, ticket, 'Support ticket created');
  });

  listMine = asyncHandler(async (req, res) => {
    const tickets = await SupportService.listMine(req.user);
    return ApiResponse.success(res, tickets, 'Your support tickets retrieved');
  });

  getMine = asyncHandler(async (req, res) => {
    const ticket = await SupportService.getMine(req.user, req.params.id);
    return ApiResponse.success(res, ticket, 'Support ticket retrieved');
  });

  markMineRead = asyncHandler(async (req, res) => {
    const ticket = await SupportService.markMineRead(req.user, req.params.id);
    return ApiResponse.success(res, ticket, 'Support ticket marked as read');
  });

  replyAsOwner = asyncHandler(async (req, res) => {
    const ticket = await SupportService.replyAsOwner(req.user, req.params.id, req.body.message);
    return ApiResponse.success(res, ticket, 'Reply added');
  });

  adminList = asyncHandler(async (req, res) => {
    const result = await SupportService.adminList(req.query);
    return ApiResponse.success(res, result, 'Support tickets retrieved');
  });

  getAdminTicket = asyncHandler(async (req, res) => {
    const ticket = await SupportService.getAdminTicket(req.params.id);
    return ApiResponse.success(res, ticket, 'Support ticket retrieved');
  });

  updateAsAdmin = asyncHandler(async (req, res) => {
    const result = await SupportService.updateAsAdmin(req.user, req.params.id, req.body, req);
    return ApiResponse.success(res, result.ticket, 'Support ticket updated');
  });

  replyAsAdmin = asyncHandler(async (req, res) => {
    const ticket = await SupportService.replyAsAdmin(req.user, req.params.id, req.body.message, req);
    return ApiResponse.success(res, ticket, 'Reply added');
  });
}

module.exports = new SupportController();
