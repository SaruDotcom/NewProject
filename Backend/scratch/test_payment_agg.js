const mongoose = require('mongoose');
const { Payment, Order, User } = require('../src/models');
const WholesalerReportsService = require('../src/services/wholesalerReports.service');

async function test() {
  const dateMatch = {
    $gte: new Date('2026-03-31T18:30:00.000Z'),
    $lt: new Date('2026-04-30T18:30:00.000Z'),
  };
  const wholesalerId = new mongoose.Types.ObjectId();

  const agg = [
    {
      $match: {
        wholesalerId: wholesalerId,
        status: 'PAID',
        $or: [
          { paidAt: dateMatch },
          { createdAt: dateMatch },
        ],
      },
    },
    { $group: { _id: '$orderId', paid: { $sum: '$amount' } } },
    {
      $group: {
        _id: null,
        paidAmount: { $sum: '$paid' },
        averagePaymentPerOrder: { $avg: '$paid' },
        paidOrders: { $sum: 1 },
      },
    },
  ];

  console.log('Query:', JSON.stringify(agg, null, 2));
}

test();
