const mongoose = require('mongoose');
require('dotenv').config();

async function updateTargetProduct() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const yellowImages = [
    'http://localhost:5001/product-images/6ad091906d57197660a81cf9',
    'http://localhost:5001/product-images/6ad091906d57197660a81cfa',
    'http://localhost:5001/product-images/6ad091906d57197660a81cfb',
    'http://localhost:5001/product-images/6ad091906d57197660a81cfc',
  ];

  const magentaImages = [
    'http://localhost:5001/product-images/6ad091626d57197660a81cae',
    'http://localhost:5001/product-images/6ad091626d57197660a81cab',
    'http://localhost:5001/product-images/6ad091626d57197660a81cac',
  ];

  const allMainImages = [
    'http://localhost:5001/product-images/6ad091906d57197660a81cf9',
    'http://localhost:5001/product-images/6ad091906d57197660a81cfa',
    'http://localhost:5001/product-images/6ad091906d57197660a81cfb',
    'http://localhost:5001/product-images/6ad091906d57197660a81cfc',
    'http://localhost:5001/product-images/6ad091626d57197660a81cae',
    'http://localhost:5001/product-images/6ad091626d57197660a81cab',
    'http://localhost:5001/product-images/6ad091626d57197660a81cad',
  ];

  const colorVariants = [
    {
      color: 'Yellow',
      sku: 'SKU-5245-YEL',
      images: yellowImages
    },
    {
      color: 'Magenta',
      sku: 'SKU-5245-MAG',
      images: magentaImages
    }
  ];

  const res = await db.collection('products').updateOne(
    { _id: new mongoose.Types.ObjectId('6ad091706d57197660a81cc8') },
    {
      $set: {
        images: allMainImages,
        imageUrl: allMainImages[0],
        colors: ['Yellow', 'Magenta'],
        colorVariants: colorVariants,
        'categoryAttributes.color': ['Yellow', 'Magenta']
      }
    }
  );

  console.log('Update result:', res);
  await mongoose.disconnect();
}
updateTargetProduct().catch(console.error);
