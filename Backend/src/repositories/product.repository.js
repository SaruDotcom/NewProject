const { Product, Inventory } = require('../models');

class ProductRepository {
  static async findById(productId) {
    return Product.findById(productId).populate('categoryId subcategoryId wholesalerId');
  }

  static async findByWholesaler(wholesalerId, filter = {}, sort = { createdAt: -1 }, skip = 0, limit = 20) {
    const query = { wholesalerId, isDeleted: false, ...filter };
    const [products, total] = await Promise.all([
      Product.find(query).populate('categoryId').sort(sort).skip(skip).limit(limit).lean(),
      Product.countDocuments(query),
    ]);
    return { products, total };
  }

  static async findInventory(productId) {
    return Inventory.findOne({ productId });
  }
}

module.exports = ProductRepository;
