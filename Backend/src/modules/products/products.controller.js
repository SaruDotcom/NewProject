const ProductService = require('./products.service');
const BulkProductService = require('./products.bulk.service');
const ProductTemplateService = require('./products.template.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { uploadProductImage } = require('../../services/cloudinary.service');

class ProductController {
  // Upload product images
  uploadImages = asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return ApiResponse.error(res, 'No images uploaded', 400);
    }
    const images = await Promise.all(req.files.map((file) => uploadProductImage(file, req)));
    return ApiResponse.success(res, images, 'Images uploaded successfully');
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

  previewBulkProducts = asyncHandler(async (req, res) => {
    const rows = await BulkProductService.preview(req.body.rows, req.user);
    return ApiResponse.success(res, { rows }, 'Bulk product preview generated');
  });

  downloadBulkProductTemplate = asyncHandler(async (req, res) => {
    const { buffer, filename } = await ProductTemplateService.create(
      req.user._id,
      req.query.category,
    );
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store',
    });
    return res.status(200).send(buffer);
  });

  importBulkProducts = asyncHandler(async (req, res) => {
    const result = await BulkProductService.importValidRows(req.body.rows, req.user, req);
    return ApiResponse.success(res, result, 'Bulk product import completed');
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
