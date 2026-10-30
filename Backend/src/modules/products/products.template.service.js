const ExcelJS = require('exceljs');
const { Category } = require('../../models');
const { getCategoryAttributeSchema, normalizeCategoryKey } = require('../../config/categoryAttributes');
const { BadRequestError } = require('../../utils/errors');

const TEMPLATE_LABELS = {
  clothing: 'Clothing',
  footwear: 'Footwear',
  electronics: 'Electronics',
  grocery: 'Grocery',
  beauty_personal_care: 'Beauty',
  jewelry: 'Jewelry',
  home_kitchen: 'Home',
};

const CATEGORY_FIELD_HEADERS = {
  clothing: {
    Fabric: 'fabric',
    Fit: 'fit',
    'Sleeve Type': 'sleeveType',
    Pattern: 'pattern',
    Occasion: 'occasion',
    Gender: 'gender',
    'Care Instructions': 'careInstructions',
  },
  footwear: {
    Material: 'material',
    'Sole Type': 'soleType',
    Closure: 'closureType',
    Occasion: 'occasion',
  },
  electronics: {
    'Model Number': 'modelNumber',
    Warranty: 'warrantyPeriod',
    Battery: 'batterySpecs',
    Connectivity: 'connectivity',
    'Included Accessories': 'includedAccessories',
  },
  grocery: {
    'Net Quantity': 'netQuantity',
    'Expiry Date': 'expiryDate',
    'Veg/Non-Veg': 'vegNonVeg',
    'FSSAI License': 'fssaiLicense',
    'Storage Instructions': 'storageInstructions',
  },
  beauty_personal_care: {
    Volume: 'volumeWeight',
    'Suitable For': 'suitableFor',
    'Key Ingredients': 'keyIngredients',
    'Expiry Date': 'expiryDate',
  },
  jewelry: {
    Material: 'material',
    Purity: 'purity',
    Weight: 'weight',
    'Gemstone Details': 'gemstoneDetails',
  },
  home_kitchen: {
    Material: 'material',
    Capacity: 'capacity',
    Warranty: 'warrantyPeriod',
  },
};

const COMMON_COLUMNS = [
  { key: 'Product Name', header: 'Product Name*', description: 'Enter the product name.' },
  { key: 'SKU', header: 'SKU*', description: 'Enter a unique stock-keeping unit for this product.' },
  { key: 'Brand', header: 'Brand', description: 'Enter the product brand, if applicable.' },
  { key: 'Description', header: 'Description*', description: 'Describe the product and its key details.' },
  { key: 'Category', header: 'Parent Category*', description: 'Choose a parent category from the dropdown.' },
  { key: 'Subcategory', header: 'Sub Category*', description: 'Choose a subcategory belonging to the selected parent category.' },
  { key: 'Sub-subcategory', header: 'Sub-subcategory', description: 'Enter an optional sub-subcategory.' },
  { key: 'Cost Price', header: 'Cost Price*', description: 'Enter your cost per unit.' },
  { key: 'MRP', header: 'MRP*', description: 'Enter the maximum retail price per unit.' },
  { key: 'Selling Price', header: 'Selling Price*', description: 'Enter your selling price per unit.' },
  { key: 'MOQ', header: 'MOQ*', description: 'Enter the minimum order quantity.' },
  { key: 'Stock Quantity', header: 'Stock Quantity*', description: 'Enter the available stock quantity.' },
  { key: 'Low Stock Threshold', header: 'Low Stock Threshold', description: 'Enter the quantity at which stock should be considered low.' },
  { key: 'HSN Code', header: 'HSN Code', description: 'Enter the product HSN tax code, if applicable.' },
  { key: 'CGST %', header: 'CGST %', description: 'Enter CGST percentage, if applicable.' },
  { key: 'SGST %', header: 'SGST %', description: 'Enter SGST percentage, if applicable.' },
  { key: 'IGST %', header: 'IGST %', description: 'Choose 0, 5, 12, 18 or 28 when applicable.' },
  { key: 'Price Includes Tax', header: 'Price Includes Tax', description: 'Enter Yes when the selling price includes tax; otherwise No.' },
  { key: 'Tier 1 Min Qty', header: 'Tier 1 Min Qty', description: 'Enter the minimum quantity for bulk price tier 1.' },
  { key: 'Tier 1 Price', header: 'Tier 1 Price', description: 'Enter the unit price for bulk price tier 1.' },
  { key: 'Tier 2 Min Qty', header: 'Tier 2 Min Qty', description: 'Enter the minimum quantity for bulk price tier 2.' },
  { key: 'Tier 2 Price', header: 'Tier 2 Price', description: 'Enter the unit price for bulk price tier 2.' },
  { key: 'Tier 3 Min Qty', header: 'Tier 3 Min Qty', description: 'Enter the minimum quantity for bulk price tier 3.' },
  { key: 'Tier 3 Price', header: 'Tier 3 Price', description: 'Enter the unit price for bulk price tier 3.' },
  { key: 'Weight', header: 'Weight', description: 'Enter the product weight.' },
  { key: 'Weight Unit', header: 'Weight Unit', description: 'Enter the weight unit, such as kg or g.' },
  { key: 'Length', header: 'Length', description: 'Enter the package length.' },
  { key: 'Width', header: 'Width', description: 'Enter the package width.' },
  { key: 'Height', header: 'Height', description: 'Enter the package height.' },
];

