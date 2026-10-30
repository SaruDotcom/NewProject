const slugify = require('slugify');
const { Category, Product, WholesalerProfile } = require('../../models');
const { BadRequestError, NotFoundError, ConflictError, ForbiddenError } = require('../../utils/errors');
const { parsePagination } = require('../../utils/pagination');
const AuditService = require('../../services/audit.service');
const { AUDIT_ACTION, KYC_STATUS } = require('../../config/constants');

const getDuplicateCategoryScope = (wholesalerId) => (
  wholesalerId
    ? { wholesalerId }
    : { wholesalerId: null }
);

class CategoryService {
  static async validateParentCategory(parentId, user, categoryId = null) {
    if (!parentId) return null;
    if (categoryId && String(parentId) === String(categoryId)) {
      throw new BadRequestError('Category cannot be its own parent');
    }

    const parent = String(parentId).match(/^[0-9a-fA-F]{24}$/)
      ? await Category.findOne({ _id: parentId, isDemo: { $ne: true } })
      : await Category.findOne({
        $or: [{ slug: parentId }, { name: parentId }],
        isDeleted: false,
        isDemo: { $ne: true },
      });
    if (!parent || parent.isDeleted) {
      throw new NotFoundError('Parent category not found');
    }
    if (categoryId) {
      let curr = parent;
      const visited = new Set();
      while (curr && curr.parentId) {
        const currParentIdStr = String(curr.parentId._id || curr.parentId);
        if (currParentIdStr === String(categoryId)) {
          throw new BadRequestError('Cannot set a descendant category as parent (circular hierarchy)');
        }
        if (visited.has(currParentIdStr)) break;
        visited.add(currParentIdStr);
        curr = await Category.findById(curr.parentId);
      }
    }
    const parentLevel = parent.level || (parent.parentId ? 2 : 1);
    if (parentLevel >= 3) {
      throw new BadRequestError('Maximum 3 levels supported: Category (Level 1) → Subcategory (Level 2) → Sub-subcategory (Level 3)');
    }

    if (
      user &&
      user.role === 'WHOLESALER' &&
      parent.wholesalerId &&
      String(parent.wholesalerId) !== String(user._id)
    ) {
      throw new ForbiddenError('You can only use your own or global categories as a parent');
    }
    return parent;
  }

  /**
   * Generate clean unique slug
   */
  static async generateUniqueSlug(name, excludeId = null) {
    let slug = slugify(name, { lower: true, strict: true });
    let count = 0;
    let candidate = slug;

    while (true) {
      const query = { slug: candidate };
      if (excludeId) query._id = { $ne: excludeId };
      const exists = await Category.findOne(query);
      if (!exists) return candidate;
      count++;
      candidate = `${slug}-${count}`;
    }
  }

