const CategoryService = require('./categories.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { ROLES } = require('../../config/constants');

class CategoryController {
  getCategoryTree = asyncHandler(async (req, res) => {
    const wholesalerId = req.user && req.user.role === ROLES.WHOLESALER ? req.user._id : req.query.wholesalerId || null;
    const tree = await CategoryService.getCategoryTree(wholesalerId);
    return ApiResponse.success(res, tree, 'Category tree retrieved successfully');
  });

  listCategories = asyncHandler(async (req, res) => {
    const query = { ...req.query };
    if (req.user && req.user.role === ROLES.WHOLESALER) {
      query.wholesalerId = req.user._id;
    }
    const categories = await CategoryService.listCategories(query);
    return ApiResponse.success(res, categories, 'Categories retrieved successfully');
  });

  getCategoryById = asyncHandler(async (req, res) => {
    const data = await CategoryService.getCategoryById(req.params.id);
    return ApiResponse.success(res, data, 'Category retrieved successfully');
  });

  createCategory = asyncHandler(async (req, res) => {
    const category = await CategoryService.createCategory(req.body, req.user, req);
    return ApiResponse.created(res, category, 'Category created successfully');
  });

  updateCategory = asyncHandler(async (req, res) => {
    const category = await CategoryService.updateCategory(req.params.id, req.body, req.user, req);
    return ApiResponse.success(res, category, 'Category updated successfully');
  });

  deleteCategory = asyncHandler(async (req, res) => {
    const result = await CategoryService.deleteCategory(req.params.id, req.user, req);
    return ApiResponse.success(res, result, result.message);
  });
}

module.exports = new CategoryController();