const SIZE_CHART = {
  clothing: {
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Free Size'],
    measurements: ['Chest', 'Waist', 'Length', 'Shoulder'],
  },
  footwear: {
    sizes: ['UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'],
    measurements: ['Foot Length', 'Foot Width'],
  },
};

const MAX_TEMPLATE_ROWS = 500;
const columnLetter = (column) => column.letter;
const parentIdOf = (category) => String(category.parentCategoryId || category.parentId || '');

function makeColumns(categoryKey) {
  const columns = COMMON_COLUMNS.map((column) => ({ ...column }));
  const sizeChart = SIZE_CHART[categoryKey];
  if (sizeChart) {
    columns.push(
      { key: 'Sizes', header: 'Sizes*', description: 'Enter available sizes separated by commas.' },
      { key: 'Colors', header: 'Colors*', description: 'Enter available colors separated by commas.' },
      { key: 'Size Chart Unit', header: 'Size Chart Unit', description: 'Choose inch or cm when entering size measurements.' },
    );
    sizeChart.sizes.forEach((size) => sizeChart.measurements.forEach((measurement) => {
      const key = `Size Chart - ${size} - ${measurement}`;
      columns.push({ key, header: key, description: `Enter the ${measurement.toLowerCase()} measurement for size ${size}.` });
    }));
  }

  const schema = getCategoryAttributeSchema(categoryKey);
  Object.entries(CATEGORY_FIELD_HEADERS[categoryKey] || {}).forEach(([header, key]) => {
    const definition = schema.find((attribute) => attribute.key === key);
    const existingColumn = columns.find((column) => column.key === header);
    if (existingColumn) {
      if (definition?.required && !existingColumn.header.endsWith('*')) existingColumn.header += '*';
      existingColumn.description = definition?.placeholder || definition?.label || existingColumn.description;
      if (definition?.options?.length) existingColumn.options = definition.options;
      return;
    }
    columns.push({
      key: header,
      header: `${header}${definition?.required ? '*' : ''}`,
      options: definition?.options,
      description: definition?.label || `Enter ${header.toLowerCase()}.`,
    });
  });

  columns.push(
    { key: 'Image URLs', header: 'Image URLs', description: 'Enter up to five comma-separated HTTP or HTTPS image URLs, or leave blank.' },
    { key: 'Status', header: 'Status', description: 'Choose ACTIVE or DRAFT from the dropdown.' },
  );
  return columns;
}

function setDropdown(sheet, column, formulaForRow, firstRow = 3, lastRow = MAX_TEMPLATE_ROWS + 2) {
  for (let row = firstRow; row <= lastRow; row += 1) {
    sheet.getCell(row, column).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formulaForRow(row)],
      showErrorMessage: true,
      errorTitle: 'Choose a listed value',
      error: 'Select a value from the dropdown list.',
    };
  }
}

function addNamedList(workbook, sheet, name, values) {
  const unique = [...new Set(values.filter(Boolean))];
  if (unique.length === 0) return false;
  const columnNumber = sheet.columnCount + 1;
  sheet.getColumn(columnNumber).values = [name, ...unique];
  const letter = columnLetter(sheet.getColumn(columnNumber));
  workbook.definedNames.add(`Dropdowns!$${letter}$2:$${letter}$${unique.length + 1}`, name);
  return true;
}

