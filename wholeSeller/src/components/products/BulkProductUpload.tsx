'use client';

import { useState } from 'react';
import type ExcelJS from 'exceljs';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import type { Category } from '@/lib/types';
import type { BulkProductPreviewRow, BulkProductUploadRow } from '@/lib/api';
import api from '@/lib/api';
import { getCategoryAttributeSchema, normalizeCategoryKey } from '@/lib/categoryAttributes';

type TemplateKey =
  | 'clothing'
  | 'footwear'
  | 'electronics'
  | 'grocery'
  | 'beauty_personal_care'
  | 'jewelry'
  | 'home_kitchen'
  | 'all';

type ProductColumn = { key: string; header: string; options?: string[] };
type CategoryPath = { category: string; subcategory: string; subSubcategory: string };
type PreviewEntry = BulkProductPreviewRow & { original: BulkProductUploadRow };

const TEMPLATE_OPTIONS: Array<{ value: TemplateKey; label: string }> = [
  { value: 'clothing', label: 'Clothing' },
  { value: 'footwear', label: 'Footwear' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'beauty_personal_care', label: 'Beauty' },
  { value: 'jewelry', label: 'Jewelry' },
  { value: 'home_kitchen', label: 'Home' },
];

const COMMON_COLUMNS: ProductColumn[] = [
  { key: 'Product Name', header: 'Product Name*' },
  { key: 'SKU', header: 'SKU*' },
  { key: 'Brand', header: 'Brand' },
  { key: 'Description', header: 'Description*' },
  { key: 'Status', header: 'Status' },
  { key: 'Country of Origin', header: 'Country of Origin' },
  { key: 'Category', header: 'Category*' },
  { key: 'Subcategory', header: 'Subcategory*' },
  { key: 'Sub-subcategory', header: 'Sub-subcategory' },
  { key: 'Cost Price', header: 'Cost Price*' },
  { key: 'MRP', header: 'MRP*' },
  { key: 'Selling Price', header: 'Selling Price*' },
  { key: 'MOQ', header: 'MOQ*' },
  { key: 'Stock Quantity', header: 'Stock Quantity*' },
  { key: 'Low Stock Threshold', header: 'Low Stock Threshold' },
  { key: 'HSN Code', header: 'HSN Code' },
  { key: 'CGST %', header: 'CGST %' },
  { key: 'SGST %', header: 'SGST %' },
  { key: 'IGST %', header: 'IGST %', options: ['0', '5', '12', '18', '28'] },
  { key: 'Price Includes Tax', header: 'Price Includes Tax', options: ['Yes', 'No'] },
  { key: 'Tier 1 Min Qty', header: 'Tier 1 Min Qty' },
  { key: 'Tier 1 Price', header: 'Tier 1 Price' },
  { key: 'Tier 2 Min Qty', header: 'Tier 2 Min Qty' },
  { key: 'Tier 2 Price', header: 'Tier 2 Price' },
  { key: 'Tier 3 Min Qty', header: 'Tier 3 Min Qty' },
  { key: 'Tier 3 Price', header: 'Tier 3 Price' },
  { key: 'Weight', header: 'Weight' },
  { key: 'Weight Unit', header: 'Weight Unit' },
  { key: 'Length', header: 'Length' },
  { key: 'Width', header: 'Width' },
  { key: 'Height', header: 'Height' },
  { key: 'Image URLs', header: 'Image URLs' },
];

