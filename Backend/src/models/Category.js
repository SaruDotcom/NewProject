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
  // Sync parentId and parentCategoryId
  if (this.parentCategoryId && !this.parentId) {
    this.parentId = this.parentCategoryId;
  }
  if (this.parentId && !this.parentCategoryId) {
    this.parentCategoryId = this.parentId;
  }

  const pId = this.parentCategoryId || this.parentId;
  if (!pId) {
    this.level = 1;
    this.parentId = null;
    this.parentCategoryId = null;
    return next();
  }

  try {
    const parent = await mongoose.model('Category').findOne({
      _id: pId,
    });
    if (!parent || parent.isDeleted) {
      return next(new Error('Parent category not found'));
    }

    const parentLevel = parent.level || (parent.parentId ? 2 : 1);
    if (parentLevel >= 3) {
      return next(new Error('Maximum category depth exceeded: Only 3 levels supported (Category → Subcategory → Sub-subcategory)'));
    }

    this.level = parentLevel + 1;
    next();
  } catch (err) {
    next(err);
  }
});

categorySchema.index({ parentId: 1, sortOrder: 1 });
categorySchema.index({ parentCategoryId: 1, level: 1 });

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
