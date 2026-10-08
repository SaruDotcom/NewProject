const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Category = require('../src/models/Category');
const Product = require('../src/models/Product');

async function inspect() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/b2b-wholesale';
    console.log('Connecting to Mongo:', mongoUri);
    await mongoose.connect(mongoUri);

    console.log('\n--- ALL CATEGORIES IN DB ---');
    const categories = await Category.find({}).lean();
    console.log(`Total Categories: ${categories.length}`);
    categories.forEach(cat => {
      console.log({
        id: cat._id.toString(),
        name: cat.name,
        slug: cat.slug,
        level: cat.level,
        parentId: cat.parentId ? cat.parentId.toString() : null,
        parentCategoryId: cat.parentCategoryId ? cat.parentCategoryId.toString() : null,
        isActive: cat.isActive,
        isDeleted: cat.isDeleted,
        wholesalerId: cat.wholesalerId ? cat.wholesalerId.toString() : null,
      });
    });

    console.log('\n--- ALL PRODUCTS AND THEIR CATEGORIES ---');
    const products = await Product.find({}).lean();
    console.log(`Total Products: ${products.length}`);
    products.forEach(p => {
      console.log({
        id: p._id.toString(),
        name: p.name || p.title,
        category: p.category, // legacy string or ref?
        categoryId: p.categoryId ? p.categoryId.toString() : null,
        subcategoryId: p.subcategoryId ? p.subcategoryId.toString() : null,
        subSubcategoryId: p.subSubcategoryId ? p.subSubcategoryId.toString() : null,
      });
    });

    process.exit(0);
  } catch (err) {
    console.error('Error in inspect:', err);
    process.exit(1);
  }
}

inspect();