const CATEGORY_HEADERS: Record<string, Record<string, string>> = {
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

const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Free Size'];
const FOOTWEAR_SIZES = ['UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'];

function uniqueColumns(columns: ProductColumn[]) {
  const unique = new Map<string, ProductColumn>();
  columns.forEach((column) => {
    const existing = unique.get(column.key);
    if (!existing) {
      unique.set(column.key, { ...column });
      return;
    }
    if (column.options?.length) {
      existing.options = [...new Set([...(existing.options || []), ...column.options])];
    }
  });
  return [...unique.values()];
}

function getCategoryPaths(categories: Category[]): CategoryPath[] {
  const paths: CategoryPath[] = [];
  const byId = new Map(categories.map((category) => [String(category.id), category]));
  categories.forEach((category) => {
    if (category.parentId) return;
    const subcategories = categories.filter((candidate) => String(candidate.parentId || '') === String(category.id));
    subcategories.forEach((subcategory) => {
      const subSubcategories = categories.filter((candidate) => String(candidate.parentId || '') === String(subcategory.id));
      if (subSubcategories.length === 0) {
        paths.push({ category: category.name, subcategory: subcategory.name, subSubcategory: '' });
      } else {
        subSubcategories.forEach((subSubcategory) => paths.push({
          category: category.name,
          subcategory: subcategory.name,
          subSubcategory: subSubcategory.name,
        }));
      }
    });
  });

  if (paths.length > 0) return paths;
  return categories.flatMap((category) => {
    const path = category.path || [];
    if (path.length < 2) return [];
    return [{
      category: byId.get(String(path[0].id))?.name || path[0].name,
      subcategory: byId.get(String(path[1].id))?.name || path[1].name,
      subSubcategory: path[2] ? byId.get(String(path[2].id))?.name || path[2].name : '',
    }];
  });
}

function getColumns(template: TemplateKey): ProductColumn[] {
  const categoryKeys = template === 'all'
    ? TEMPLATE_OPTIONS.filter((option) => option.value !== 'all').map((option) => option.value)
    : [template];
  const columns = [...COMMON_COLUMNS];

  if (categoryKeys.includes('clothing') || categoryKeys.includes('footwear')) {
    const sizes = [
      ...(categoryKeys.includes('clothing') ? CLOTHING_SIZES : []),
      ...(categoryKeys.includes('footwear') ? FOOTWEAR_SIZES : []),
    ];
    const sizeRequired = categoryKeys.length === 1;
    columns.push(
      { key: 'Sizes', header: sizeRequired ? 'Sizes*' : 'Sizes' },
      { key: 'Colors', header: sizeRequired ? 'Colors*' : 'Colors' },
      { key: 'Size Chart Unit', header: 'Size Chart Unit' },
    );
    sizes.forEach((size) => {
      const measures = CLOTHING_SIZES.includes(size)
        ? ['Chest', 'Waist', 'Length', 'Shoulder']
        : ['Foot Length', 'Foot Width'];
      measures.forEach((measure) => {
        const key = `Size Chart - ${size} - ${measure}`;
        columns.push({ key, header: key });
      });
    });
  }

  categoryKeys.forEach((categoryKey) => {
    const schema = getCategoryAttributeSchema(categoryKey);
    const headers = CATEGORY_HEADERS[categoryKey] || {};
    Object.entries(headers).forEach(([header, key]) => {
      const definition = schema.find((item) => item.key === key);
      columns.push({
        key: header,
        header: definition?.required ? `${header}*` : header,
        options: definition?.options,
      });
    });
  });
  return uniqueColumns(columns);
}

function exampleRow(template: TemplateKey, path?: CategoryPath): Record<string, string | number> {
  const categoryKey = template === 'all'
    ? (path ? normalizeCategoryKey(path.category) || 'clothing' : 'clothing')
    : template;
  const examples: Record<string, string | number> = {
    'Product Name': `Example ${TEMPLATE_OPTIONS.find((option) => option.value === categoryKey)?.label || 'Wholesale'} Product`,
    SKU: 'EXAMPLE-001',
    Brand: 'Example Brand',
    Description: 'Example product description for the selected category.',
    Status: 'ACTIVE',
    'Country of Origin': 'India',
    Category: path?.category || '',
    Subcategory: path?.subcategory || '',
    'Sub-subcategory': path?.subSubcategory || '',
    'Cost Price': 100,
    MRP: 250,
    'Selling Price': 150,
    MOQ: 10,
    'Stock Quantity': 100,
    'Low Stock Threshold': 10,
    'HSN Code': '610910',
    'CGST %': 9,
    'SGST %': 9,
    'IGST %': 18,
    'Price Includes Tax': 'No',
    'Tier 1 Min Qty': 50,
    'Tier 1 Price': 140,
    Weight: 0.5,
    'Weight Unit': 'kg',
    Length: 20,
    Width: 15,
    Height: 5,
    Sizes: 'S,M,L',
    Colors: 'Red,Navy Blue',
    'Size Chart Unit': 'cm',
    'Image URLs': '',
    Fabric: '100% Cotton',
    Fit: 'Regular Fit',
    'Sleeve Type': 'Full Sleeve',
    Pattern: 'Solid',
    Occasion: 'Casual',
    Gender: 'Unisex',
    'Care Instructions': 'Machine wash cold',
    Material: 'Stainless Steel',
    'Sole Type': 'Rubber',
    Closure: 'Lace-Up',
    'Model Number': 'EX-100',
    Warranty: '1 Year Manufacturer Warranty',
    Battery: '5000 mAh',
    Connectivity: 'Bluetooth 5.3',
    'Included Accessories': 'Charging cable',
    'Net Quantity': '1 kg',
    'Expiry Date': '2027-12-31',
    'Veg/Non-Veg': 'Veg',
    'FSSAI License': '12345678901234',
    'Storage Instructions': 'Store in a cool, dry place',
    Volume: '100 ml',
    'Suitable For': 'All Skin Types',
    'Key Ingredients': 'Aloe Vera',
    Purity: '22K (91.6%)',
    'Gemstone Details': 'Cubic Zirconia',
    Capacity: '1.5 Liters',
  };

  if (categoryKey === 'electronics') {
    delete examples.Sizes;
    delete examples.Colors;
  }
  if (categoryKey === 'jewelry') examples.Weight = 12.5;
  return examples;
}

function excelCellValue(value: ExcelJS.CellValue, header = ''): string | number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && header === 'Expiry Date' && value > 0) {
    return new Date((value - 25569) * 86400000).toISOString().slice(0, 10);
  }
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'object') {
    if ('formula' in value && value.formula) return `=${value.formula}`;
    if ('sharedFormula' in value && value.sharedFormula) return `=${value.sharedFormula}`;
    if ('text' in value && value.text) return value.text;
    if ('richText' in value && value.richText) return value.richText.map((part) => part.text).join('');
    if ('hyperlink' in value && value.hyperlink) return value.text || value.hyperlink;
  }
  return String(value);
}