function categoryPaths(categories, roots) {
  const rootIds = new Set(roots.map((root) => String(root._id)));
  const children = categories.filter((category) => rootIds.has(parentIdOf(category)));
  return children.flatMap((subcategory) => {
    const nested = categories.filter((category) => parentIdOf(category) === String(subcategory._id));
    return (nested.length ? nested : [null]).map((subSubcategory) => ({
      category: roots.find((root) => String(root._id) === parentIdOf(subcategory)).name,
      subcategory: subcategory.name,
      subSubcategory: subSubcategory?.name || '',
    }));
  });
}

function exampleData(categoryKey, columns, firstPath) {
  const examples = {
    'Product Name': `Example ${TEMPLATE_LABELS[categoryKey]} Product (do not import)`,
    SKU: 'EXAMPLE-001',
    Brand: 'Example Brand',
    Description: 'Example row only. Enter products starting in row 3.',
    Category: firstPath?.category || '',
    Subcategory: firstPath?.subcategory || '',
    'Sub-subcategory': firstPath?.subSubcategory || '',
    'Cost Price': 100,
    MRP: 250,
    'Selling Price': 150,
    MOQ: 10,
    'Stock Quantity': 100,
    'Low Stock Threshold': 10,
    'HSN Code': '',
    'CGST %': 9,
    'SGST %': 9,
    'IGST %': 18,
    'Price Includes Tax': 'No',
    'Tier 1 Min Qty': 50,
    'Tier 1 Price': 140,
    'Tier 2 Min Qty': '',
    'Tier 2 Price': '',
    'Tier 3 Min Qty': '',
    'Tier 3 Price': '',
    Weight: 0.5,
    'Weight Unit': 'kg',
    Length: 20,
    Width: 15,
    Height: 5,
    Sizes: categoryKey === 'clothing' ? 'S,M,L' : 'UK 6,UK 7',
    Colors: 'Black,Blue',
    'Size Chart Unit': 'cm',
    Fabric: '100% Cotton',
    'Model Number': 'EX-100',
    Warranty: '1 Year Manufacturer Warranty',
    'Net Quantity': '1 kg',
    'Expiry Date': '2027-12-31',
    'Veg/Non-Veg': 'Veg',
    'FSSAI License': '12345678901234',
    Volume: '100 ml',
    Material: 'Stainless Steel',
    Purity: '22K (91.6%)',
    Capacity: '1.5 Liters',
    'Gemstone Details': 'Cubic Zirconia',
    'Image URLs': '',
    Status: 'ACTIVE',
  };
  columns.forEach(({ key }) => {
    if (key.startsWith('Size Chart -')) examples[key] = 0;
  });
  if (categoryKey === 'electronics') {
    delete examples.Sizes;
    delete examples.Colors;
  }
  return examples;
}

