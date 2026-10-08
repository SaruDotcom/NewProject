const ReportService = require('../../services/report.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { BadRequestError } = require('../../utils/errors');

class ReportController {
  exportReport = asyncHandler(async (req, res) => {
    const { type } = req.params;
    const format = req.query.format || 'json';
    const { startDate, endDate } = req.query;

    let reportResult;
    switch (type) {
      case 'sales':
      case 'orders':
        reportResult = await ReportService.getSalesReport(startDate, endDate);
        break;
      case 'wholesalers':
        reportResult = await ReportService.getWholesalersReport();
        break;
      case 'retailers':
        reportResult = await ReportService.getRetailersReport();
        break;
      case 'payouts':
        reportResult = await ReportService.getPayoutsReport();
        break;
      default:
        throw new BadRequestError(`Unknown report type '${type}'`);
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${Date.now()}.csv"`);
      return res.status(200).send(reportResult.csv);
    }

    return ApiResponse.success(res, reportResult.data, `${type} report generated`);
  });
}

module.exports = new ReportController();
