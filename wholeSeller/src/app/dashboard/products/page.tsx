'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Package,
  Edit,
  Trash2,
  Tag,
  X,
  LayoutGrid,
  List,
  ShieldCheck,
  Image as ImageIcon,
  DollarSign,
  Layers,
  Palette,
  Sliders,
  AlertCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import { Product, Category, WholesaleTier, CustomAttribute } from '@/lib/mock-data';
import { getCategoryAttributeSchema, CategoryAttributeDef } from '@/lib/categoryAttributes';
import api from '@/lib/api';

export default function ProductsPage() {
  const { profile, products, categories, addProduct, updateProduct, deleteProduct } = useWholesaler();
  const canCreateProducts = profile.kycStatus === 'APPROVED';
  const location = useLocation();
  const navigate = useNavigate();
  
  // UI View States
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields State (Used for both Add & Edit)
  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [level2CategoryId, setLevel2CategoryId] = useState('');
  const [level3CategoryId, setLevel3CategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [categoryAttributes, setCategoryAttributes] = useState<Record<string, any>>({});
  const [costPrice, setCostPrice] = useState<number | ''>(380);
  const [sellingPrice, setSellingPrice] = useState<number | ''>(550);
  const [stock, setStock] = useState<number | ''>(100);
  const [minOrderQty, setMinOrderQty] = useState<number | ''>(10);
  const [unit, setUnit] = useState('piece');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [description, setDescription] = useState('');

  // Size Tags & Color Tags State
  const [sizes, setSizes] = useState<string[]>([]);
  const [sizeInput, setSizeInput] = useState('');

  const [colors, setColors] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState('');

  // Dynamic Tag Input Helper State
  const [dynamicTagInputs, setDynamicTagInputs] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Generic Additional Options State
  const [additionalOptions, setAdditionalOptions] = useState<CustomAttribute[]>([]);

  // Bulk Pricing Tiers State
  const [pricingTiers, setPricingTiers] = useState<WholesaleTier[]>([
    { id: 't1', minQty: 200, pricePerUnit: 500 },
    { id: 't2', minQty: 500, pricePerUnit: 440 }
  ]);

  // Filter products by search and selected category filter
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const selectedParentCategory = categories.find(
    (c) =>
      (!c.parentId || c.parentId === null || c.parentId === '') &&
      (c.name.toLowerCase() === (categoryName || '').toLowerCase() || String(c.id) === String(categoryName))
  );

  // Level 2 Subcategories (Direct children of Main Category)
  const availableLevel2Categories = selectedParentCategory
    ? categories.filter((c) => String(c.parentId) === String(selectedParentCategory.id))
    : [];

  // Level 3 Sub-subcategories (Direct children of Level 2 Subcategory)
  const availableLevel3Categories = level2CategoryId
    ? categories.filter((c) => String(c.parentId) === String(level2CategoryId))
    : [];

  const handleCategoryChange = (newCategory: string) => {
    setCategoryName(newCategory);
    setLevel2CategoryId('');
    setLevel3CategoryId('');
    setSubcategoryId('');
    setFormError(null);
    if (!newCategory) {
      setCategoryAttributes({});
      return;
    }

    const newSchema = getCategoryAttributeSchema(newCategory);
    const validKeys = new Set(newSchema.map(s => s.key));

    const cleanedAttrs: Record<string, any> = {};
    Object.entries(categoryAttributes).forEach(([key, val]) => {
      if (validKeys.has(key)) {
        cleanedAttrs[key] = val;
      }
    });
    setCategoryAttributes(cleanedAttrs);
  };

  const handleLevel2Change = (newLevel2Id: string) => {
    setLevel2CategoryId(newLevel2Id);
    setLevel3CategoryId('');
    setSubcategoryId(newLevel2Id);
    setFormError(null);
  };

  const handleLevel3Change = (newLevel3Id: string) => {
    setLevel3CategoryId(newLevel3Id);
    setSubcategoryId(newLevel3Id || level2CategoryId);
    setFormError(null);
  };

  const handleOpenAddModal = useCallback(() => {
    if (!canCreateProducts) return;
    setEditingProduct(null);
    setFormError(null);
    setTitle('');
    setSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setCategoryName(''); // Unselected by default
    setLevel2CategoryId('');
    setLevel3CategoryId('');
    setSubcategoryId('');
    setCategoryAttributes({});
    setCostPrice(380);
    setSellingPrice(550);
    setStock(100);
    setMinOrderQty(10);
    setUnit('piece');
    setImageUrl('');
    setImageFiles([]);
    setDescription('High quality wholesale product for retail buyers.');
    setSizes([]);
    setColors([]);
    setAdditionalOptions([]);
    setPricingTiers([
      { id: 't1', minQty: 200, pricePerUnit: 500 },
      { id: 't2', minQty: 500, pricePerUnit: 440 }
    ]);
    setShowAddModal(true);
  }, [canCreateProducts]);

  useEffect(() => {
    if (location.state?.openAddProduct && canCreateProducts) {
      handleOpenAddModal();
      navigate(location.pathname, { replace: true, state: null });
    } else if (location.state?.openAddProduct) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [canCreateProducts, handleOpenAddModal, location.pathname, location.state, navigate]);

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormError(null);
    setTitle(product.title);
    setSku(product.sku);
    setCategoryName(product.category || '');

    const subId = product.subcategoryId || '';
    setSubcategoryId(subId);

    if (subId) {
      const targetSub = categories.find((c) => String(c.id) === String(subId));
      if (targetSub) {
        const parentSub = categories.find((c) => String(c.id) === String(targetSub.parentId));
        if (parentSub && parentSub.parentId) {
          // targetSub is Level 3
          setLevel2CategoryId(String(parentSub.id));
          setLevel3CategoryId(String(targetSub.id));
        } else {
          // targetSub is Level 2
          setLevel2CategoryId(String(targetSub.id));
          setLevel3CategoryId('');
        }
      } else {
        setLevel2CategoryId('');
        setLevel3CategoryId('');
      }
    } else {
      setLevel2CategoryId('');
      setLevel3CategoryId('');
    }

    setCategoryAttributes(product.categoryAttributes || {});
    setCostPrice(product.costPrice || product.basePrice * 0.7);
    setSellingPrice(product.sellingPrice || product.basePrice);
    setStock(product.stock);
    setMinOrderQty(product.minOrderQty);
    setUnit(product.unit || 'piece');
    setImageUrl(product.imageUrl);
    setImageFiles([]);
    setDescription(product.description || '');
    setSizes(product.sizes || []);
    setColors(product.colors || []);
    setAdditionalOptions(product.additionalOptions || []);
    setPricingTiers(product.pricingTiers && product.pricingTiers.length > 0 ? product.pricingTiers : [
      { id: 't1', minQty: 200, pricePerUnit: Math.round((product.sellingPrice || product.basePrice) * 0.9) }
    ]);
  };

  // Size Tag Handlers
  const handleAddSizeTag = () => {
    if (sizeInput.trim() && !sizes.includes(sizeInput.trim())) {
      const nextSizes = [...sizes, sizeInput.trim()];
      setSizes(nextSizes);
      setCategoryAttributes({ ...categoryAttributes, size: nextSizes });
      setSizeInput('');
    }
  };

  const handleRemoveSizeTag = (sizeToRemove: string) => {
    const nextSizes = sizes.filter(s => s !== sizeToRemove);
    setSizes(nextSizes);
    setCategoryAttributes({ ...categoryAttributes, size: nextSizes });
  };

  // Color Tag Handlers
  const handleAddColorTag = () => {
    if (colorInput.trim() && !colors.includes(colorInput.trim())) {
      const nextColors = [...colors, colorInput.trim()];
      setColors(nextColors);
      setCategoryAttributes({ ...categoryAttributes, color: nextColors });
      setColorInput('');
    }
  };

  const handleRemoveColorTag = (colorToRemove: string) => {
    const nextColors = colors.filter(c => c !== colorToRemove);
    setColors(nextColors);
    setCategoryAttributes({ ...categoryAttributes, color: nextColors });
  };

  // Generic Additional Options Handlers
  const handleAddOption = () => {
    setAdditionalOptions([
      ...additionalOptions,
      { id: `opt-${Date.now()}`, name: '', value: '' }
    ]);
  };

  const handleUpdateOption = (id: string, field: 'name' | 'value', val: string) => {
    setAdditionalOptions(additionalOptions.map(opt => opt.id === id ? { ...opt, [field]: val } : opt));
  };

  const handleRemoveOption = (id: string) => {
    setAdditionalOptions(additionalOptions.filter(opt => opt.id !== id));
  };

  // Bulk Pricing Tier Handlers
  const handleAddPricingTier = () => {
    const defaultMinQty = pricingTiers.length > 0 ? (pricingTiers[pricingTiers.length - 1].minQty || 100) + 100 : 200;
    const defaultPrice = sellingPrice ? Math.round(Number(sellingPrice) * 0.85) : 180;
    setPricingTiers([
      ...pricingTiers,
      { id: `tier-${Date.now()}`, minQty: defaultMinQty, pricePerUnit: defaultPrice }
    ]);
  };

  const handleUpdatePricingTier = (id: string, field: 'minQty' | 'pricePerUnit', val: number) => {
    setPricingTiers(pricingTiers.map(tier => tier.id === id ? { ...tier, [field]: val } : tier));
  };

  const handleRemovePricingTier = (id: string) => {
    setPricingTiers(pricingTiers.filter(tier => tier.id !== id));
  };

  // Form Submit Handler
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!categoryName) {
      setFormError('Please select a Main Category from the dropdown.');
      return;
    }
    if (availableLevel2Categories.length > 0 && !level2CategoryId) {
      setFormError('Please select a Subcategory (Department).');
      return;
    }
    if (availableLevel3Categories.length > 0 && !level3CategoryId) {
      setFormError('Please select a Specific Item Type for this product.');
      return;
    }

    // Client-Side Dynamic Category Attributes Validation
    const currentSchema = getCategoryAttributeSchema(categoryName);
    for (const field of currentSchema) {
      if (field.required) {
        let val = categoryAttributes[field.key];
        if (field.key === 'size' && (!val || val.length === 0)) val = sizes;
        if (field.key === 'color' && (!val || val.length === 0)) val = colors;

        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          setFormError(`Please complete required category field: "${field.label}"`);
          return;
        }
      }
    }

    const catObj = categories.find(c => c.name === categoryName);
    const categoryId = catObj?.id || '';
    if (!categoryId) {
      setFormError('Please select a valid main category.');
      return;
    }

    const numSellingPrice = Number(sellingPrice) || 0;
    const numCostPrice = Number(costPrice) || 0;
    const numStock = Number(stock) || 0;
    const numMinOrder = Number(minOrderQty);
    if (!Number.isInteger(numMinOrder) || numMinOrder < 1) {
      setFormError('Minimum order quantity must be a whole number of at least 1.');
      return;
    }
    if (!unit.trim()) {
      setFormError('Enter the product order unit, such as piece or set (12 pieces).');
      return;
    }

    const validOptions = additionalOptions.filter(opt => opt.name.trim() !== '' && opt.value.trim() !== '');

    const finalCategoryAttrs: Record<string, any> = { ...categoryAttributes };
    if (sizes && sizes.length > 0) finalCategoryAttrs.size = sizes;
    if (colors && colors.length > 0) finalCategoryAttrs.color = colors;

    try {
      let finalImageUrl = imageUrl;
      if (imageFiles.length > 0) {
        setIsUploading(true);
        try {
          const res = await api.uploadProductImages(imageFiles);
          if (res.data && res.data.length > 0) {
            finalImageUrl = res.data[0];
          }
        } catch (err: any) {
          setIsUploading(false);
          setFormError('Failed to upload images: ' + err.message);
          return;
        }
        setIsUploading(false);
      }

      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          title,
          sku,
          category: categoryName,
          categoryId,
          subcategoryId: subcategoryId || null,
          costPrice: numCostPrice,
          sellingPrice: numSellingPrice,
          basePrice: numSellingPrice,
          stock: numStock,
          minOrderQty: numMinOrder,
          unit: unit.trim(),
          imageUrl: finalImageUrl,
          description,
          sizes,
          colors,
          additionalOptions: validOptions,
          pricingTiers,
          categoryAttributes: finalCategoryAttrs,
        });
        setEditingProduct(null);
      } else {
        await addProduct({
          title,
          sku: sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          category: categoryName,
          categoryId,
          subcategoryId: subcategoryId || null,
          costPrice: numCostPrice,
          sellingPrice: numSellingPrice,
          basePrice: numSellingPrice,
          stock: numStock,
          minOrderQty: numMinOrder,
          unit: unit.trim(),
          imageUrl: finalImageUrl,
          description,
          sizes,
          colors,
          additionalOptions: validOptions,
          pricingTiers,
          categoryAttributes: finalCategoryAttrs,
        });
        setShowAddModal(false);
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save product. Please check form fields.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Wholesaler Ownership Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Wholesaler Catalog: {profile.businessName}</span>
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1F1F1F]">Wholesale Products Catalog</h1>
          <p className="text-xs text-gray-500">Manage category-driven product attributes, wholesale prices, MOQ, and bulk pricing tiers</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-[#E5E5E5]">
            <button
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'GRID' ? 'bg-[#FFEBEE] text-[#C62828]' : 'text-gray-400 hover:text-gray-600'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'TABLE' ? 'bg-[#FFEBEE] text-[#C62828]' : 'text-gray-400 hover:text-gray-600'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleOpenAddModal}
            disabled={!canCreateProducts}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#C62828] text-white text-xs font-bold rounded-xl hover:bg-[#B71C1C] shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
            title={!canCreateProducts ? 'Complete KYC verification before adding products' : undefined}
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {!canCreateProducts && (
        <div className="flex flex-col gap-3 border border-[#F9A825]/30 bg-[#FFF8E1] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-[#6D4C00]">KYC approval is required to add products.</p>
            <p className="mt-1 text-xs text-[#795900]">Current status: {profile.kycStatus || 'DRAFT'}</p>
          </div>
          <Link to="/dashboard/kyc" className="inline-flex w-fit items-center rounded-md bg-[#C62828] px-3 py-2 text-xs font-bold text-white hover:bg-[#B71C1C]">
            Complete KYC
          </Link>
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 bg-white rounded-2xl border border-[#E5E5E5] flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search catalog by product title or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl focus:outline-none focus:border-[#C62828]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <span className="text-xs font-bold text-gray-500 shrink-0">Wholesaler Categories:</span>
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-[#C62828] text-white'
                : 'bg-[#FAF9F7] text-gray-600 hover:bg-[#E5E5E5]'
            }`}
          >
            All Products ({products.length})
          </button>
          {categories.map((c, idx) => (
            <button
              key={c.id || `cat-btn-${c.name || idx}`}
              onClick={() => setSelectedCategory(c.name)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === c.name
                  ? 'bg-[#C62828] text-white'
                  : 'bg-[#FAF9F7] text-gray-600 hover:bg-[#E5E5E5]'
              }`}
            >
              {c.name} ({products.filter(p => p.category === c.name).length})
            </button>
          ))}
        </div>
      </div>

      {/* VIEW MODE 1: GRID VIEW */}
      {viewMode === 'GRID' && (
        <div className="grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product, pIdx) => {
            const cost = product.costPrice || product.basePrice * 0.7;
            const selling = product.sellingPrice || product.basePrice;
            const profitMargin = selling - cost;

            return (
              <div
                key={product.id || (product as any)._id || `grid-p-${pIdx}`}
                className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-[#E5E5E5] bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C62828]/35 hover:shadow-lg"
              >
                <div className="flex flex-1 flex-col">
                  <div className="relative h-56 w-full overflow-hidden bg-[#f4f3f0]">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="h-full w-full object-contain p-3 transition-transform duration-300 hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-gray-300"><ImageIcon className="h-10 w-10" /></div>
                    )}
                    <div className="absolute right-3 top-3 flex items-center gap-1.5">
                      <span className={`rounded-sm px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                        product.isLowStock
                          ? 'border border-[#C62828]/20 bg-[#FFEBEE] text-[#C62828]'
                          : 'border border-[#2E7D32]/20 bg-[#E8F5E9] text-[#2E7D32]'
                      }`}>
                        {product.isLowStock ? 'Low stock' : 'In stock'} · {product.stock}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 rounded-sm bg-[#1F1F1F]/80 px-2.5 py-1 font-mono text-[10px] text-white backdrop-blur-sm">
                      SKU: {product.sku}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold">
                      <span className="rounded-sm bg-[#FAF9F7] px-2 py-1 text-gray-600">{product.category}{product.subcategoryName ? ` / ${product.subcategoryName}` : ''}</span>
                      <span className="text-[#C62828]">MOQ {product.minOrderQty}</span>
                    </div>

                    <h3 className="min-h-12 line-clamp-2 text-base font-extrabold leading-snug text-[#1F1F1F]">
                      {product.title}
                    </h3>

                    <div className="grid grid-cols-2 gap-3 border-t border-[#E5E5E5] pt-3">
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-gray-400">Cost price</span>
                        <span className="font-mono text-xs font-bold text-gray-600">₹{cost.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-[#C62828]">Wholesale price</span>
                        <span className="text-base font-extrabold text-[#C62828]">₹{selling.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Dynamic Category Attributes Summary Badges */}
                    {product.categoryAttributes && Object.keys(product.categoryAttributes).length > 0 && (
                      <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[11px] space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-[#C62828]" />
                          <span>Category Attributes:</span>
                        </span>
                        {Object.entries(product.categoryAttributes).map(([k, v], idx) => (
                          <div key={`attr-${k}-${idx}`} className="flex justify-between text-xs">
                            <span className="text-gray-500 capitalize">{k}:</span>
                            <span className="font-bold text-gray-800 truncate max-w-[150px]">
                              {Array.isArray(v) ? v.join(', ') : String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-[#E5E5E5] bg-[#FAF9F7] px-4 py-3">
                  <div className="text-xs">
                    <span className="text-gray-400 block text-[10px]">Estimated Margin</span>
                    <span className="font-extrabold text-[#2E7D32]">₹{profitMargin} / unit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditModal(product)}
                      className="p-2 text-gray-500 hover:text-[#C62828] hover:bg-[#FFEBEE] rounded-lg transition-colors"
                      title="Edit Product"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${product.title}"?`)) {
                          deleteProduct(product.id);
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: TABLE VIEW */}
      {viewMode === 'TABLE' && (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5E5E5] text-gray-400 font-bold uppercase tracking-wider">
                  <th className="pb-3">Product Item & SKU</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Cost Price</th>
                  <th className="pb-3">Wholesale Price</th>
                  <th className="pb-3">Stock Units</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredProducts.map((product, pIdx) => {
                  const cost = product.costPrice || product.basePrice * 0.7;
                  const selling = product.sellingPrice || product.basePrice;

                  return (
                    <tr key={product.id || (product as any)._id || `tbl-p-${pIdx}`} className="hover:bg-[#FAF9F7] transition-colors">
                      <td className="py-3.5 flex items-center gap-3">
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="w-10 h-10 rounded-lg object-cover border border-[#E5E5E5] shrink-0"
                        />
                        <div>
                          <div className="font-bold text-[#1F1F1F] max-w-xs truncate">{product.title}</div>
                          <div className="text-[10px] font-mono text-gray-400">SKU: {product.sku}</div>
                        </div>
                      </td>
                      <td className="py-3.5 text-gray-600 font-semibold">{product.category}</td>
                      <td className="py-3.5 font-mono text-gray-500 font-bold">₹{cost}</td>
                      <td className="py-3.5 font-bold text-[#C62828] text-sm">₹{selling}</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          product.isLowStock ? 'bg-[#FFEBEE] text-[#C62828]' : 'bg-[#E8F5E9] text-[#2E7D32]'
                        }`}>
                          {product.stock} units
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(product)}
                            className="px-2.5 py-1 bg-[#FAF9F7] border border-[#E5E5E5] hover:border-[#C62828] hover:text-[#C62828] text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${product.title}"?`)) {
                                deleteProduct(product.id);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DYNAMIC CATEGORY-DRIVEN ADD / EDIT PRODUCT MODAL FORM */}
      {(showAddModal || editingProduct) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto border border-[#E5E5E5] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
              <div>
                <h2 className="text-lg font-extrabold text-[#1F1F1F]">
                  {editingProduct ? `Edit Product: ${editingProduct.title}` : 'Add New Wholesale Product'}
                </h2>
                <p className="text-xs text-gray-500">Dynamic category-driven product listing form</p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingProduct(null);
                  setFormError(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              {/* Universal Section 1: Basic Universal Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider pb-1 border-b border-gray-200">
                  1. Universal Product Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Product Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Premium Cotton Formal Shirt"
                      className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] focus:border-[#C62828] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Main Category <span className="text-red-500">*</span></label>
                    <select
                      value={categoryName}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] focus:border-[#C62828] focus:outline-none font-bold text-gray-800"
                    >
                      <option value="">-- Select Main Category --</option>
                      {categories.filter((category) => !category.parentId).map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Level 2 Subcategory (Department) */}
                  <div>
                    <label className="mb-1 block font-bold text-gray-700">Subcategory (Department)</label>
                    <select
                      value={level2CategoryId}
                      onChange={(event) => handleLevel2Change(event.target.value)}
                      disabled={!categoryName || availableLevel2Categories.length === 0}
                      className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAF9F7] px-3.5 py-2.5 font-bold text-gray-800 focus:border-[#C62828] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        {!categoryName
                          ? 'Select main category first'
                          : availableLevel2Categories.length > 0
                            ? '-- Select Subcategory (e.g. Kids, Women, Men) --'
                            : 'No subcategories available'}
                      </option>
                      {availableLevel2Categories.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Level 3 Specific Item Type */}
                  <div>
                    <label className="mb-1 block font-bold text-gray-700">Specific Item Type (Sub-item)</label>
                    <select
                      value={level3CategoryId}
                      onChange={(event) => handleLevel3Change(event.target.value)}
                      disabled={!level2CategoryId || availableLevel3Categories.length === 0}
                      className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAF9F7] px-3.5 py-2.5 font-bold text-gray-800 focus:border-[#C62828] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        {!level2CategoryId
                          ? 'Select subcategory first'
                          : availableLevel3Categories.length > 0
                            ? '-- Select Specific Item Type --'
                            : 'No specific item types available'}
                      </option>
                      {availableLevel3Categories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">SKU Number <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={sku}
                      onChange={(e) => setSku(e.target.value.toUpperCase())}
                      placeholder="e.g. SKU-9901"
                      className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-mono focus:border-[#C62828] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Product Image (Drag & Drop) <span className="text-red-500">*</span></label>
                    <div 
                      className="border-2 border-dashed border-[#C62828] rounded-xl bg-[#FAF9F7] p-4 text-center cursor-pointer hover:bg-[#FCE4E4] transition"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          const files = Array.from(e.dataTransfer.files);
                          const validFiles = files.filter(f => {
                            console.log(`Checking file ${f.name}: size = ${f.size} bytes, limit = ${5 * 1024 * 1024} bytes`);
                            if (f.size > 5 * 1024 * 1024) {
                              setFormError(`File ${f.name} exceeds the 5MB limit.`);
                              return false;
                            }
                            return true;
                          });
                          if (validFiles.length > 0) {
                            setImageFiles(validFiles.slice(0, 5));
                            setImageUrl('');
                          }
                        }
                      }}
                      onClick={() => document.getElementById('product-image-upload')?.click()}
                    >
                      <input
                        id="product-image-upload"
                        type="file"
                        accept="image/jpeg, image/png, image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) {
                            const files = Array.from(e.target.files);
                            const validFiles = files.filter(f => {
                              console.log(`Checking file ${f.name}: size = ${f.size} bytes, limit = ${5 * 1024 * 1024} bytes`);
                              if (f.size > 5 * 1024 * 1024) {
                                setFormError(`File ${f.name} exceeds the 5MB limit.`);
                                return false;
                              }
                              return true;
                            });
                            if (validFiles.length > 0) {
                              setImageFiles(validFiles.slice(0, 5));
                              setImageUrl('');
                            }
                          }
                        }}
                      />
                      {imageFiles.length > 0 ? (
                        <div className="flex flex-wrap gap-2 justify-center mt-2">
                          {imageFiles.map((f, i) => (
                            <img key={i} src={URL.createObjectURL(f)} alt="preview" className="w-16 h-16 object-cover rounded-md border" />
                          ))}
                        </div>
                      ) : imageUrl ? (
                        <img src={imageUrl} alt="preview" className="w-16 h-16 object-cover rounded-md border mx-auto mt-2" />
                      ) : (
                        <span className="text-sm text-gray-500">Drag & drop images here or click to select (max 5)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Universal Section 2: Dynamic Category-Specific Attributes Section */}
              {(() => {
                if (!categoryName) return null; // DO NOT render any category-specific section before a category is selected
                if (availableLevel2Categories.length > 0 && !level2CategoryId) return null;

                const selectedSubcategory = categories.find((c) => String(c.id) === String(subcategoryId));
                const currentSchema = getCategoryAttributeSchema(categoryName);
                if (currentSchema.length === 0) return null;
                const attributeCategoryName = selectedSubcategory?.name || categoryName;

                return (
                  <div className="p-4 bg-[#F4F6F8] rounded-2xl border border-[#D0D7DE] space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#D0D7DE]">
                      <div>
                        <h4 className="font-extrabold text-[#1F1F1F] text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-[#C62828]" />
                          <span>Product Options ({attributeCategoryName})</span>
                        </h4>
                        <p className="text-[10px] text-gray-500">Complete the available options for {attributeCategoryName} products.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {currentSchema.map((field) => {
                        const val = categoryAttributes[field.key];

                        return (
                          <div key={field.key} className={field.type === 'multiselect' ? 'sm:col-span-2' : ''}>
                            <label className="block font-bold text-gray-700 mb-1 text-xs">
                              {field.label} {field.required && <span className="text-red-500 font-bold">*</span>}
                            </label>

                            {field.type === 'select' && (
                              <select
                                value={val || ''}
                                onChange={(e) => setCategoryAttributes({ ...categoryAttributes, [field.key]: e.target.value })}
                                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl bg-white text-xs focus:border-[#C62828] focus:outline-none font-medium text-gray-800"
                              >
                                <option value="">-- Select {field.label} --</option>
                                {field.options?.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            )}

                            {field.type === 'text' && (
                              <input
                                type="text"
                                value={val || ''}
                                onChange={(e) => setCategoryAttributes({ ...categoryAttributes, [field.key]: e.target.value })}
                                placeholder={field.placeholder || `Enter ${field.label}`}
                                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl bg-white text-xs focus:border-[#C62828] focus:outline-none"
                              />
                            )}

                            {field.type === 'number' && (
                              <input
                                type="number"
                                value={val !== undefined && val !== null ? val : ''}
                                onChange={(e) => setCategoryAttributes({ ...categoryAttributes, [field.key]: e.target.value === '' ? '' : Number(e.target.value) })}
                                placeholder={field.placeholder || `Enter ${field.label}`}
                                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl bg-white text-xs font-mono focus:border-[#C62828] focus:outline-none"
                              />
                            )}

                            {field.type === 'date' && (
                              <input
                                type="date"
                                value={val || ''}
                                onChange={(e) => setCategoryAttributes({ ...categoryAttributes, [field.key]: e.target.value })}
                                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl bg-white text-xs focus:border-[#C62828] focus:outline-none"
                              />
                            )}

                            {field.type === 'multiselect' && (
                              <div className="p-3 bg-white rounded-xl border border-[#E5E5E5] space-y-2">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={dynamicTagInputs[field.key] || ''}
                                    onChange={(e) => setDynamicTagInputs({ ...dynamicTagInputs, [field.key]: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const inputVal = (dynamicTagInputs[field.key] || '').trim();
                                        if (inputVal) {
                                          const existingArr = Array.isArray(val) ? val : [];
                                          if (!existingArr.includes(inputVal)) {
                                            const updatedArr = [...existingArr, inputVal];
                                            setCategoryAttributes({ ...categoryAttributes, [field.key]: updatedArr });
                                            if (field.key === 'size') setSizes(updatedArr);
                                            if (field.key === 'color') setColors(updatedArr);
                                          }
                                          setDynamicTagInputs({ ...dynamicTagInputs, [field.key]: '' });
                                        }
                                      }
                                    }}
                                    placeholder={field.placeholder || `Add ${field.label} tag and press Enter`}
                                    className="w-full px-3 py-1.5 bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl text-xs"
                                  />
                                  {field.options && field.options.length > 0 && (
                                    <select
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          const existingArr = Array.isArray(val) ? val : [];
                                          if (!existingArr.includes(e.target.value)) {
                                            const updatedArr = [...existingArr, e.target.value];
                                            setCategoryAttributes({ ...categoryAttributes, [field.key]: updatedArr });
                                            if (field.key === 'size') setSizes(updatedArr);
                                            if (field.key === 'color') setColors(updatedArr);
                                          }
                                          e.target.value = '';
                                        }
                                      }}
                                      className="px-2 py-1.5 bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl text-xs"
                                    >
                                      <option value="">Preset Tags...</option>
                                      {field.options.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {(Array.isArray(val) ? val : (field.key === 'size' ? sizes : field.key === 'color' ? colors : [])).map((tagItem: string, idx: number) => (
                                    <span key={`tag-${field.key}-${tagItem}-${idx}`} className="px-2.5 py-1 bg-[#FFEBEE] border border-[#C62828]/20 rounded-lg text-xs font-bold text-[#C62828] flex items-center gap-1">
                                      <span>{tagItem}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const existingArr = Array.isArray(val) ? val : (field.key === 'size' ? sizes : field.key === 'color' ? colors : []);
                                          const updatedArr = existingArr.filter((item: string) => item !== tagItem);
                                          setCategoryAttributes({
                                            ...categoryAttributes,
                                            [field.key]: updatedArr,
                                          });
                                          if (field.key === 'size') setSizes(updatedArr);
                                          if (field.key === 'color') setColors(updatedArr);
                                        }}
                                        className="text-[#C62828]/60 hover:text-red-700"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Universal Section 3: Pricing & Stock Inventory */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider pb-1 border-b border-gray-200">
                  3. Universal Pricing & Stock Inventory
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1 flex items-center justify-between">
                      <span>Cost Price (₹) <span className="text-red-500">*</span></span>
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Acquisition price"
                      className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-mono focus:border-[#C62828] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#C62828] mb-1">Wholesale Price (₹) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Retailer price"
                      className="w-full px-3 py-2 border border-[#C62828]/40 rounded-xl bg-white font-mono font-bold text-[#C62828] focus:border-[#C62828] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Stock Quantity <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={stock}
                      onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Total available stock"
                      className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] focus:border-[#C62828] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Minimum Order Quantity <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min={1}
                      step={1}
                      value={minOrderQty}
                      onChange={(e) => setMinOrderQty(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Minimum units per order"
                      className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-mono focus:border-[#C62828] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Order Unit <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      maxLength={40}
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="piece or set (12 pieces)"
                      className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] focus:border-[#C62828] focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-gray-500">Example: MOQ 1, unit "set (12 pieces)"</p>
                  </div>
                </div>
              </div>

              {/* Universal Section 4: Product Description */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Product Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide product specifications or packaging details..."
                  className="w-full px-3.5 py-2 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] focus:border-[#C62828] focus:outline-none"
                />
              </div>

              {/* Universal Section 5: Repeatable Bulk Pricing Tiers */}
              <div className="p-4 bg-[#FFF8E1] rounded-2xl border border-[#FFE082] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-[#F9A825] text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-[#F9A825]" />
                      <span>Bulk Wholesale Pricing Tiers</span>
                    </h4>
                    <p className="text-[10px] text-gray-600">
                      Quantity discount tiers (e.g. 200+ units = ₹180/unit).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddPricingTier}
                    className="px-3 py-1.5 bg-[#F9A825] text-white text-[11px] font-bold rounded-xl hover:bg-[#F57F17] transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Tier</span>
                  </button>
                </div>

                {pricingTiers.length === 0 ? (
                  <div className="text-[11px] text-gray-500 italic">No bulk tiers added. Standard wholesale price applies.</div>
                ) : (
                  <div className="space-y-2">
                    {pricingTiers.map((tier, tIdx) => (
                      <div key={tier.id || (tier as any)._id || `tier-${tIdx}-${tier.minQty}`} className="flex items-center gap-2">
                        <span className="text-gray-500 font-bold shrink-0">Min Qty:</span>
                        <input
                          type="number"
                          min={1}
                          value={tier.minQty}
                          onChange={(e) => handleUpdatePricingTier(tier.id, 'minQty', Number(e.target.value))}
                          className="w-24 px-3 py-1.5 bg-white border border-[#FFE082] rounded-xl text-xs font-mono font-bold"
                        />
                        <span className="text-gray-500 font-bold shrink-0">Price/Unit (₹):</span>
                        <input
                          type="number"
                          min={0}
                          value={tier.pricePerUnit}
                          onChange={(e) => handleUpdatePricingTier(tier.id, 'pricePerUnit', Number(e.target.value))}
                          className="w-32 px-3 py-1.5 bg-white border border-[#FFE082] rounded-xl text-xs font-mono font-bold text-[#C62828]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePricingTier(tier.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg shrink-0"
                          title="Remove Tier"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingProduct(null);
                    setFormError(null);
                  }}
                  disabled={isUploading}
                  className="px-4 py-2.5 bg-[#FAF9F7] text-gray-600 font-bold rounded-xl hover:bg-[#E5E5E5] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2.5 bg-[#C62828] text-white font-bold rounded-xl hover:bg-[#B71C1C] shadow-md transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isUploading ? 'Uploading...' : editingProduct ? 'Save Changes' : 'Add Wholesale Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