function addValidationLists(
  workbook: ExcelJS.Workbook,
  roots: string[],
  paths: CategoryPath[],
) {
  const sheet = workbook.addWorksheet('Dropdowns');
  sheet.state = 'veryHidden';
  const addList = (name: string, values: string[]) => {
    const unique = [...new Set(values.filter(Boolean))];
    if (unique.length === 0) return;
    sheet.getColumn(sheet.columnCount + 1).values = [name, ...unique];
    const column = sheet.columnCount;
    workbook.definedNames.add(`Dropdowns!$${sheet.getColumn(column).letter}$2:$${sheet.getColumn(column).letter}$${unique.length + 1}`, name);
  };
  addList('CategoryOptions', roots);
  addList('SubcategoryOptions', paths.map((path) => path.subcategory));
  addList('SubSubcategoryOptions', paths.map((path) => path.subSubcategory));
  return addList;
}

function setListValidation(sheet: ExcelJS.Worksheet, column: number, listName: string, maxRows = 500) {
  for (let row = 2; row <= maxRows; row += 1) {
    sheet.getCell(row, column).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [listName],
      showErrorMessage: true,
      errorTitle: 'Choose a listed value',
      error: 'Select a value from the dropdown list.',
    };
  }
}

async function saveWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export default function BulkProductUpload({
  canImport,
  onImported,
  isProfileLoaded = true,
}: {
  canImport: boolean;
  onImported: () => Promise<void>;
  isProfileLoaded?: boolean;
}) {
  const [template, setTemplate] = useState<TemplateKey | ''>('');
  const [previewRows, setPreviewRows] = useState<PreviewEntry[]>([]);
  const [errorRows, setErrorRows] = useState<PreviewEntry[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const downloadTemplate = async () => {
    setError('');
    if (!template) {
      setError('Choose the product category before downloading its template.');
      return;
    }
    try {
      const workbook = await api.downloadBulkProductTemplate(template);
      const url = URL.createObjectURL(workbook);
      const link = document.createElement('a');
      link.href = url;
      link.download = `products-${template}-template.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not create the Excel template.');
    }
  };

  const parseWorkbook = async (file: File): Promise<BulkProductUploadRow[]> => {
    const ExcelJSModule = await import('exceljs');
    const workbook = new ExcelJSModule.default.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.getWorksheet('Products');
    if (!sheet) throw new Error("The workbook must contain a 'Products' sheet.");

    const headerRow = sheet.getRow(1);
    const headers: Array<{ index: number; key: string }> = [];
    headerRow.eachCell((cell, columnNumber) => {
      const header = String(cell.value || '').trim().replace(/\s*\*$/, '');
      const key = header === 'Parent Category'
        ? 'Category'
        : header === 'Sub Category' ? 'Subcategory' : header;
      if (key) headers.push({ index: columnNumber, key });
    });
    if (headers.length === 0) throw new Error("The 'Products' sheet is missing its header row.");

    const rows: BulkProductUploadRow[] = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const data: Record<string, string | number | null> = {};
      headers.forEach(({ index, key }) => {
        data[key] = excelCellValue(row.getCell(index).value, key);
      });
      const isTemplateExample = rowNumber === 2
        && data.SKU === 'EXAMPLE-001'
        && /^Example .+\(do not import\)$/i.test(String(data['Product Name'] || '').trim());
      if (isTemplateExample) continue;
      if (Object.values(data).every((value) => value === null || value === '')) continue;
      rows.push({ rowNumber, data });
    }
    if (rows.length === 0) {
      throw new Error("No product data found. Add at least one product to the 'Products' sheet starting in row 3, then upload again.");
    }
    return rows;
  };

  const handleFileChange = async (file?: File) => {
    if (!file) return;
    setError('');
    setMessage('');
    setPreviewRows([]);
    setErrorRows([]);
    setIsPreviewing(true);
    try {
      const uploadRows = await parseWorkbook(file);
      const response = await api.previewBulkProducts(uploadRows);
      const result = response.data.rows.map((row) => ({
        ...row,
        original: uploadRows.find((item) => item.rowNumber === row.rowNumber) || {
          rowNumber: row.rowNumber,
          data: row.data,
        },
      }));
      setPreviewRows(result);
      setErrorRows(result.filter((row) => !row.valid));
      setMessage(`Preview ready: ${result.filter((row) => row.valid).length} valid, ${result.filter((row) => !row.valid).length} with errors.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not read this workbook.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleImport = async () => {
    const validRows = previewRows.filter((row) => row.valid).map((row) => row.original);
    if (validRows.length === 0) return;
    setError('');
    setMessage('');
    setIsImporting(true);
    try {
      const response = await api.importBulkProducts(validRows);
      const { imported, rejected } = response.data;
      const rejectedByRow = new Map(rejected.map((row) => [row.rowNumber, row.errors]));
      setErrorRows((current) => {
        const retained = current.filter((row) => !rejectedByRow.has(row.rowNumber));
        const newlyRejected = previewRows
          .filter((row) => rejectedByRow.has(row.rowNumber))
          .map((row) => ({ ...row, errors: rejectedByRow.get(row.rowNumber) || [] }));
        return [...retained, ...newlyRejected];
      });
      setPreviewRows((current) => current.filter((row) => !row.valid || rejectedByRow.has(row.rowNumber)));
      setMessage(`Imported ${imported.length} product${imported.length === 1 ? '' : 's'}. ${rejected.length} valid row${rejected.length === 1 ? '' : 's'} could not be imported.`);
      await onImported();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Product import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadErrorReport = async () => {
    if (errorRows.length === 0) return;
    try {
    const ExcelJSModule = await import('exceljs');
    const workbook = new ExcelJSModule.default.Workbook();
    const sheet = workbook.addWorksheet('Errors');
    const dataHeaders = [...new Set(errorRows.flatMap((row) => Object.keys(row.original.data)))];
    sheet.columns = [
      { header: 'Row Number', key: 'rowNumber', width: 12 },
      ...dataHeaders.map((header) => ({ header, key: header, width: 24 })),
      { header: 'Errors', key: 'errors', width: 72 },
    ];
    errorRows.forEach((row) => sheet.addRow({
      rowNumber: row.rowNumber,
      ...row.original.data,
      errors: row.errors.join('; '),
    }));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } };
      await saveWorkbook(workbook, 'product-upload-errors.xlsx');
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'Could not create the error report.');
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-xs">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-extrabold text-tradeflow-navy">
            <FileSpreadsheet className="h-4 w-4 text-status-success" />
            Bulk Upload Products
          </div>
          <p className="mt-1 max-w-2xl text-xs text-gray-500">
            Choose a product category, download its Excel template, enter products starting in row 3, then preview before importing.
            Images are optional.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
            <span className="whitespace-nowrap">Download template for:</span>
            <select
              value={template}
              onChange={(event) => setTemplate(event.target.value as TemplateKey)}
              className="rounded-lg border border-tradeflow-gray-200 bg-tradeflow-gray-50 px-3 py-2"
            >
              <option value="" disabled>Select category</option>
              {TEMPLATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void downloadTemplate()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-tradeflow-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-tradeflow-gray-50"
          >
            <Download className="h-4 w-4" />
            Download template
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-tradeflow-gray-200 pt-4 sm:flex-row sm:items-center">
        <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-tradeflow-green-hover px-4 py-2.5 text-xs font-bold text-tradeflow-navy hover:bg-tradeflow-green-pressed">
          <Upload className="h-4 w-4" />
          {isPreviewing ? 'Checking workbook...' : 'Upload workbook and preview'}
          <input
            type="file"
            accept=".xlsx"
            className="sr-only"
            disabled={isPreviewing || isImporting}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              void handleFileChange(file);
            }}
          />
        </label>
        <p className="text-[11px] text-gray-500">Excel .xlsx files only. Uploads are limited to 500 product rows.</p>
      </div>

      {isProfileLoaded && !canImport && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          KYC approval is required to import products. You can still download a template and preview rows.
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {message && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs font-semibold text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {message}
        </p>
      )}

      {previewRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-gray-600">
              Import preview ({previewRows.filter((row) => row.valid).length} valid / {previewRows.length} rows)
            </h3>
            <div className="flex gap-2">
              {errorRows.length > 0 && (
                <button type="button" onClick={() => void downloadErrorReport()} className="rounded-lg border border-tradeflow-gray-200 px-3 py-2 text-xs font-bold hover:bg-tradeflow-gray-50">
                  Download error report
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={!canImport || isImporting || !previewRows.some((row) => row.valid)}
                className="rounded-lg bg-tradeflow-green px-4 py-2 text-xs font-bold text-tradeflow-navy disabled:cursor-not-allowed disabled:opacity-50"
                title={!canImport ? 'KYC approval is required to import products' : undefined}
              >
                {isImporting ? 'Importing...' : `Import ${previewRows.filter((row) => row.valid).length} valid rows`}
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-auto rounded-lg border border-tradeflow-gray-200">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="sticky top-0 bg-tradeflow-gray-50 text-[10px] uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Validation details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tradeflow-gray-200">
                {previewRows.map((row) => (
                  <tr key={row.rowNumber} className={row.valid ? 'bg-green-50/60' : 'bg-red-50/70'}>
                    <td className="px-3 py-2 font-mono">{row.rowNumber}</td>
                    <td className="px-3 py-2">{String(row.data['Product Name'] || '')}</td>
                    <td className="px-3 py-2 font-mono">{String(row.data.SKU || '')}</td>
                    <td className={`px-3 py-2 font-bold ${row.valid ? 'text-green-700' : 'text-red-700'}`}>{row.valid ? 'Valid' : 'Error'}</td>
                    <td className="px-3 py-2 text-red-700">{row.errors.length > 0 ? row.errors.join('; ') : 'Ready to import'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
