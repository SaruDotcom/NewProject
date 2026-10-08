export interface CategoryAttributeDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'date';
  required: boolean;
  options?: string[];
  placeholder?: string;
  description?: string;
}

export const CATEGORY_ATTRIBUTES: Record<string, CategoryAttributeDef[]> = {
  clothing: [
    {
      key: 'size',
      label: 'Sizes Available',
      type: 'multiselect',
      required: true,
      options: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Free Size'],
      placeholder: 'Type size and press Enter (e.g. S, M, L)',
    },
    {
      key: 'color',
      label: 'Colors Available',
      type: 'multiselect',
      required: true,
      options: ['Red', 'Blue', 'Black', 'White', 'Green', 'Yellow', 'Pink', 'Grey', 'Navy', 'Beige', 'Multicolor'],
      placeholder: 'Type color and press Enter',
    },
    {
      key: 'fabric',
      label: 'Fabric / Material',
      type: 'select',
      required: false,
      options: ['100% Cotton', 'Polyester', 'Denim', 'Silk', 'Linen', 'Rayon', 'Wool', 'Blended', 'Nylon', 'Satin'],
    },
    {
      key: 'fit',
      label: 'Fit Type',
      type: 'select',
      required: false,
      options: ['Regular Fit', 'Slim Fit', 'Loose Fit', 'Oversized', 'Tailored Fit', 'Relaxed Fit'],
    },
    {
      key: 'sleeveType',
      label: 'Sleeve Type',
      type: 'select',
      required: false,
      options: ['Half Sleeve', 'Full Sleeve', 'Sleeveless', '3/4 Sleeve', 'Short Sleeve'],
    },
    {
      key: 'pattern',
      label: 'Pattern',
      type: 'select',
      required: false,
      options: ['Solid', 'Printed', 'Striped', 'Checked', 'Floral', 'Self Design', 'Embroidered'],
    },
    {
      key: 'occasion',
      label: 'Occasion',
      type: 'select',
      required: false,
      options: ['Casual', 'Formal', 'Party Wear', 'Ethnic / Traditional', 'Sports / Activewear'],
    },
    {
      key: 'gender',
      label: 'Target Gender',
      type: 'select',
      required: false,
      options: ['Men', 'Women', 'Unisex', 'Boys', 'Girls'],
    },
    {
      key: 'careInstructions',
      label: 'Care Instructions',
      type: 'text',
      required: false,
      placeholder: 'e.g. Machine wash cold, dry flat',
    },
  ],

  footwear: [
    {
      key: 'size',
      label: 'Shoe Sizes (UK/India)',
      type: 'multiselect',
      required: true,
      options: ['UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'],
    },
    {
      key: 'color',
      label: 'Colors Available',
      type: 'multiselect',
      required: true,
      options: ['Black', 'Brown', 'Tan', 'White', 'Grey', 'Navy Blue', 'Red'],
    },
    {
      key: 'material',
      label: 'Upper Material',
      type: 'select',
      required: false,
      options: ['Genuine Leather', 'Synthetic Leather', 'Mesh', 'Canvas', 'Suede', 'PU / Rubber'],
    },
    {
      key: 'soleType',
      label: 'Sole Material',
      type: 'select',
      required: false,
      options: ['Rubber', 'EVA', 'TPR', 'Leather', 'PU', 'Phylon'],
    },
    {
      key: 'closureType',
      label: 'Closure Type',
      type: 'select',
      required: false,
      options: ['Lace-Up', 'Slip-On', 'Velcro', 'Buckle', 'Zipper'],
    },
    {
      key: 'occasion',
      label: 'Occasion',
      type: 'select',
      required: false,
      options: ['Casual', 'Formal', 'Sports / Running', 'Party Wear', 'Ethnic'],
    },
  ],

  electronics: [
    {
      key: 'modelNumber',
      label: 'Model Number / Name',
      type: 'text',
      required: false,
      placeholder: 'e.g. EB-2026-X',
    },
    {
      key: 'variant',
      label: 'Variant / Spec',
      type: 'text',
      required: false,
      placeholder: 'e.g. 8GB RAM / 128GB Storage',
    },
    {
      key: 'color',
      label: 'Color',
      type: 'select',
      required: false,
      options: ['Black', 'White', 'Silver', 'Space Grey', 'Blue', 'Gold'],
    },
    {
      key: 'warrantyPeriod',
      label: 'Warranty Period',
      type: 'select',
      required: true,
      options: ['6 Months Manufacturer Warranty', '1 Year Manufacturer Warranty', '2 Years Manufacturer Warranty', 'No Warranty'],
    },
    {
      key: 'batterySpecs',
      label: 'Battery Specifications',
      type: 'text',
      required: false,
      placeholder: 'e.g. 5000 mAh Li-ion, 45W Fast Charging',
    },
    {
      key: 'connectivity',
      label: 'Connectivity Options',
      type: 'multiselect',
      required: false,
      options: ['Bluetooth 5.3', 'Wi-Fi 6', 'USB-C', 'HDMI', '3.5mm Jack', 'NFC', '5G / Cellular'],
    },
    {
      key: 'includedAccessories',
      label: 'Included Accessories',
      type: 'text',
      required: false,
      placeholder: 'e.g. Charging Cable, User Manual, Adapter',
    },
  ],

  home_kitchen: [
    {
      key: 'material',
      label: 'Material',
      type: 'select',
      required: false,
      options: ['Stainless Steel', 'Plastic (BPA Free)', 'Glass', 'Wood', 'Ceramic', 'Cast Iron', 'Aluminium'],
    },
    {
      key: 'colorFinish',
      label: 'Color / Finish',
      type: 'text',
      required: false,
      placeholder: 'e.g. Matte Black, Mirror Finish',
    },
    {
      key: 'capacity',
      label: 'Capacity / Volume',
      type: 'text',
      required: false,
      placeholder: 'e.g. 1.5 Liters, 500 grams, 4 Seater',
    },
    {
      key: 'assemblyRequired',
      label: 'Assembly Required',
      type: 'select',
      required: false,
      options: ['No (Pre-assembled)', 'Yes (DIY Kit Included)', 'Professional Assembly Provided'],
    },
    {
      key: 'warrantyPeriod',
      label: 'Warranty Period',
      type: 'select',
      required: false,
      options: ['1 Year', '2 Years', '5 Years', 'No Warranty'],
    },
  ],

  beauty_personal_care: [
    {
      key: 'volumeWeight',
      label: 'Net Volume / Weight',
      type: 'text',
      required: true,
      placeholder: 'e.g. 100 ml, 250 g, Pack of 2 x 50g',
    },
    {
      key: 'suitableFor',
      label: 'Suitable For Skin / Hair Type',
      type: 'select',
      required: false,
      options: ['All Skin Types', 'Oily Skin', 'Dry Skin', 'Sensitive Skin', 'Normal Skin', 'All Hair Types'],
    },
    {
      key: 'keyIngredients',
      label: 'Key Ingredients',
      type: 'text',
      required: false,
      placeholder: 'e.g. Vitamin C, Hyaluronic Acid, Aloe Vera',
    },
    {
      key: 'shade',
      label: 'Shade / Variant',
      type: 'text',
      required: false,
      placeholder: 'e.g. Natural Beige #02',
    },
    {
      key: 'expiryDate',
      label: 'Expiration Date / Shelf Life',
      type: 'date',
      required: true,
    },
  ],

  grocery: [
    {
      key: 'netQuantity',
      label: 'Net Quantity',
      type: 'text',
      required: true,
      placeholder: 'e.g. 1 kg, 500 g, 5 Liters',
    },
    {
      key: 'expiryDate',
      label: 'Expiry Date / Best Before Date',
      type: 'date',
      required: true,
    },
    {
      key: 'vegNonVeg',
      label: 'Dietary Preference',
      type: 'select',
      required: true,
      options: ['Vegetarian', 'Non-Vegetarian', 'Egg', 'Vegan'],
    },
    {
      key: 'fssaiLicense',
      label: 'FSSAI License Number',
      type: 'text',
      required: true,
      placeholder: '14-digit FSSAI Registration / License No',
    },
    {
      key: 'storageInstructions',
      label: 'Storage Instructions',
      type: 'text',
      required: false,
      placeholder: 'e.g. Store in a cool, dry place away from direct sunlight',
    },
  ],

  jewelry: [
    {
      key: 'material',
      label: 'Primary Material',
      type: 'select',
      required: true,
      options: ['Gold', 'Silver', 'Platinum', 'Brass / Alloy', 'Copper', 'Sterling Silver 925', 'Stainless Steel'],
    },
    {
      key: 'purity',
      label: 'Metal Purity',
      type: 'select',
      required: false,
      options: ['24K (99.9%)', '22K (91.6%)', '18K (75%)', '14K (58.5%)', 'Silver 925 Hallmark', 'Artificial / One Gram Gold'],
    },
    {
      key: 'weight',
      label: 'Net Weight (grams)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 12.5',
    },
    {
      key: 'gemstoneDetails',
      label: 'Gemstone / Diamond Details',
      type: 'text',
      required: false,
      placeholder: 'e.g. Cubic Zirconia, Pearl, Uncut Diamond',
    },
  ],
};

