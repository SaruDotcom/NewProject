const {
  WholesalerRetailerRelationship,
  WholesalerProfile,
  Product,
} = require('../../models');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const ProductService = require('../products/products.service');

class RetailerPortalController {
  // Retailer gets active connection/wholesaler
  getConnections = asyncHandler(async (req, res) => {
    const relationships = await WholesalerRetailerRelationship.find({
      retailerId: req.user._id,
      status: 'ACTIVE',
    })
      .populate('wholesalerId', 'name email phone')
      .lean();

    const formatted = await Promise.all(
      relationships.map(async (rel) => {
        const wholesalerProfile = await WholesalerProfile.findOne({
          userId: rel.wholesalerId._id,
        }).lean();

        const productCount = await Product.countDocuments({
          wholesalerId: rel.wholesalerId._id,
          status: 'ACTIVE',
          isDeleted: false,
        });

        return {
          id: rel._id,
          wholesalerId: rel.wholesalerId._id,
          wholesalerName: rel.wholesalerId.name,
          businessName: wholesalerProfile?.businessName || rel.wholesalerId.name,
          businessLogoUrl: wholesalerProfile?.businessLogoUrl || '',
          city: wholesalerProfile?.address?.city || '',
          state: wholesalerProfile?.address?.state || '',
          rating: 4.8,
          productCount,
          status: rel.status,
          joinedAt: rel.joinedAt,
        };
      })
    );

    console.log(`[DEBUG] getConnections - Retailer ID: ${req.user._id} | Formatted Data:`, JSON.stringify(formatted));
    return ApiResponse.success(res, formatted, 'Connected wholesalers retrieved');
  });

  // Get products from connected wholesaler
  getConnectedProducts = asyncHandler(async (req, res) => {
    const { products, meta } = await ProductService.listRetailerConnectedProducts(req.user, req.query);
    return ApiResponse.paginated(res, products, meta, 'Products retrieved');
  });

  // Get catalog of specific wholesaler
  getWholesalerCatalog = asyncHandler(async (req, res) => {
    const { wholesalerId } = req.params;
    const profile = await WholesalerProfile.findOne({
      $or: [{ _id: wholesalerId.match(/^[0-9a-fA-F]{24}$/) ? wholesalerId : null }, { userId: wholesalerId.match(/^[0-9a-fA-F]{24}$/) ? wholesalerId : null }],
    }).populate('userId', 'name email phone');

    const products = await Product.find({
      wholesalerId: profile ? profile.userId._id : wholesalerId,
      status: 'ACTIVE',
      isDeleted: false,
    }).populate('categoryId', 'name slug');

    return ApiResponse.success(
      res,
      {
        wholesaler: profile,
        catalog: products,
        totalProducts: products.length,
      },
      'Wholesaler catalog retrieved'
    );
  });
}

module.exports = new RetailerPortalController();
