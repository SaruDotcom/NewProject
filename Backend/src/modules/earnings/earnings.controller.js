const EarningService = require('./earnings.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

class EarningController {
  listEarnings = asyncHandler(async (req, res) => {
    const data = await EarningService.listEarnings(req.query);
    return ApiResponse.paginated(res, data.earnings, data.meta, 'Earnings retrieved successfully');
  });

  getSummary = asyncHandler(async (req, res) => {
    const summary = await EarningService.getEarningsSummary(req.query);
    return ApiResponse.success(res, summary, 'Earnings summary retrieved');
  });
}

module.exports = new EarningController();
