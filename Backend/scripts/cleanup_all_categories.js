const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Category, Product, Order, Inventory, User, WholesalerProfile } = require('../src/models');
const { connectDB, disconnectDB } = require('../src/config/database');

async function performCategoryCleanup(targetUri = null) {
  let connection;
  if (targetUri) {
    connection = await mongoose.connect(targetUri, { autoIndex: true, serverSelectionTimeoutMS: 5000 });
  } else {
    connection = await connectDB();
  }

  const db = connection.db || connection.connection.db;
  const dbName = db.databaseName;
  console.log(`\n============================================================`);
  console.log(`Starting Category & Subcategory Cleanup in DB: "${dbName}"`);
  console.log(`============================================================\n`);

  // 1. Snapshot Before State
  const initialCategoryCount = await Category.countDocuments({});
  const initialRootCategories = await Category.find({ $or: [{ parentId: null }, { parentCategoryId: null }] }).lean();
  const initialSubcategories = await Category.find({
    $and: [
      { parentId: { $ne: null } },
      { parentCategoryId: { $ne: null } }
    ]
  }).lean();
  const initialProductsCount = await Product.countDocuments({});
  const initialOrdersCount = await Order.countDocuments({});
  const initialInventoriesCount = await Inventory.countDocuments({});
  const initialWholesalersCount = await WholesalerProfile.countDocuments({});
  const initialUsersCount = await User.countDocuments({});

  console.log('--- [BEFORE CLEANUP SNAPSHOT] ---');
  console.log(`Total Categories in DB: ${initialCategoryCount}`);
  console.log(`Total Products: ${initialProductsCount}`);
  console.log(`Total Orders: ${initialOrdersCount}`);
  console.log(`Total Inventories: ${initialInventoriesCount}`);
  console.log(`Total Wholesalers: ${initialWholesalersCount}`);
  console.log(`Total Users: ${initialUsersCount}`);

  const allCategories = await Category.find({}).lean();
  console.log(`\nListing all ${allCategories.length} categories to be deleted:`);
  allCategories.forEach((cat, idx) => {
    console.log(`  ${idx + 1}. [${cat.level ? 'Level ' + cat.level : 'Root'}] "${cat.name}" (slug: ${cat.slug}, ID: ${cat._id}, wholesalerId: ${cat.wholesalerId || 'GLOBAL'}, isDemo: ${cat.isDemo || false}, isDeleted: ${cat.isDeleted || false})`);
  });

  // 2. Remove category references from existing products safely (DO NOT delete products)
  console.log('\n--- [STEP 1: SAFELY UNLINKING CATEGORY REFERENCES FROM PRODUCTS] ---');
  const productUpdateResult = await Product.updateMany(
    {},
    {
      $set: {
        categoryId: null,
        category: null,
        subcategoryId: null,
        subCategory: null,
        subSubcategoryId: null,
        categoryName: '',
        subcategoryName: '',
        subSubcategoryName: '',
      },
    }
  );
  console.log(`Updated ${productUpdateResult.modifiedCount} products. Category references removed safely.`);

  // 3. Delete ALL categories and subcategories (root, sub, demo, real, active, deleted)
  console.log('\n--- [STEP 2: PERMANENTLY DELETING ALL CATEGORIES & SUBCATEGORIES] ---');
  const deleteCategoriesResult = await Category.deleteMany({});
  console.log(`Deleted ${deleteCategoriesResult.deletedCount} categories and subcategories from collection 'categories'.`);

  // 4. Verify post-cleanup state
  console.log('\n--- [STEP 3: POST-CLEANUP VERIFICATION] ---');
  const remainingCategories = await Category.countDocuments({});
  const finalProductsCount = await Product.countDocuments({});
  const finalOrdersCount = await Order.countDocuments({});
  const finalInventoriesCount = await Inventory.countDocuments({});
  const finalWholesalersCount = await WholesalerProfile.countDocuments({});
  const finalUsersCount = await User.countDocuments({});

  console.log(`Remaining categories: ${remainingCategories} (Expected: 0)`);
  console.log(`Remaining products: ${finalProductsCount} (Expected: ${initialProductsCount})`);
  console.log(`Remaining orders: ${finalOrdersCount} (Expected: ${initialOrdersCount})`);
  console.log(`Remaining inventories: ${finalInventoriesCount} (Expected: ${initialInventoriesCount})`);
  console.log(`Remaining wholesaler profiles: ${finalWholesalersCount} (Expected: ${initialWholesalersCount})`);
  console.log(`Remaining users: ${finalUsersCount} (Expected: ${initialUsersCount})`);

  if (remainingCategories !== 0) {
    throw new Error(`Verification failed: ${remainingCategories} categories still remain!`);
  }
  if (finalProductsCount !== initialProductsCount) {
    throw new Error(`Verification failed: Products count changed from ${initialProductsCount} to ${finalProductsCount}!`);
  }
  if (finalOrdersCount !== initialOrdersCount) {
    throw new Error(`Verification failed: Orders count changed!`);
  }
  if (finalInventoriesCount !== initialInventoriesCount) {
    throw new Error(`Verification failed: Inventories count changed!`);
  }

  // Double check that no products have broken category references
  const productsWithCatRef = await Product.countDocuments({
    $or: [
      { categoryId: { $ne: null } },
      { category: { $ne: null } },
      { subcategoryId: { $ne: null } },
      { subCategory: { $ne: null } },
      { subSubcategoryId: { $ne: null } },
    ],
  });
  console.log(`Products with non-null category references: ${productsWithCatRef} (Expected: 0)`);
  if (productsWithCatRef !== 0) {
    throw new Error(`Verification failed: ${productsWithCatRef} products still have non-null category references!`);
  }

  console.log(`\n============================================================`);
  console.log(`SUCCESS: All categories and subcategories permanently deleted.`);
  console.log(`All business data intact. Category deletion functionality ready.`);
  console.log(`Wholesalers can now create fresh custom categories.`);
  console.log(`============================================================\n`);

  if (!targetUri) {
    await disconnectDB();
  } else {
    await mongoose.disconnect();
  }

  return {
    deletedCategoriesCount: deleteCategoriesResult.deletedCount,
    updatedProductsCount: productUpdateResult.modifiedCount,
    remainingCategories,
    preservedProductsCount: finalProductsCount,
    preservedOrdersCount: finalOrdersCount,
    preservedInventoriesCount: finalInventoriesCount,
  };
}

if (require.main === module) {
  performCategoryCleanup().catch((err) => {
    console.error('Category cleanup failed:', err);
    process.exit(1);
  });
}

module.exports = performCategoryCleanup;
