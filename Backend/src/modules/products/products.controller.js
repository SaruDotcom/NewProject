const ProductService = require('./products.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

class ProductController {
  // Upload product images
  uploadImages = asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return ApiResponse.error(res, 'No images uploaded', 400);
    }
    const urls = req.files.map(file => `${req.protocol}://${req.get('host')}/uploads/products/${file.filename}`);
    return ApiResponse.success(res, urls, 'Images uploaded successfully');
  });

  // Super Admin global products list
  listAdminProducts = asyncHandler(async (req, res) => {
    const { products, meta, filters } = await ProductService.listAdminProducts(req.query);
    return ApiResponse.success(res, { items: products, pagination: meta, filters }, 'Products retrieved successfully');
  });

  // Wholesaler products list
  listWholesalerProducts = asyncHandler(async (req, res) => {
    const { products, meta } = await ProductService.listWholesalerProducts(req.user, req.query);
    return ApiResponse.paginated(res, products, meta, 'Wholesaler products retrieved');
  });

  // Retailer connected products list
  listRetailerProducts = asyncHandler(async (req, res) => {
    const { products, meta } = await ProductService.listRetailerConnectedProducts(req.user, req.query);
    return ApiResponse.paginated(res, products, meta, 'Connected products retrieved');
  });

  // Get single product
  getProductById = asyncHandler(async (req, res) => {
    const data = await ProductService.getProductById(req.params.id);
    return ApiResponse.success(res, data, 'Product details retrieved');
  });

  // Create product
  createProduct = asyncHandler(async (req, res) => {
    const result = await ProductService.createProduct(req.body, req.user, req);
    return ApiResponse.created(res, result, 'Product created successfully');
  });

  // Update product
  updateProduct = asyncHandler(async (req, res) => {
    const product = await ProductService.updateProduct(req.params.id, req.body, req.user, req);
    return ApiResponse.success(res, product, 'Product updated successfully');
  });

  // Update product status (Admin)
  updateStatus = asyncHandler(async (req, res) => {
    const product = await ProductService.updateProduct(req.params.id, { status: req.body.status }, req.user, req);
    return ApiResponse.success(res, product, 'Product status updated successfully');
  });

  // Delete product
  deleteProduct = asyncHandler(async (req, res) => {
    const result = await ProductService.deleteProduct(req.params.id, req.user, req);
    return ApiResponse.success(res, result, result.message);
  });
}

module.exports = new ProductController();
