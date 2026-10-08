const { Order } = require('../models');

class OrderRepository {
  static async findById(orderId, retailerId = null) {
    const query = { _id: orderId };
    if (retailerId) query.retailerId = retailerId;
    return Order.findOne(query)
      .populate({
        path: 'items.productId',
        populate: [
          { path: 'categoryId' },
          { path: 'subcategoryId' },
          { path: 'subCategory' },
        ],
      })
      .populate('wholesalerId');
  }

  static async findByRetailer(retailerId, filter = {}, sort = { createdAt: -1 }, skip = 0, limit = 20) {
    const query = { retailerId, ...filter };
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate({
          path: 'items.productId',
          populate: [
            { path: 'categoryId' },
            { path: 'subcategoryId' },
            { path: 'subCategory' },
          ],
        })
        .populate('wholesalerId')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);
    return { orders, total };
  }
}

module.exports = OrderRepository;
