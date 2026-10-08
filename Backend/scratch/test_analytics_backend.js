const WholesalerReportsService = require('../src/services/wholesalerReports.service');

async function test() {
  console.log('Testing WholesalerReportsService loading...');
  console.log('getAnalytics is function:', typeof WholesalerReportsService.getAnalytics === 'function');
  console.log('exportAnalyticsCsv is function:', typeof WholesalerReportsService.exportAnalyticsCsv === 'function');
}

test();
