const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CategoryService = require('../src/modules/categories/categories.service');

async function testTree() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/b2b-wholesale';
    await mongoose.connect(mongoUri);

    console.log('\n--- GET CATEGORY TREE OUTPUT ---');
    const tree = await CategoryService.getCategoryTree();
    console.log(JSON.stringify(tree, null, 2));

    console.log('\n--- LIST CATEGORIES OUTPUT ---');
    const list = await CategoryService.listCategories({});
    console.log(`Total items returned by listCategories: ${list.items.length}`);
    list.items.forEach(c => {
      console.log(`- ${c.name} (ID: ${c.id}, Level: ${c.level}, ParentId: ${c.parentId ? (c.parentId._id || c.parentId) : 'null'}, Path: ${c.displayPath})`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error in testTree:', err);
    process.exit(1);
  }
}

testTree();