export function normalizeCategoryKey(nameOrSlug: string): string | null {
  if (!nameOrSlug) return null;
  const str = String(nameOrSlug).toLowerCase().trim();

  if (str.includes('cloth') || str.includes('fashion') || str.includes('apparel') || str.includes('garments') || str.includes('wear')) {
    return 'clothing';
  }
  if (str.includes('footwear') || str.includes('shoe') || str.includes('sandal') || str.includes('slipper')) {
    return 'footwear';
  }
  if (str.includes('electronic') || str.includes('gadget') || str.includes('mobile') || str.includes('appliances')) {
    return 'electronics';
  }
  if (str.includes('home') || str.includes('kitchen') || str.includes('furniture') || str.includes('decor')) {
    return 'home_kitchen';
  }
  if (str.includes('beauty') || str.includes('personal') || str.includes('cosmetic') || str.includes('care')) {
    return 'beauty_personal_care';
  }
  if (str.includes('grocery') || str.includes('fmcg') || str.includes('staple') || str.includes('food') || str.includes('beverage')) {
    return 'grocery';
  }
  if (str.includes('jewel') || str.includes('jewellery') || str.includes('ornament')) {
    return 'jewelry';
  }

  return null;
}

export function getCategoryAttributeSchema(categoryNameOrSlug: string): CategoryAttributeDef[] {
  const normalizedKey = normalizeCategoryKey(categoryNameOrSlug);
  return normalizedKey ? CATEGORY_ATTRIBUTES[normalizedKey] || [] : [];
}
