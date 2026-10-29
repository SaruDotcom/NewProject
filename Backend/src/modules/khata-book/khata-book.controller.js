const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { KhataBookService } = require('./khata-book.service');

module.exports = {
  getSettings: asyncHandler(async (req, res) => {
    const settings = await KhataBookService.getSettings(req.user._id);
    return ApiResponse.success(res, settings, 'Khata Book settings retrieved');
  }),

  updateSettings: asyncHandler(async (req, res) => {
    const settings = await KhataBookService.updateSettings(req.user._id, req.body);
    return ApiResponse.success(res, settings, 'Khata Book settings saved');
  }),

  list: asyncHandler(async (req, res) => {
    const result = await KhataBookService.getEntries(req.user._id, req.query);
    return ApiResponse.success(res, result, 'Khata entries retrieved');
  }),

  create: asyncHandler(async (req, res) => {
    const entry = await KhataBookService.createEntry(req.user._id, req.body);
    return ApiResponse.created(res, entry, 'Khata entry created');
  }),

  update: asyncHandler(async (req, res) => {
    const entry = await KhataBookService.updateEntry(req.user._id, req.params.id, req.body);
    return ApiResponse.success(res, entry, 'Khata entry updated');
  }),

  remove: asyncHandler(async (req, res) => {
    const result = await KhataBookService.deleteEntry(req.user._id, req.params.id);
    return ApiResponse.success(res, result, 'Khata entry deleted');
  }),

  export: asyncHandler(async (req, res) => {
    const format = req.params.format === 'xlsx' ? 'xlsx' : 'pdf';
    const report = await KhataBookService.exportEntries(req.user._id, req.query, format);
    res.setHeader('Content-Type', report.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(report.buffer);
  }),
};