class ProductTemplateService {
  static async create(wholesalerId, requestedCategory) {
    const categoryKey = String(requestedCategory || '');
    if (!TEMPLATE_LABELS[categoryKey]) {
      throw new BadRequestError('Choose a supported product category for the template');
    }

    const categories = await Category.find({
      isDeleted: false,
      isDemo: { $ne: true },
      $or: [{ wholesalerId: null }, { wholesalerId }],
    }).sort({ sortOrder: 1, name: 1 }).lean();
    const roots = categories.filter((category) => (
      !parentIdOf(category)
      && (normalizeCategoryKey(category.slug) === categoryKey || normalizeCategoryKey(category.name) === categoryKey)
    ));
    const paths = categoryPaths(categories, roots);
    const columns = makeColumns(categoryKey);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Wholesale Marketplace';
    workbook.created = new Date();

    const products = workbook.addWorksheet('Products');
    products.views = [{ state: 'frozen', ySplit: 1 }];
    products.columns = columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: Math.max(16, Math.min(32, column.header.length + 4)),
      ...(column.key === 'Expiry Date' ? { numFmt: 'yyyy-mm-dd' } : {}),
    }));
    products.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    products.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7F1D1D' } };
    products.autoFilter = { from: 'A1', to: `${products.lastColumn.letter}1` };
    const example = exampleData(categoryKey, columns, paths[0]);
    products.addRow(columns.map((column) => example[column.key] ?? ''));
    products.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
    products.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

    const dropdowns = workbook.addWorksheet('Dropdowns');
    dropdowns.state = 'veryHidden';
    const rootNames = [...new Set(roots.map((root) => root.name))];
    if (addNamedList(workbook, dropdowns, 'CategoryOptions', rootNames)) {
      const parentColumn = columns.findIndex((column) => column.key === 'Category') + 1;
      setDropdown(products, parentColumn, () => 'CategoryOptions');
    }
    rootNames.forEach((rootName, index) => {
      const matchingRootIds = new Set(roots
        .filter((root) => root.name === rootName)
        .map((root) => String(root._id)));
      const children = categories.filter((category) => matchingRootIds.has(parentIdOf(category)));
      const listName = `Subcategory${index + 1}`;
      addNamedList(workbook, dropdowns, listName, children.map((category) => category.name));
    });
    if (rootNames.length > 0) {
      const subcategoryColumn = columns.findIndex((column) => column.key === 'Subcategory') + 1;
      const parentLetter = columnLetter(products.getColumn(columns.findIndex((column) => column.key === 'Category') + 1));
      const formula = (row) => `INDIRECT("Subcategory"&MATCH($${parentLetter}${row},CategoryOptions,0))`;
      setDropdown(products, subcategoryColumn, formula);
    }
    addNamedList(workbook, dropdowns, 'StatusOptions', ['ACTIVE', 'DRAFT']);
    addNamedList(workbook, dropdowns, 'GSTOptions', ['0', '5', '12', '18', '28']);
    const statusColumn = columns.findIndex((column) => column.key === 'Status') + 1;
    const igstColumn = columns.findIndex((column) => column.key === 'IGST %') + 1;
    setDropdown(products, statusColumn, () => 'StatusOptions');
    setDropdown(products, igstColumn, () => 'GSTOptions');
    const sizeChartUnitColumn = columns.findIndex((column) => column.key === 'Size Chart Unit') + 1;
    if (sizeChartUnitColumn > 0) {
      addNamedList(workbook, dropdowns, 'SizeChartUnitOptions', ['inch', 'cm']);
      setDropdown(products, sizeChartUnitColumn, () => 'SizeChartUnitOptions');
    }
    columns.forEach((column, index) => {
      if (!column.options?.length) return;
      const listName = `${column.key.replace(/[^A-Za-z0-9]/g, '')}Options`;
      if (addNamedList(workbook, dropdowns, listName, column.options)) {
        setDropdown(products, index + 1, () => listName);
      }
    });

    const instructions = workbook.addWorksheet('Instructions');
    instructions.columns = [
      { header: 'Column', key: 'column', width: 32 },
      { header: 'What to enter', key: 'description', width: 92 },
    ];
    instructions.addRow({ column: 'Getting started', description: 'Row 2 is a grey example and is ignored during upload. Enter products starting in row 3; do not delete or rename the header row.' });
    instructions.addRow({ column: 'Dropdowns', description: 'Select Parent Category first. The Sub Category dropdown then shows only subcategories of that parent. Choose Status and IGST % from their dropdowns when needed.' });
    instructions.addRow({ column: 'Bulk tiers', description: 'For each tier, enter a minimum quantity and its unit price. Leave both cells blank for unused tiers.' });
    instructions.addRow({ column: 'Dimensions', description: 'Enter package Length, Width, and Height in the same unit. Add the unit in Weight Unit when entering Weight.' });
    instructions.addRow({ column: 'Sizes and size chart', description: 'Enter comma-separated sizes and colors. Size chart measurements are optional; enter values for the matching size and specify inch or cm.' });
    instructions.addRow({ column: 'Images', description: 'Image URLs are optional. Enter up to five comma-separated HTTP or HTTPS URLs.' });
    instructions.addRow({ column: 'Category choices', description: 'The dropdowns use category paths available to your account. Choose a parent category before choosing its subcategory.' });
    instructions.addRow([]);
    columns.forEach((column) => instructions.addRow({
      column: column.header,
      description: column.description,
    }));
    instructions.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    instructions.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7F1D1D' } };
    instructions.views = [{ state: 'frozen', ySplit: 1 }];
    instructions.autoFilter = { from: 'A1', to: 'B1' };

    return {
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      filename: `products-${categoryKey}-template.xlsx`,
    };
  }
}

module.exports = ProductTemplateService;