  /**
   * Get full 3-level nested category tree in one API call
   */
  static async getCategoryTree(wholesalerId = null) {
    const filter = { isDeleted: false, isDemo: { $ne: true } };
    if (wholesalerId) {
      filter.$or = [{ wholesalerId: null }, { wholesalerId: wholesalerId }];
    }

    const categories = await Category.find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const itemMap = new Map();
    categories.forEach((c) => {
      const pId = c.parentCategoryId || c.parentId ? String(c.parentCategoryId || c.parentId) : null;
      itemMap.set(String(c._id), {
        ...c,
        id: String(c._id),
        parentCategoryId: pId,
        parentId: pId,
        level: c.level || (pId ? 2 : 1),
        subcategories: [],
      });
    });

    const rootNodes = [];

    itemMap.forEach((node) => {
      if (node.parentCategoryId && itemMap.has(node.parentCategoryId)) {
        const parentNode = itemMap.get(node.parentCategoryId);
        parentNode.subcategories.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }

  /**
   * List categories (supports tree / flat / wholesaler-scoped / admin)
   */
  static async listCategories(query = {}) {
    const categoryFilter = { isDeleted: false, isDemo: { $ne: true } };
    if (query.wholesalerId) {
      categoryFilter.$or = [{ wholesalerId: null }, { wholesalerId: query.wholesalerId }];
    }

    const rawCategories = await Category.find(categoryFilter)
      .populate('parentId', 'name slug')
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const catMap = new Map();
    rawCategories.forEach((c) => catMap.set(String(c._id), c));

    const buildCategoryPath = (cat) => {
      const path = [];
      let curr = cat;
      const visited = new Set();

      while (curr && !visited.has(String(curr._id))) {
        visited.add(String(curr._id));
        path.unshift({
          _id: String(curr._id),
          id: String(curr._id),
          name: curr.name,
          slug: curr.slug,
        });
        const parentIdStr = curr.parentId ? (curr.parentId._id ? String(curr.parentId._id) : String(curr.parentId)) : null;
        if (!parentIdStr) break;
        curr = catMap.get(parentIdStr);
      }
      return path;
    };

    let targetList = rawCategories;
    if (query.parent && query.parent !== 'all') {
      if (query.parent === 'root') {
        targetList = targetList.filter((c) => !c.parentId);
      } else {
        targetList = targetList.filter((c) => {
          const pStr = c.parentId ? (c.parentId._id ? String(c.parentId._id) : String(c.parentId)) : null;
          return pStr === String(query.parent);
        });
      }
    } else if (query.parentId !== undefined) {
      targetList = targetList.filter((c) => {
        const pStr = c.parentId ? (c.parentId._id ? String(c.parentId._id) : String(c.parentId)) : null;
        if (query.parentId === 'null' || query.parentId === '' || query.parentId === null) return pStr === null;
        return pStr === String(query.parentId);
      });
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      targetList = targetList.filter((c) => searchRegex.test(c.name));
    }

    const categoriesWithCount = await Promise.all(
      targetList.map(async (cat) => {
        const catIdStr = String(cat._id);
        const path = buildCategoryPath(cat);
        const ancestors = path.slice(0, -1);
        const level = path.length - 1;
        const displayPath = path.map((p) => p.name).join(' > ');

        const subCount = await Category.countDocuments({
          parentId: cat._id,
          isDeleted: false,
          isDemo: { $ne: true },
        });
        const productFilter = {
          $or: [
            { categoryId: cat._id },
            { subcategoryId: cat._id },
            { subCategory: cat._id },
            { subSubcategoryId: cat._id },
          ],
          isDeleted: false,
          isDemo: { $ne: true },
        };
        if (query.wholesalerId) productFilter.wholesalerId = query.wholesalerId;
        const prodCount = await Product.countDocuments({
          ...productFilter,
        });

        return {
          ...cat,
          id: catIdStr,
          parent: cat.parentId ? { _id: String(cat.parentId._id || cat.parentId), name: cat.parentId.name } : null,
          path,
          ancestors,
          level,
          displayPath,
          subcategories: subCount,
          products: prodCount,
          productCount: prodCount,
        };
      })
    );

    const allParents = rawCategories.map((p) => {
      const path = buildCategoryPath(p);
      return {
        _id: String(p._id),
        id: String(p._id),
        name: p.name,
        level: path.length - 1,
        displayPath: path.map((x) => x.name).join(' > '),
      };
    });

    return {
      items: categoriesWithCount,
      pagination: {
        page: 1,
        limit: Math.max(10, categoriesWithCount.length),
        total: categoriesWithCount.length,
        totalPages: 1,
      },
      filters: {
        parents: allParents,
      },
    };
  }

  /**
   * Get single category by ID or slug
   */
  static async getCategoryById(idOrSlug) {
    let category;
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findOne({ _id: idOrSlug, isDemo: { $ne: true } }).populate('parentId', 'name slug');
    } else {
      category = await Category.findOne({ slug: idOrSlug, isDeleted: false, isDemo: { $ne: true } }).populate('parentId', 'name slug');
    }

    if (!category || category.isDeleted) {
      throw new NotFoundError('Category not found');
    }

    const subcategories = await Category.find({ parentId: category._id, isDeleted: false, isDemo: { $ne: true } });
    const productCount = await Product.countDocuments({
      $or: [{ categoryId: category._id }, { subcategoryId: category._id }],
      isDeleted: false,
      isDemo: { $ne: true },
    });

    return {
      category,
      subcategories,
      productCount,
    };
  }

  /**
   * Create category (Super Admin or Wholesaler)
   */
  static async createCategory(categoryData, user, req = null) {
    const { name, description, imageUrl, icon, parentId, sortOrder } = categoryData || {};

    if (user.role === 'WHOLESALER') {
      const wholesalerProfile = await WholesalerProfile.findOne({ userId: user._id });
      if (!wholesalerProfile || wholesalerProfile.kycStatus !== KYC_STATUS.APPROVED) {
        throw new ForbiddenError(
          'Wholesaler KYC must be approved before creating categories',
          'KYC_APPROVAL_REQUIRED'
        );
      }
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new BadRequestError('Category name is required');
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      throw new BadRequestError('Category name cannot exceed 100 characters');
    }
    const targetParentId = parentId || null;

    // Prevent duplicate category names under the same parent level
    const duplicateCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      parentId: targetParentId,
      isDeleted: false,
      isDemo: { $ne: true },
      ...getDuplicateCategoryScope(user.role === 'WHOLESALER' ? user._id : null),
    });

    if (duplicateCategory) {
      throw new ConflictError(`A category named "${trimmedName}" already exists at this level.`);
    }

    if (parentId) await this.validateParentCategory(parentId, user);

    const slug = await this.generateUniqueSlug(trimmedName);
    if (!slug) {
      throw new BadRequestError('Category name must contain letters or numbers');
    }
    const wholesalerId = user.role === 'WHOLESALER' ? user._id : null;

    let category;
    try {
      category = await Category.create({
        name: trimmedName,
        slug,
        description: description || '',
        imageUrl: imageUrl || '',
        icon: icon || '',
        parentId: targetParentId,
        wholesalerId,
        sortOrder: sortOrder || 0,
      });
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictError(`A category named "${trimmedName}" already exists.`);
      }
      throw error;
    }

