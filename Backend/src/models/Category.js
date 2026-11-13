const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    imageUrl: {
      type: String,
      default: '',
    },
    icon: {
      type: String,
      default: '',
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    parentCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    level: {
      type: Number,
      enum: [1, 2, 3],
      default: 1,
      required: true,
      index: true,
    },
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null means global/system category
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

categorySchema.pre('validate', async function (next) {
  if (this.isNew && this.parentCategoryId && !this.parentId) {
    this.parentId = this.parentCategoryId;
  } else if (this.isNew && this.parentId) {
    this.parentCategoryId = this.parentId;
  } else if (this.isModified('parentCategoryId') && !this.isModified('parentId')) {
    this.parentId = this.parentCategoryId;
  } else if (this.isModified('parentId') || (this.parentId && !this.parentCategoryId)) {
    this.parentCategoryId = this.parentId;
  }

  const pId = this.parentId || this.parentCategoryId;
  if (!pId) {
    this.level = 1;
    this.parentId = null;
    this.parentCategoryId = null;
    return next();
  }

  try {
    const Category = mongoose.model('Category');
    let parent = await Category.findById(pId).select('_id parentId parentCategoryId isDeleted');
    if (!parent || parent.isDeleted) {
      return next(new Error('Parent category not found'));
    }

    const visited = new Set([String(this._id)]);
    let level = 1;
    while (parent) {
      const parentId = String(parent._id);
      if (visited.has(parentId)) {
        return next(new Error('Category hierarchy cannot contain a cycle'));
      }
      visited.add(parentId);
      level += 1;
      if (level > 3) {
        return next(new Error('Maximum category depth exceeded: Only 3 levels supported (Category → Subcategory → Sub-subcategory)'));
      }
      const ancestorId = parent.parentId || parent.parentCategoryId;
      parent = ancestorId ? await Category.findById(ancestorId).select('_id parentId parentCategoryId isDeleted') : null;
      if (parent?.isDeleted) {
        return next(new Error('Parent category not found'));
      }
    }

    if (level > 3) {
      return next(new Error('Maximum category depth exceeded: Only 3 levels supported (Category → Subcategory → Sub-subcategory)'));
    }

    this.level = level;
    next();
  } catch (err) {
    next(err);
  }
});

categorySchema.index({ parentId: 1, sortOrder: 1 });
categorySchema.index({ parentCategoryId: 1, level: 1 });
categorySchema.index({ isDeleted: 1, wholesalerId: 1, sortOrder: 1, name: 1 });
categorySchema.index({ isDeleted: 1, parentId: 1, sortOrder: 1 });

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
