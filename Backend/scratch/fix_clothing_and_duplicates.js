const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Category = require('../src/models/Category');
const Product = require('../src/models/Product');

async function migrate() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/b2b-wholesale';
    console.log('Connecting to Mongo:', mongoUri);
    await mongoose.connect(mongoUri);

    console.log('\n=== STEP 1: CREATE / ENSURE UNIFIED ROOT CATEGORY "Clothing" ===');
    
    // Find or create global root category "Clothing"
    let rootClothing = await Category.findOne({
      $or: [
        { slug: 'clothing' },
        { name: /^clothing$/i },
        { slug: 'clothes-global' }
      ],
      parentId: null
    });

    if (!rootClothing) {
      rootClothing = await Category.create({
        name: 'Clothing',
        slug: 'clothing',
        description: 'Apparel, Fashion & Textiles for Men, Women, and Kids',
        imageUrl: 'http://localhost:5001/uploads/products/4f0b7afc-ada9-40d1-9a87-e7ade720cc12.webp',
        parentId: null,
        parentCategoryId: null,
        level: 1,
        wholesalerId: null,
        isActive: true,
        isDeleted: false,
      });
      console.log('Created root "Clothing" category:', rootClothing._id.toString());
    } else {
      rootClothing.name = 'Clothing';
      rootClothing.slug = 'clothing';
      rootClothing.parentId = null;
      rootClothing.parentCategoryId = null;
      rootClothing.level = 1;
      rootClothing.wholesalerId = null;
      rootClothing.isDeleted = false;
      rootClothing.isActive = true;
      await rootClothing.save();
      console.log('Updated existing root category to "Clothing":', rootClothing._id.toString());
    }

    const mainClothingId = rootClothing._id;

    // Find all redundant/duplicate top-level "clothes" or "clothing" categories
    const redundantRoots = await Category.find({
      _id: { $ne: mainClothingId },
      parentId: null,
      name: { $regex: /^(clothes|clothing|apparel)$/i }
    });

    const redundantRootIds = redundantRoots.map(c => c._id.toString());
    console.log('Redundant top-level root IDs to merge:', redundantRootIds);

    console.log('\n=== STEP 2: CREATE / UPDATE LEVEL 2 SUBCATEGORIES (Women, Men, Kids) ===');
    
    const l2Definitions = [
      { name: 'Women', slug: 'women', desc: 'Women\'s Apparel, Ethnic Wear & Western Wear' },
      { name: 'Men', slug: 'men', desc: 'Men\'s Apparel, Shirts, Trousers & Ethnic Wear' },
      { name: 'Kids', slug: 'kids', desc: 'Children\'s Apparel, Boys, Girls & Babywear' },
    ];

    const l2Map = {};

    for (const def of l2Definitions) {
      let l2Cat = await Category.findOne({
        name: { $regex: new RegExp(`^${def.name}$`, 'i') },
        parentId: { $in: [mainClothingId, ...redundantRootIds] },
      });

      if (!l2Cat) {
        l2Cat = await Category.create({
          name: def.name,
          slug: def.slug,
          description: def.desc,
          parentId: mainClothingId,
          parentCategoryId: mainClothingId,
          level: 2,
          wholesalerId: null,
          isActive: true,
          isDeleted: false,
        });
        console.log(`Created Level 2 category "${def.name}":`, l2Cat._id.toString());
      } else {
        l2Cat.name = def.name;
        l2Cat.slug = def.slug;
        l2Cat.parentId = mainClothingId;
        l2Cat.parentCategoryId = mainClothingId;
        l2Cat.level = 2;
        l2Cat.isDeleted = false;
        l2Cat.isActive = true;
        await l2Cat.save();
        console.log(`Updated Level 2 category "${def.name}":`, l2Cat._id.toString());
      }
      l2Map[def.name] = l2Cat._id;
    }

    console.log('\n=== STEP 3: CREATE / UPDATE LEVEL 3 SUB-SUBCATEGORIES ===');

    const l3Definitions = {
      Women: [
        { name: 'Saree', slug: 'women-saree' },
        { name: 'Lehenga', slug: 'women-lehenga' },
        { name: 'Kurti & Suits', slug: 'women-kurti-suits' },
        { name: 'Gowns', slug: 'women-gowns' },
        { name: 'Western Wear', slug: 'women-western-wear' },
      ],
      Men: [
        { name: 'Shirts', slug: 'men-shirts' },
        { name: 'T-Shirts', slug: 'men-tshirts' },
        { name: 'Jeans & Trousers', slug: 'men-jeans-trousers' },
        { name: 'Kurtas & Ethnic', slug: 'men-kurtas' },
      ],
      Kids: [
        { name: 'Boys Wear', slug: 'kids-boys' },
        { name: 'Girls Wear', slug: 'kids-girls' },
        { name: 'Infants & Babywear', slug: 'kids-infants' },
      ]
    };

    const l3Map = {};

    for (const [parentName, subList] of Object.entries(l3Definitions)) {
      const parentId = l2Map[parentName];
      for (const item of subList) {
        let l3Cat = await Category.findOne({
          name: { $regex: new RegExp(`^${item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          parentId: parentId,
        });

        if (!l3Cat) {
          l3Cat = await Category.create({
            name: item.name,
            slug: item.slug,
            description: `${item.name} for ${parentName}`,
            parentId: parentId,
            parentCategoryId: parentId,
            level: 3,
            wholesalerId: null,
            isActive: true,
            isDeleted: false,
          });
          console.log(`Created Level 3 "${item.name}" under ${parentName}:`, l3Cat._id.toString());
        } else {
          l3Cat.name = item.name;
          l3Cat.parentId = parentId;
          l3Cat.parentCategoryId = parentId;
          l3Cat.level = 3;
          l3Cat.isDeleted = false;
          l3Cat.isActive = true;
          await l3Cat.save();
          console.log(`Updated Level 3 "${item.name}" under ${parentName}:`, l3Cat._id.toString());
        }
        l3Map[`${parentName}>${item.name}`] = l3Cat._id;
      }
    }

    console.log('\n=== STEP 4: SOFT DELETE REPEATED / BROKEN SUBCATEGORIES ===');
    
    // Soft-delete redundant top-level clothes categories
    for (const rId of redundantRootIds) {
      await Category.findByIdAndUpdate(rId, { isDeleted: true });
      console.log('Soft-deleted redundant root category:', rId);
    }

    // Soft-delete invalid Level 4 saree node (6abcb05a737b4f097d511ad1)
    await Category.updateOne({ _id: '6abcb05a737b4f097d511ad1' }, { isDeleted: true, parentId: null, parentCategoryId: null });
    console.log('Soft-deleted invalid Level 4 Saree node');

    console.log('\n=== STEP 5: RE-LINK EXISTING PRODUCTS TO CLEAN HIERARCHY ===');

    const products = await Product.find({}).lean();
    for (const p of products) {
      const pCatIdStr = p.categoryId ? p.categoryId.toString() : '';
      const pSubCatIdStr = p.subcategoryId ? p.subcategoryId.toString() : '';

      let needsUpdate = false;
      let newCatId = p.categoryId;
      let newSubCatId = p.subcategoryId;
      let newCategoryName = p.category;

      // If product was attached to one of the redundant root clothes IDs
      if (!pCatIdStr || redundantRootIds.includes(pCatIdStr) || pCatIdStr === mainClothingId.toString()) {
        newCatId = mainClothingId;
        newCategoryName = 'Clothing';
        needsUpdate = true;
      }

      // If product title or subcategoryId hints at specific subcategories
      const titleLower = (p.title || p.name || '').toLowerCase();
      if (titleLower.includes('saree') || titleLower.includes('sare')) {
        newCatId = mainClothingId;
        newCategoryName = 'Clothing';
        newSubCatId = l3Map['Women>Saree'] || l2Map['Women'];
        needsUpdate = true;
      } else if (titleLower.includes('lehnga') || titleLower.includes('lehenga') || titleLower.includes('chaniya')) {
        newCatId = mainClothingId;
        newCategoryName = 'Clothing';
        newSubCatId = l3Map['Women>Lehenga'] || l2Map['Women'];
        needsUpdate = true;
      } else if (titleLower.includes('gown')) {
        newCatId = mainClothingId;
        newCategoryName = 'Clothing';
        newSubCatId = l3Map['Women>Gowns'] || l2Map['Women'];
        needsUpdate = true;
      }

      if (needsUpdate) {
        await Product.findByIdAndUpdate(p._id, {
          category: mainClothingId,
          categoryId: mainClothingId,
          subcategoryId: newSubCatId,
        });
        console.log(`Updated product "${p.title || p.name}" (${p._id}): categoryId=${mainClothingId}, subcategoryId=${newSubCatId}`);
      }
    }

    console.log('\n=== STEP 6: SYNC parentCategoryId AND level ON ALL ACTIVE CATEGORIES ===');

    const allCats = await Category.find({ isDeleted: false });
    for (const cat of allCats) {
      const pId = cat.parentCategoryId || cat.parentId;
      let level = 1;
      let syncParent = null;
      if (pId) {
        const parentDoc = await Category.findById(pId);
        if (parentDoc) {
          syncParent = parentDoc._id;
          level = Math.min(3, (parentDoc.level || 1) + 1);
        }
      }
      await Category.updateOne(
        { _id: cat._id },
        { parentId: syncParent, parentCategoryId: syncParent, level }
      );
    }

    console.log('\n=== MIGRATION FINISHED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('Error during migration:', err);
    process.exit(1);
  }
}

migrate();
