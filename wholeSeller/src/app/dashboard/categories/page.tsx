'use client';

import React, { useState } from 'react';
import {
  FolderTree,
  Plus,
  Package,
  Layers,
  Edit,
  Trash2,
  AlertTriangle,
  X,
  Check,
  Shirt,
  Footprints,
  Smartphone,
  Watch,
  Home,
  Tag,
  ShieldAlert,
  LayoutGrid,
  List,
  Image as ImageIcon,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import { Category, DEFAULT_CATEGORY_IMAGES, getCategoryImageUrl } from '@/lib/mock-data';
import api from '@/lib/api';
import { Link } from 'react-router-dom';

// Preset sample category images for quick form selection
const PRESET_IMAGE_OPTIONS = [
  { label: '👔 Clothes / Apparel', url: DEFAULT_CATEGORY_IMAGES.clothes },
  { label: '📱 Electronics & Tech', url: DEFAULT_CATEGORY_IMAGES.electronics },
  { label: '👟 Footwear & Leather', url: DEFAULT_CATEGORY_IMAGES.footwear },
  { label: '⌚ Accessories', url: DEFAULT_CATEGORY_IMAGES.accessories },
  { label: '🏠 Home & Kitchen', url: DEFAULT_CATEGORY_IMAGES.home },
];

export default function CategoriesPage() {
  const { profile, categories, products, addCategory, updateCategory, deleteCategory, isLoading } = useWholesaler();
  const canCreateCategories = profile.kycStatus === 'APPROVED';

  // UI View Mode (Default to GRID as requested)
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [replacementCategoryId, setReplacementCategoryId] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [parentId, setParentId] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('Shirt');
  const [formError, setFormError] = useState<string | null>(null);

  const handleOpenAddModal = (parentCategory?: Category) => {
    if (!canCreateCategories) return;
    setEditingCategory(null);
    setName('');
    setDescription('');
    setImageUrl('');
    setImageFile(null);
    setSelectedIcon('Shirt');
    setFormError(null);
    setParentId(parentCategory?.id || '');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setDescription(category.description || '');
    setImageUrl(category.imageUrl || '');
    setImageFile(null);
    setSelectedIcon(category.icon || 'Shirt');
    setFormError(null);
    setParentId(category.parentId || '');
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    try {
      let finalImageUrl = imageUrl.trim();
      if (imageFile) {
        setIsUploading(true);
        try {
          const res = await api.uploadProductImages([imageFile]);
          if (res.data && res.data.length > 0) {
            finalImageUrl = res.data[0];
          }
        } catch (err) {
          console.error(err);
        }
        setIsUploading(false);
      }

      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name,
          slug,
          description,
          imageUrl: finalImageUrl,
          icon: selectedIcon,
          parentId: parentId || null,
        });
        setEditingCategory(null);
      } else {
        await addCategory({
          name,
          slug,
          description,
          imageUrl: finalImageUrl,
          icon: selectedIcon,
          parentId: parentId || null,
        });
        setShowAddModal(false);
      }

      setName('');
      setDescription('');
      setImageUrl('');
      setImageFile(null);
      setParentId('');
    } catch (err: any) {
      console.error('Failed to save category:', err);
    }
  };

  const getCategoryDisplayPath = (catId: string): string => {
    const path: string[] = [];
    let curr = categories.find((c) => c.id === catId);
    const visited = new Set<string>();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      path.unshift(curr.name);
      if (!curr.parentId) break;
      curr = categories.find((c) => c.id === curr!.parentId);
    }
    return path.join(' > ');
  };

  const selectedParentCat = categories.find((c) => c.id === parentId);
  const selectedParentName = (selectedParentCat?.name || '').toLowerCase();
  const suggestedSubcategories = selectedParentName.includes('women')
    ? ['Saree', 'Lehenga', 'Suit', 'Kurti', 'Western Wear', 'Gown']
    : selectedParentName.includes('men')
      ? ['Shirts', 'T-Shirts', 'Jeans', 'Trousers', 'Jackets', 'Kurtas']
      : selectedParentName.includes('cloth') || selectedParentName.includes('apparel') || selectedParentName.includes('fashion')
        ? ['Men', 'Women', 'Kids', 'Ethnic Wear', 'Western Wear']
        : selectedParentName.includes('electronic') || selectedParentName.includes('tech')
          ? ['Mobiles', 'Computers', 'Audio', 'Accessories']
          : [];

  const renderCategoryTreeNodes = (parentCatId: string, level = 1) => {
    const directSubs = categories.filter((c) => c.parentId === parentCatId);
    if (directSubs.length === 0) return null;

    return (
      <div className={`flex flex-wrap gap-2 ${level > 1 ? 'mt-1.5 pl-2.5 border-l-2 border-[#C62828]/25' : ''}`}>
        {directSubs.map((subcategory) => {
          const childSubs = categories.filter((c) => c.parentId === subcategory.id);
          const subProdCount = products.filter((p) => p.subcategoryId === subcategory.id || p.categoryId === subcategory.id).length;

          return (
            <div key={subcategory.id} className="flex flex-col gap-1 max-w-full">
              <div className="inline-flex max-w-full items-center gap-1 rounded-md border border-[#E5E5E5] bg-[#FAF9F7] pl-2.5 pr-1 py-1 shadow-2xs">
                <span className="max-w-36 truncate text-[11px] font-extrabold text-[#1F1F1F]">
                  {subcategory.name}
                </span>
                <span className="rounded-full bg-gray-200 px-1.5 py-0.2 text-[9px] font-bold text-gray-700">{subProdCount}</span>
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal(subcategory)}
                    className="rounded p-1 text-gray-400 hover:bg-white hover:text-[#C62828]"
                    title={`Add subcategory under ${subcategory.name}`}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(subcategory)}
                    className="rounded p-1 text-gray-500 hover:bg-white hover:text-[#C62828]"
                    aria-label={`Edit ${subcategory.name}`}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(subcategory)}
                    className="rounded p-1 text-gray-500 hover:bg-white hover:text-red-600"
                    aria-label={`Delete ${subcategory.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {childSubs.length > 0 && renderCategoryTreeNodes(subcategory.id, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const handleDeleteClick = async (category: Category) => {
    const assignedProducts = products.filter(
      (product) => product.categoryId === category.id || product.subcategoryId === category.id,
    );
    if (assignedProducts.length > 0) {
      setCategoryToDelete(category);
      setReplacementCategoryId(categories.find((item) => !item.parentId && item.id !== category.id)?.id || '');
      return;
    }

    const result = await deleteCategory(category.id);
    if (!result.success && result.message) {
      setDeleteWarning(result.message);
    }
  };

  const handleReassignAndDelete = async () => {
    if (!categoryToDelete || !replacementCategoryId) return;
    const replacement = categories.find((item) => !item.parentId && item.id === replacementCategoryId);
    if (!replacement) return;

    setIsReassigning(true);
    try {
      const assignedProducts = products.filter(
        (product) => product.categoryId === categoryToDelete.id || product.subcategoryId === categoryToDelete.id,
      );

      for (const product of assignedProducts) {
        await api.updateProduct(product.id, {
          ...(product.categoryId === categoryToDelete.id && {
            categoryId: replacement.id,
            categoryName: replacement.name,
          }),
          ...(product.subcategoryId === categoryToDelete.id && { subcategoryId: null }),
        });
      }

      const result = await deleteCategory(categoryToDelete.id);
      if (!result.success) {
        setDeleteWarning(result.message || 'Unable to delete category after reassigning products.');
        return;
      }

      setCategoryToDelete(null);
    } catch (err: any) {
      setDeleteWarning(err?.message || 'Products could not be reassigned. The category was not deleted.');
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#FFEBEE] text-[#C62828] border border-[#C62828]/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Category Catalog Management</span>
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1F1F1F]">Wholesaler Product Categories</h1>
          <p className="text-xs text-gray-500">Manage categories with cover images for catalog dropdowns and retailer site browsing</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Grid vs Table View Toggle */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-[#E5E5E5]">
            <button
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'GRID' ? 'bg-[#FFEBEE] text-[#C62828]' : 'text-gray-400 hover:text-gray-600'}`}
              title="Grid View (Cards)"
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
            onClick={() => handleOpenAddModal()}
            disabled={!canCreateCategories}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#C62828] text-white text-xs font-bold rounded-xl hover:bg-[#B71C1C] shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Create Category</span>
          </button>
        </div>
      </div>

      {!canCreateCategories && (
        <div className="flex flex-col gap-3 border border-[#F9A825]/30 bg-[#FFF8E1] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-[#6D4C00]">KYC approval is required to create categories.</p>
            <p className="mt-1 text-xs text-[#795900]">Current status: {profile.kycStatus || 'DRAFT'}</p>
          </div>
          <Link to="/dashboard/kyc" className="inline-flex w-fit items-center rounded-md bg-[#C62828] px-3 py-2 text-xs font-bold text-white hover:bg-[#B71C1C]">
            Complete KYC
          </Link>
        </div>
      )}

      {/* VIEW MODE 1: GRID VIEW (Default & Primary View as Requested) */}
      {viewMode === 'GRID' && (
        <div className="grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {categories.filter((category) => !category.parentId).map((cat) => {
            const linkedProductsCount = products.filter(p => p.category === cat.name || p.categoryId === cat.id).length;
            const subcategories = categories.filter((category) => category.parentId === cat.id);
            const coverImage = getCategoryImageUrl(cat.name, cat.imageUrl);

            return (
              <div
                key={cat.id}
                className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-[#E5E5E5] bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C62828]/35 hover:shadow-lg"
              >
                <div className="flex flex-1 flex-col">
                  {/* Category Thumbnail / Cover Image */}
                  <div className="relative h-48 w-full overflow-hidden bg-[#f4f3f0]">
                    <img
                      src={coverImage}
                      alt={cat.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                    
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                      <div className="font-extrabold text-lg leading-tight tracking-tight drop-shadow-sm">{cat.name}</div>
                      <span className="rounded-sm bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-[#1F1F1F] shadow-xs">
                        {linkedProductsCount} Products
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <p className="text-xs text-gray-600 line-clamp-2 min-h-[32px]">
                      {cat.description || 'No category description provided.'}
                    </p>
                    <div className="mt-auto pt-1 text-[10px] font-mono text-gray-400">/{cat.slug}</div>
                  </div>
                </div>

                <div className="border-t border-[#E5E5E5] px-4 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase text-gray-500">Subcategories & Multi-level Tree</span>
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(cat)}
                      disabled={!canCreateCategories}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C62828] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add subcategory
                    </button>
                  </div>
                  {renderCategoryTreeNodes(cat.id) || (
                    <p className="text-[11px] text-gray-500">No subcategories yet.</p>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-[#E5E5E5] bg-[#FAF9F7] px-4 py-3">
                  <button
                    onClick={() => handleOpenEditModal(cat)}
                    className="px-3.5 py-1.5 bg-white border border-[#E5E5E5] hover:border-[#C62828] hover:text-[#C62828] text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Category</span>
                  </button>

                  <button
                    onClick={() => handleDeleteClick(cat)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
                  <th className="pb-3">Category Cover</th>
                  <th className="pb-3">Category Name</th>
                  <th className="pb-3">URL Slug</th>
                  <th className="pb-3">Description</th>
                  <th className="pb-3">Assigned Products</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {categories.map((cat) => {
                  const linkedProductsCount = products.filter(p => p.category === cat.name || p.categoryId === cat.id).length;
                  const coverImage = getCategoryImageUrl(cat.name, cat.imageUrl);

                  return (
                    <tr key={cat.id} className="hover:bg-[#FAF9F7] transition-colors">
                      <td className="py-3">
                        <img
                          src={coverImage}
                          alt={cat.name}
                          className="w-14 h-10 rounded-lg object-cover border border-[#E5E5E5]"
                        />
                      </td>
                      <td className="py-3 font-bold text-sm text-[#1F1F1F]">{cat.parentName ? `${cat.parentName} / ` : ''}{cat.name}</td>
                      <td className="py-3 font-mono text-gray-400">/{cat.slug}</td>
                      <td className="py-3 text-gray-600 max-w-xs truncate">{cat.description || 'N/A'}</td>
                      <td className="py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          linkedProductsCount > 0 ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {linkedProductsCount} Products Assigned
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(cat)}
                            className="px-3 py-1.5 bg-[#FAF9F7] border border-[#E5E5E5] hover:border-[#C62828] hover:text-[#C62828] text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteClick(cat)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Category"
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

      {/* CREATE / EDIT CATEGORY MODAL */}
      {(showAddModal || editingCategory) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-[#E5E5E5] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
              <h2 className="text-lg font-bold text-[#1F1F1F]">
                {editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create New Category'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingCategory(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-lg border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apparel & Textiles, Electronics, Clothes"
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] focus:border-[#C62828] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="category-parent" className="mb-1 block font-bold text-gray-700">Parent Category</label>
                <select
                  id="category-parent"
                  value={parentId}
                  onChange={(event) => setParentId(event.target.value)}
                  disabled={Boolean(editingCategory && categories.some((category) => category.parentId === editingCategory.id))}
                  className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAF9F7] px-3.5 py-2.5 focus:border-[#C62828] focus:outline-none font-bold text-gray-800 text-xs"
                >
                  <option value="">Main category (Root Level)</option>
                  {categories.filter((category) => category.id !== editingCategory?.id).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.displayPath || getCategoryDisplayPath(category.id)}
                    </option>
                  ))}
                </select>
                {suggestedSubcategories.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-500">Suggestions:</span>
                    {suggestedSubcategories.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setName(suggestion)}
                        className="rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-700 hover:border-[#C62828] hover:text-[#C62828]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Category Cover Image (Drag & Drop) <span className="text-red-500">*</span></label>
                <div 
                  className="border-2 border-dashed border-[#C62828] rounded-xl bg-[#FAF9F7] p-4 text-center cursor-pointer hover:bg-[#FCE4E4] transition"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const f = e.dataTransfer.files[0];
                      console.log(`Checking category image ${f.name}: size = ${f.size}, limit = ${5 * 1024 * 1024}`);
                      if (f.size > 5 * 1024 * 1024) {
                        setFormError(`File ${f.name} exceeds the 5MB limit.`);
                        return;
                      }
                      setImageFile(f);
                      setImageUrl('');
                      setFormError(null);
                    }
                  }}
                  onClick={() => document.getElementById('category-image-upload')?.click()}
                >
                  <input
                    id="category-image-upload"
                    type="file"
                    accept="image/jpeg, image/png, image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const f = e.target.files[0];
                        console.log(`Checking category image ${f.name}: size = ${f.size}, limit = ${5 * 1024 * 1024}`);
                        if (f.size > 5 * 1024 * 1024) {
                          setFormError(`File ${f.name} exceeds the 5MB limit.`);
                          return;
                        }
                        setImageFile(f);
                        setImageUrl('');
                        setFormError(null);
                      }
                    }}
                  />
                  {imageFile ? (
                    <img src={URL.createObjectURL(imageFile)} alt="preview" className="w-full max-h-48 object-cover rounded-md border mx-auto mt-2" />
                  ) : imageUrl ? (
                    <img src={imageUrl} alt="preview" className="w-full max-h-48 object-cover rounded-md border mx-auto mt-2" />
                  ) : (
                    <span className="text-sm text-gray-500">Drag & drop image here or click to select (1 image max)</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description for retail buyers..."
                  className="w-full px-3.5 py-2 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] focus:border-[#C62828] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCategory(null);
                  }}
                  disabled={isUploading}
                  className="px-4 py-2 font-bold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2.5 bg-[#C62828] text-white font-bold rounded-xl hover:bg-[#B71C1C] shadow-md transition-all"
                >
                  {isUploading ? 'Uploading...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-[#E5E5E5] bg-white p-6 shadow-2xl">
            <div>
              <h3 className="text-lg font-extrabold text-[#1F1F1F]">Reassign products and delete?</h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-600">
                Products assigned to <strong>{categoryToDelete.name}</strong> must be moved before this category can be deleted.
              </p>
            </div>

            {categories.some((category) => !category.parentId && category.id !== categoryToDelete.id) ? (
              <div>
                <label htmlFor="replacement-category" className="mb-1 block text-xs font-bold text-gray-700">
                  Move products to
                </label>
                <select
                  id="replacement-category"
                  value={replacementCategoryId}
                  onChange={(event) => setReplacementCategoryId(event.target.value)}
                  className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAF9F7] px-3 py-2.5 text-sm focus:border-[#C62828] focus:outline-none"
                >
                  {categories
                    .filter((category) => !category.parentId && category.id !== categoryToDelete.id)
                    .map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                </select>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Create another category first, then reassign these products before deleting this category.
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-[#E5E5E5] pt-4">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                disabled={isReassigning}
                className="rounded-lg px-4 py-2 text-xs font-bold text-gray-600 hover:bg-[#FAF9F7] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReassignAndDelete}
                disabled={!replacementCategoryId || isReassigning || !categories.some((category) => !category.parentId && category.id !== categoryToDelete.id)}
                className="rounded-lg bg-[#C62828] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#B71C1C] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isReassigning ? 'Moving products...' : 'Move & Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETION PROTECTION WARNING MODAL */}
      {deleteWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-[#E5E5E5] shadow-2xl text-center animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-[#FFEBEE] text-[#C62828] rounded-full flex items-center justify-center mx-auto border-2 border-[#C62828]/20">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-[#1F1F1F]">Cannot Delete Category</h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">{deleteWarning}</p>
            </div>

            <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E5E5E5] text-xs text-gray-500 font-medium">
              Category deletion is protected to maintain database integrity and prevent orphan products in your catalog.
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setDeleteWarning(null)}
                className="w-full py-2.5 bg-[#C62828] text-white text-xs font-bold rounded-xl hover:bg-[#B71C1C] transition-all shadow-md"
              >
                Understood & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