    await AuditService.log({
      actorId: user._id,
      actorRole: user.role,
      action: AUDIT_ACTION.CREATE,
      entityType: 'Category',
      entityId: category._id,
      after: category.toJSON(),
      req,
    });

    return category;
  }

  /**
   * Update category
   */
  static async updateCategory(categoryId, updateData, user, req = null) {
    updateData = updateData || {};
    const category = String(categoryId).match(/^[0-9a-fA-F]{24}$/)
      ? await Category.findOne({ _id: categoryId, isDemo: { $ne: true } })
      : await Category.findOne({
        $or: [{ slug: categoryId }, { name: categoryId }],
        isDeleted: false,
        isDemo: { $ne: true },
      });

    if (!category || category.isDeleted) {
      throw new NotFoundError('Category not found');
    }
    if (user.role === 'WHOLESALER' && String(category.wholesalerId) !== String(user._id)) {
      throw new ForbiddenError('You can only manage your own categories');
    }

    const beforeState = category.toJSON();

    if (updateData.name !== undefined) {
      if (typeof updateData.name !== 'string' || updateData.name.trim().length === 0) {
        throw new BadRequestError('Category name is required');
      }
      const trimmedName = updateData.name.trim();
      if (trimmedName.length > 100) {
        throw new BadRequestError('Category name cannot exceed 100 characters');
      }

      if (trimmedName !== category.name) {
        const targetParentId = updateData.parentId !== undefined ? (updateData.parentId || null) : category.parentId;
        const duplicateCategory = await Category.findOne({
          _id: { $ne: category._id },
          name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          parentId: targetParentId,
          isDeleted: false,
          isDemo: { $ne: true },
          ...getDuplicateCategoryScope(category.wholesalerId),
        });

        if (duplicateCategory) {
          throw new ConflictError(`A category named "${trimmedName}" already exists at this level.`);
        }

        category.name = trimmedName;
        category.slug = await this.generateUniqueSlug(category.name, category._id);
      }
    }

    if (updateData.description !== undefined) category.description = updateData.description;
    if (updateData.imageUrl !== undefined) category.imageUrl = updateData.imageUrl;
    if (updateData.icon !== undefined) category.icon = updateData.icon;
    if (updateData.sortOrder !== undefined) category.sortOrder = updateData.sortOrder;
    if (updateData.isActive !== undefined) category.isActive = updateData.isActive;
    if (updateData.parentId !== undefined) {
      if (updateData.parentId) {
        await this.validateParentCategory(updateData.parentId, user, category._id);
        const childCount = await Category.countDocuments({ parentId: category._id, isDeleted: false });
        if (childCount > 0) {
          throw new BadRequestError('A category with subcategories must remain a top-level category');
        }
      }
      category.parentId = updateData.parentId || null;
    }

    await category.save();

    await AuditService.log({
      actorId: user._id,
      actorRole: user.role,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'Category',
      entityId: category._id,
      before: beforeState,
      after: category.toJSON(),
      req,
    });

    return category;
  }

  /**
   * Safe delete category: checks if active products or child subcategories depend on it
   */
  static async deleteCategory(categoryId, user, req = null) {
    const category = String(categoryId).match(/^[0-9a-fA-F]{24}$/)
      ? await Category.findOne({ _id: categoryId, isDemo: { $ne: true } })
      : await Category.findOne({
        $or: [{ slug: categoryId }, { name: categoryId }],
        isDeleted: false,
        isDemo: { $ne: true },
      });

    if (!category || category.isDeleted) {
      throw new NotFoundError('Category not found');
    }
    if (user.role === 'WHOLESALER' && String(category.wholesalerId) !== String(user._id)) {
      throw new ForbiddenError('You can only manage your own categories');
    }

    // Check if child subcategories exist
    const childCategoriesCount = await Category.countDocuments({ parentId: category._id, isDeleted: false, isDemo: { $ne: true } });
    if (childCategoriesCount > 0) {
      throw new ConflictError(
        `Cannot delete category. There are ${childCategoriesCount} subcategories attached to it. Please reassign or delete subcategories first.`,
        'CATEGORY_HAS_CHILDREN'
      );
    }

    // Check if active products depend on this category
    const activeProductsCount = await Product.countDocuments({
      $or: [{ categoryId: category._id }, { subcategoryId: category._id }],
      isDeleted: false,
      isDemo: { $ne: true },
    });

    if (activeProductsCount > 0) {
      throw new ConflictError(
        `Cannot delete category. There are ${activeProductsCount} products currently assigned to this category.`,
        'CATEGORY_IN_USE'
      );
    }

    category.isDeleted = true;
    await category.save();

    await AuditService.log({
      actorId: user._id,
      actorRole: user.role,
      action: AUDIT_ACTION.DELETE,
      entityType: 'Category',
      entityId: category._id,
      req,
    });

    return { message: 'Category deleted successfully' };
  }
}

module.exports = CategoryService;
