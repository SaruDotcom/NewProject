'use client';

import React, { useState, useMemo } from 'react';
import {
  FolderTree,
  Plus,
  Package,
  Layers,
  Edit,
  Trash2,
  X,
  Shirt,
  ShieldAlert,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronDown,
  Search,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import { Category } from '@/lib/types';
import { CategoryCard } from '@/components/categories/CategoryCard';
import api, { ApiError } from '@/lib/api';
import { Link } from 'react-router-dom';

// Helper to determine the nesting depth of a category (Level 1: Root, Level 2: Subcategory, Level 3: Sub-subcategory)
function getCategoryLevel(categoryId: string, categoriesList: Category[]): number {
  let level = 1;
  let curr = categoriesList.find((c) => c.id === categoryId);
  const visited = new Set<string>();
  while (curr?.parentId && !visited.has(curr.id)) {
    visited.add(curr.id);
    level += 1;
    curr = categoriesList.find((c) => c.id === curr?.parentId);
  }
  return level;
}

// Helper to gather all descendant category IDs recursively
function getAllDescendantCategoryIds(catId: string, categoriesList: Category[]): Set<string> {
  const descendants = new Set<string>();
  const queue = [catId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const cat of categoriesList) {
      if (cat.parentId === currentId && !descendants.has(cat.id)) {
        descendants.add(cat.id);
        queue.push(cat.id);
      }
    }
  }
  return descendants;
}

export default function CategoriesPage() {
  const { profile, categories, products, addCategory, updateCategory, deleteCategory, isLoading } = useWholesaler();
  const canCreateCategories = profile.kycStatus === 'APPROVED';

  // UI View Mode (Grid or List/Table)
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  // Search Filter State
  const [searchQuery, setSearchQuery] = useState('');

  // Tree Expansion States
  // Level 2 subcategories that have their Level 3 children expanded
  const [expandedSubcategoryIds, setExpandedSubcategoryIds] = useState<Set<string>>(new Set());
  // Cards that have expanded beyond the default 3 Level 2 subcategories
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  // Modals & Action States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<Category | null>(null);
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Toggle Level 3 expansion under a Level 2 subcategory
  const toggleSubcategoryExpanded = (subId: string) => {
    setExpandedSubcategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) {
        next.delete(subId);
      } else {
        next.add(subId);
      }
      return next;
    });
  };

  // Toggle "Show all / Show less" for Level 2 rows in a card
  const toggleCardShowAll = (cardId: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleOpenAddModal = (parentCategory?: Category) => {
    if (!canCreateCategories) return;

    // Guard against adding a child to a Level 3 category (3-level limit)
    if (parentCategory && getCategoryLevel(parentCategory.id, categories) >= 3) {
      setDeleteWarning('Maximum 3 levels supported: Category (Level 1) → Subcategory (Level 2) → Sub-subcategory (Level 3). You cannot add children below Level 3.');
      return;
    }

    setEditingCategory(null);
    setName('');
    setDescription('');
    setImageUrl('');
    setImageFile(null);
    setSelectedIcon('Shirt');
    setFormError(null);
    setSuccessMessage(null);
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
    setSuccessMessage(null);
    setParentId(category.parentId || '');
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Category name is required.');
      return;
    }
    if (trimmedName.length > 100) {
      setFormError('Category name cannot exceed 100 characters.');
      return;
    }

    // Check 3-level limit on chosen parent
    if (parentId) {
      const parentDepth = getCategoryLevel(parentId, categories);
      if (parentDepth >= 3) {
        setFormError('Cannot select a Level 3 category as parent. Maximum hierarchy is 3 levels.');
        return;
      }
    }

    const isEditing = Boolean(editingCategory);

    try {
      let finalImageUrl = imageUrl.trim();
      if (imageFile) {
        setIsUploading(true);
        try {
          const res = await api.uploadProductImages([imageFile]);
          const uploadedImage = res.data?.[0];
          const uploadedImageUrl = typeof uploadedImage === 'string'
            ? uploadedImage
            : uploadedImage && typeof uploadedImage.url === 'string'
              ? uploadedImage.url
              : '';
          if (!uploadedImageUrl) {
            throw new Error('The category image upload did not return an image URL.');
          }
          finalImageUrl = uploadedImageUrl;
        } finally {
          setIsUploading(false);
        }
      }

      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: trimmedName,
          description,
          imageUrl: finalImageUrl,
          icon: selectedIcon,
          parentId: parentId || null,
        });
        setEditingCategory(null);
      } else {
        await addCategory({
          name: trimmedName,
          description,
          imageUrl: finalImageUrl,
          icon: selectedIcon,
          parentId: parentId || null,
        });
        setShowAddModal(false);
      }

      setSuccessMessage(isEditing ? 'Category updated successfully.' : 'Category created successfully.');
      setName('');
      setDescription('');
      setImageUrl('');
      setImageFile(null);
      setParentId('');
    } catch (err: any) {
      console.error('Failed to save category:', err);
      const validationDetails = err instanceof ApiError
        ? err.errors.map(({ field, message }) => `${field}: ${message}`).join(' ')
        : '';
      setFormError(validationDetails || err?.message || 'Failed to save category. Please try again.');
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

  const handleDeleteClick = (category: Category) => {
    const assignedProducts = products.filter(
      (product) => product.categoryId === category.id || product.subcategoryId === category.id,
    );
    if (assignedProducts.length > 0) {
      setCategoryToDelete(category);
      setReplacementCategoryId(categories.find((item) => !item.parentId && item.id !== category.id)?.id || '');
      return;
    }

    // Direct deletion confirmation for safe interaction
    setConfirmDeleteCategory(category);
  };

  const handleConfirmDirectDelete = async () => {
    if (!confirmDeleteCategory) return;
    const cat = confirmDeleteCategory;
    setConfirmDeleteCategory(null);

    const result = await deleteCategory(cat.id);
    if (!result.success && result.message) {
      setDeleteWarning(result.message);
    } else {
      setSuccessMessage('Category deleted successfully.');
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
      setSuccessMessage('Products reassigned and category deleted successfully.');
    } catch (err: any) {
      setDeleteWarning(err?.message || 'Products could not be reassigned. The category was not deleted.');
    } finally {
      setIsReassigning(false);
    }
  };

  // Calculate Product count for any category node (direct + descendant assignments)
  const getCategoryProductCount = (category: Category): number => {
    const descendantIds = getAllDescendantCategoryIds(category.id, categories);
    return products.filter(
      (p) =>
        p.categoryId === category.id ||
        p.category === category.name ||
        (p.subcategoryId && (p.subcategoryId === category.id || descendantIds.has(p.subcategoryId)))
    ).length;
  };

  // Summary Metrics
  const rootCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const totalSubcategories = useMemo(() => categories.filter((c) => Boolean(c.parentId)).length, [categories]);
  const totalAssignedProducts = useMemo(
    () => products.filter((p) => Boolean(p.categoryId || p.subcategoryId || p.category)).length,
    [products]
  );

  // Search filtering logic
  const filteredRootCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rootCategories;

    return rootCategories.filter((rootCat) => {
      // Check root category
      if (
        rootCat.name.toLowerCase().includes(q) ||
        (rootCat.description && rootCat.description.toLowerCase().includes(q))
      ) {
        return true;
      }
      // Check if any descendant subcategory matches
      const descendants = getAllDescendantCategoryIds(rootCat.id, categories);
      return categories.some((c) => descendants.has(c.id) && c.name.toLowerCase().includes(q));
    });
  }, [rootCategories, categories, searchQuery]);

  return (
    <div className="space-y-6">
      {/* 1. PAGE HEADER & TOOLBAR */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-tradeflow-green-50 text-tradeflow-green border border-tradeflow-green/20 flex items-center gap-1.5 shadow-2xs">
              <Sparkles className="w-3 h-3 text-tradeflow-green" />
              <span>Catalog Structure</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#1C1917] tracking-tight">Product Categories</h1>
          <p className="text-xs text-[#78716C] mt-0.5">
            Organize catalog hierarchy, manage 3-level subcategories, and cover banners for retailer browsing
          </p>
        </div>

        {successMessage && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            {successMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-[#A8A29E] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-[#E7E5E4] rounded-xl focus:outline-none focus:border-tradeflow-green focus:ring-1 focus:ring-tradeflow-green/20 text-[#1C1917] placeholder-[#A8A29E] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Grid vs Table View Toggle */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-[#E7E5E4] shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'GRID' ? 'bg-tradeflow-green-50 text-tradeflow-green' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Grid View (Cards)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'TABLE' ? 'bg-tradeflow-green-50 text-tradeflow-green' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="List / Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Create Category Button */}
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            disabled={!canCreateCategories}
            className="flex items-center gap-2 px-4 py-2 bg-tradeflow-green text-white text-xs font-semibold rounded-xl hover:bg-tradeflow-green-hover shadow-xs transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Create Category</span>
          </button>
        </div>
      </div>

      {/* KYC Warning Banner */}
      {!canCreateCategories && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-xs sm:flex-row sm:items-center sm:justify-between shadow-2xs">
          <div>
            <p className="font-bold text-amber-900">KYC approval is required to create or modify categories.</p>
            <p className="mt-0.5 text-gray-600">Current status: {profile.kycStatus || 'DRAFT'}</p>
          </div>
          <Link
            to="/dashboard/profile?tab=kyc"
            className="inline-flex w-fit items-center rounded-xl bg-tradeflow-green px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-tradeflow-green-hover shadow-2xs transition-colors"
          >
            Complete KYC
          </Link>
        </div>
      )}

      {/* 2. SUMMARY METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-[#E7E5E4] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-tradeflow-green-50 text-tradeflow-green border border-tradeflow-green/15 flex items-center justify-center shrink-0">
            <FolderTree className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1C1917] leading-tight tracking-tight">{rootCategories.length}</div>
            <div className="text-xs font-medium text-[#78716C] mt-0.5">Total Categories</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E7E5E4] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1C1917] leading-tight tracking-tight">{totalSubcategories}</div>
            <div className="text-xs font-medium text-[#78716C] mt-0.5">Subcategories (L2 & L3)</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E7E5E4] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1C1917] leading-tight tracking-tight">{totalAssignedProducts}</div>
            <div className="text-xs font-medium text-[#78716C] mt-0.5">Products Assigned</div>
          </div>
        </div>
      </div>

      {/* 3. LOADING SKELETONS */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-[#E7E5E4] overflow-hidden shadow-xs animate-pulse"
            >
              <div className="h-[140px] bg-gray-200" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="space-y-2 pt-2">
                  <div className="h-7 bg-gray-100 rounded-lg" />
                  <div className="h-7 bg-gray-100 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. GLOBAL EMPTY STATE */}
      {!isLoading && categories.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#E7E5E4] p-12 text-center max-w-md mx-auto shadow-xs my-8">
          <div className="w-16 h-16 rounded-2xl bg-tradeflow-green-50 text-tradeflow-green flex items-center justify-center mx-auto mb-4 border border-tradeflow-green/20">
            <FolderTree className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="text-lg font-bold text-[#1C1917]">No categories available</h3>
          <p className="text-xs text-[#78716C] mt-1.5 mb-6 max-w-xs mx-auto leading-relaxed">
            Create your first product category to organize your wholesale catalog and help retailers browse your inventory.
          </p>
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            disabled={!canCreateCategories}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-tradeflow-green text-white text-xs font-bold rounded-xl hover:bg-tradeflow-green-hover shadow-xs transition-all disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Create your first category</span>
          </button>
        </div>
      )}

      {/* SEARCH EMPTY STATE */}
      {!isLoading && categories.length > 0 && filteredRootCategories.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#E7E5E4] p-8 text-center max-w-md mx-auto shadow-xs my-8">
          <Search className="w-8 h-8 text-[#A8A29E] mx-auto mb-2" />
          <h3 className="text-sm font-bold text-[#1C1917]">No categories match "{searchQuery}"</h3>
          <p className="text-xs text-[#78716C] mt-1 mb-4">Try searching with another keyword or clear the search filter.</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="px-4 py-2 bg-[#FAF9F6] border border-[#E7E5E4] text-[#44403C] text-xs font-bold rounded-xl hover:bg-[#F5F5F4] transition-colors"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* 5. VIEW MODE: GRID (CARDS & TREE HIERARCHY) */}
      {!isLoading && viewMode === 'GRID' && filteredRootCategories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {filteredRootCategories.map((cat) => {
            const canManageCategory = cat.wholesalerId === profile.id;
            const coverImage = cat.imageUrl || '';
            const directSubs = categories.filter((c) => c.parentId === cat.id);
            const totalProducts = getCategoryProductCount(cat);
            const isCardExpanded = expandedCardIds.has(cat.id);
            const displayedSubs = isCardExpanded ? directSubs : directSubs.slice(0, 3);
            const hasMoreSubs = directSubs.length > 3;

            return (
              <CategoryCard
                key={cat.id}
                name={cat.name}
                coverImage={coverImage}
                productCount={totalProducts}
                subcategoryCount={directSubs.length}
                description={cat.description}
                headerActions={
                  <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-90 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 z-10">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(cat)}
                      disabled={!canManageCategory}
                      className="p-1.5 rounded-lg bg-black/45 hover:bg-black/75 text-white/95 backdrop-blur-xs transition-colors shadow-2xs"
                      title="Edit Category"
                      aria-label={`Edit ${cat.name}`}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(cat)}
                      disabled={!canManageCategory}
                      className="p-1.5 rounded-lg bg-black/45 hover:bg-red-600 text-white/95 backdrop-blur-xs transition-colors shadow-2xs"
                      title="Delete Category"
                      aria-label={`Delete ${cat.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                }
                footer={
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal(cat)}
                    disabled={!canCreateCategories}
                    className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#E7E5E4] bg-white text-xs font-semibold text-[#1C1917] shadow-2xs transition-all hover:bg-tradeflow-green-50 hover:text-tradeflow-green hover:border-tradeflow-green/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5 text-tradeflow-green" />
                    <span>Add subcategory</span>
                  </button>
                }
              >
                {directSubs.length > 0 ? (
                  <div className="space-y-1">
                    {displayedSubs.map((subcat) => {
                      const canManageSubcategory = subcat.wholesalerId === profile.id;
                      const childSubs = categories.filter((c) => c.parentId === subcat.id);
                      const subProdCount = getCategoryProductCount(subcat);
                      const isSubExpanded = expandedSubcategoryIds.has(subcat.id);
                      const hasChildren = childSubs.length > 0;

                      return (
                        <div key={subcat.id} className="group/row rounded-xl transition-colors">
                          {/* LEVEL 2 ROW */}
                          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#FAF9F6] transition-colors">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {hasChildren ? (
                                <button
                                  type="button"
                                  onClick={() => toggleSubcategoryExpanded(subcat.id)}
                                  className="p-0.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                  title={isSubExpanded ? 'Collapse sub-subcategories' : 'Expand sub-subcategories'}
                                  aria-label={`Toggle subcategories for ${subcat.name}`}
                                >
                                  {isSubExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-4 h-4 flex items-center justify-center text-gray-300 text-xs">
                                  •
                                </span>
                              )}

                              <span className="text-xs font-semibold text-[#1C1917] truncate" title={subcat.name}>
                                {subcat.name}
                              </span>

                              <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.2 text-[10px] font-medium text-[#78716C] shrink-0">
                                {subProdCount}
                              </span>
                            </div>

                            {/* Row Actions on Hover */}
                            <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenAddModal(subcat)}
                                disabled={!canCreateCategories}
                                className="p-1 text-gray-400 hover:text-tradeflow-green hover:bg-white rounded transition-colors disabled:opacity-50"
                                title={`Add subcategory under ${subcat.name}`}
                                aria-label={`Add subcategory under ${subcat.name}`}
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(subcat)}
                                disabled={!canManageSubcategory}
                                className="p-1 text-gray-400 hover:text-tradeflow-green hover:bg-white rounded transition-colors"
                                title={`Edit ${subcat.name}`}
                                aria-label={`Edit ${subcat.name}`}
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(subcat)}
                                disabled={!canManageSubcategory}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-white rounded transition-colors"
                                title={`Delete ${subcat.name}`}
                                aria-label={`Delete ${subcat.name}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* LEVEL 3 ROWS (Tree connector lines) */}
                          {hasChildren && isSubExpanded && (
                            <div className="relative pl-6 ml-2 my-1 space-y-0.5">
                              {/* Thin vertical connector line */}
                              <div className="absolute left-2.5 top-0 bottom-2.5 w-px bg-gray-200" />

                              {childSubs.map((level3) => {
                                const canManageLevel3 = level3.wholesalerId === profile.id;
                                const l3Count = getCategoryProductCount(level3);
                                return (
                                  <div
                                    key={level3.id}
                                    className="group/l3 relative flex items-center justify-between py-1 px-2 rounded-lg hover:bg-[#FAF9F6] transition-colors"
                                  >
                                    {/* Thin horizontal connector branch */}
                                    <div className="absolute -left-3.5 top-1/2 w-3.5 h-px bg-gray-200" />

                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span className="text-[11px] font-normal text-gray-600 truncate" title={level3.name}>
                                        {level3.name}
                                      </span>
                                      <span className="rounded-full bg-gray-50 border border-gray-100 px-1.5 py-0.2 text-[9px] font-medium text-gray-500 shrink-0">
                                        {l3Count}
                                      </span>
                                    </div>

                                    {/* Level 3 Row Actions */}
                                    <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-l3:opacity-100 transition-opacity shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditModal(level3)}
                                        disabled={!canManageLevel3}
                                        className="p-1 text-gray-400 hover:text-tradeflow-green hover:bg-white rounded transition-colors"
                                        title={`Edit ${level3.name}`}
                                        aria-label={`Edit ${level3.name}`}
                                      >
                                        <Edit className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteClick(level3)}
                                        disabled={!canManageLevel3}
                                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-white rounded transition-colors"
                                        title={`Delete ${level3.name}`}
                                        aria-label={`Delete ${level3.name}`}
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* "Show all (X)" / "Show less" Link */}
                    {hasMoreSubs && (
                      <div className="pt-1.5 pl-2">
                        <button
                          type="button"
                          onClick={() => toggleCardShowAll(cat.id)}
                          className="text-[11px] font-semibold text-tradeflow-green hover:underline flex items-center gap-1"
                        >
                          <span>{isCardExpanded ? 'Show less' : `Show all (${directSubs.length})`}</span>
                          {isCardExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </CategoryCard>
            );
          })}
        </div>
      )}

      {/* 6. VIEW MODE: TABLE / LIST */}
      {!isLoading && viewMode === 'TABLE' && (
        <div className="bg-white rounded-2xl border border-[#E7E5E4] p-6 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E7E5E4] text-[#78716C] font-bold uppercase tracking-wider">
                  <th className="pb-3">Cover</th>
                  <th className="pb-3">Category Hierarchy</th>
                  <th className="pb-3">Level</th>
                  <th className="pb-3">Description</th>
                  <th className="pb-3">Assigned Products</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E4]">
                {categories
                  .filter((cat) => {
                    const q = searchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      cat.name.toLowerCase().includes(q) ||
                      (cat.description && cat.description.toLowerCase().includes(q))
                    );
                  })
                  .map((cat) => {
                    const canManageCategory = cat.wholesalerId === profile.id;
                    const linkedProductsCount = getCategoryProductCount(cat);
                    const coverImage = cat.imageUrl || '';
                    const level = getCategoryLevel(cat.id, categories);

                    return (
                      <tr key={cat.id} className="hover:bg-[#FAF9F6] transition-colors">
                        <td className="py-3">
                          {coverImage ? (
                            <img
                              src={coverImage}
                              alt={cat.name}
                              className="w-12 h-9 rounded-lg object-cover border border-[#E7E5E4]"
                            />
                          ) : (
                            <div className="flex h-9 w-12 items-center justify-center rounded-lg border border-dashed border-[#E7E5E4] text-[#A8A29E]">
                              <FolderTree className="h-4 w-4" />
                            </div>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="font-bold text-sm text-[#1C1917]">{cat.name}</div>
                          {cat.parentId && (
                            <div className="text-[10px] text-[#78716C] mt-0.5">
                              Path: {getCategoryDisplayPath(cat.id)}
                            </div>
                          )}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              level === 1
                                ? 'bg-tradeflow-green-50 text-tradeflow-green border border-tradeflow-green/20'
                                : level === 2
                                  ? 'bg-[#FAF9F6] text-[#1C1917] border border-[#E7E5E4]'
                                  : 'bg-[#FAF9F6] text-[#78716C]'
                            }`}
                          >
                            Level {level}
                          </span>
                        </td>
                        <td className="py-3 text-[#44403C] max-w-xs truncate">{cat.description || '—'}</td>
                        <td className="py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                              linkedProductsCount > 0
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-[#FAF9F6] text-[#78716C]'
                            }`}
                          >
                            {linkedProductsCount} Products
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {level < 3 && (
                              <button
                                type="button"
                                onClick={() => handleOpenAddModal(cat)}
                                disabled={!canCreateCategories}
                                className="p-1.5 text-[#78716C] hover:text-tradeflow-green hover:bg-tradeflow-green-50 rounded-lg transition-colors border border-[#E7E5E4] disabled:opacity-50"
                                title={`Add subcategory under ${cat.name}`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(cat)}
                              disabled={!canManageCategory}
                              className="px-3 py-1.5 bg-[#FAF9F6] border border-[#E7E5E4] hover:border-tradeflow-green/30 hover:text-tradeflow-green text-xs font-bold rounded-xl transition-colors flex items-center gap-1 text-[#1C1917]"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(cat)}
                              disabled={!canManageCategory}
                              className="p-1.5 text-[#78716C] hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* 7. CREATE / EDIT CATEGORY MODAL */}
      {(showAddModal || editingCategory) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-[#E7E5E4] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]">
              <div>
                <h2 className="text-lg font-bold text-[#1C1917]">
                  {editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create Category'}
                </h2>
                <p className="text-xs text-[#78716C] mt-0.5">
                  {parentId
                    ? `Adding child under: ${getCategoryDisplayPath(parentId)}`
                    : 'Adding root category (Level 1)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingCategory(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Shirts, Denim, Electronics"
                  className="w-full px-3.5 py-2.5 border border-[#E7E5E4] rounded-xl bg-[#FAF9F6] focus:border-tradeflow-green focus:ring-1 focus:ring-tradeflow-green/20 focus:outline-none font-medium text-[#1C1917]"
                />
              </div>

              <div>
                <label htmlFor="category-parent" className="mb-1 block font-bold text-gray-700">
                  Parent Category (Max 3-Level Depth)
                </label>
                <select
                  id="category-parent"
                  value={parentId}
                  onChange={(event) => setParentId(event.target.value)}
                  disabled={Boolean(editingCategory && categories.some((category) => category.parentId === editingCategory.id))}
                  className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF9F6] px-3.5 py-2.5 focus:border-tradeflow-green focus:ring-1 focus:ring-tradeflow-green/20 focus:outline-none font-medium text-gray-800 text-xs"
                >
                  <option value="">Main category (Root Level 1)</option>
                  {categories
                    .filter((category) => category.id !== editingCategory?.id)
                    .map((category) => {
                      const depth = getCategoryLevel(category.id, categories);
                      const isLevel3 = depth >= 3;
                      return (
                        <option
                          key={category.id}
                          value={category.id}
                          disabled={isLevel3}
                        >
                          {category.displayPath || getCategoryDisplayPath(category.id)}{' '}
                          {isLevel3 ? '(Level 3 - Max Depth)' : `(Level ${depth})`}
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* Cover Image Upload (with Preset Options) */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Category Cover Image (Drag & Drop or Preset)
                </label>
                <div
                  className="border-2 border-dashed border-tradeflow-green/30 hover:border-tradeflow-green rounded-xl bg-[#FAF9F6] p-4 text-center cursor-pointer hover:bg-tradeflow-green-50/50 transition"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const f = e.dataTransfer.files[0];
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
                    <img
                      src={URL.createObjectURL(imageFile)}
                      alt="preview"
                      className="w-full h-32 object-cover rounded-lg border border-[#E7E5E4] mx-auto"
                    />
                  ) : imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="preview"
                      className="w-full h-32 object-cover rounded-lg border border-[#E7E5E4] mx-auto"
                    />
                  ) : (
                    <div className="py-2">
                      <FolderTree className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <span className="text-xs text-gray-500 font-medium">
                        Drag & drop image here or click to select (Max 5MB)
                      </span>
                    </div>
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
                  className="w-full px-3.5 py-2 border border-[#E7E5E4] rounded-xl bg-[#FAF9F6] focus:border-tradeflow-green focus:ring-1 focus:ring-tradeflow-green/20 focus:outline-none font-medium text-[#1C1917]"
                />
              </div>

              <div className="pt-3 border-t border-[#E7E5E4] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCategory(null);
                  }}
                  disabled={isUploading}
                  className="px-4 py-2 font-bold text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2.5 bg-tradeflow-green text-white font-bold rounded-xl hover:bg-tradeflow-green-hover shadow-sm transition-all"
                >
                  {isUploading ? 'Uploading...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. DIRECT DELETE CONFIRMATION MODAL */}
      {confirmDeleteCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#1C1917]">Delete Category?</h3>
              <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                Are you sure you want to delete <strong>{confirmDeleteCategory.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E7E5E4]">
              <button
                type="button"
                onClick={() => setConfirmDeleteCategory(null)}
                className="flex-1 rounded-xl px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDirectDelete}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-700 shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. REASSIGN PRODUCTS & DELETE MODAL */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-2xl">
            <div>
              <h3 className="text-lg font-extrabold text-[#1C1917]">Reassign products and delete?</h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-600">
                Products are assigned to <strong>{categoryToDelete.name}</strong>. You must select another category to move them to before deleting.
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
                  className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF9F6] px-3 py-2.5 text-xs font-medium focus:border-tradeflow-green focus:ring-1 focus:ring-tradeflow-green/20 focus:outline-none text-[#1C1917]"
                >
                  {categories
                    .filter((category) => !category.parentId && category.id !== categoryToDelete.id)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Create another category first, then reassign these products before deleting this category.
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-[#E7E5E4] pt-4">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                disabled={isReassigning}
                className="rounded-xl px-4 py-2 text-xs font-bold text-gray-600 hover:bg-[#FAF9F6] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReassignAndDelete}
                disabled={
                  !replacementCategoryId ||
                  isReassigning ||
                  !categories.some((category) => !category.parentId && category.id !== categoryToDelete.id)
                }
                className="rounded-xl bg-tradeflow-green px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-tradeflow-green-hover disabled:cursor-not-allowed disabled:opacity-50 shadow-xs"
              >
                {isReassigning ? 'Moving products...' : 'Move & Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. DELETION PROTECTION WARNING MODAL */}
      {deleteWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-[#E7E5E4] shadow-2xl text-center">
            <div className="w-14 h-14 bg-tradeflow-green-50 text-tradeflow-green rounded-full flex items-center justify-center mx-auto border border-tradeflow-green/20">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#1C1917]">Notice</h3>
              <p className="text-xs text-[#78716C] mt-2 leading-relaxed">{deleteWarning}</p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setDeleteWarning(null)}
                className="w-full py-2.5 bg-tradeflow-green text-white text-xs font-bold rounded-xl hover:bg-tradeflow-green-hover transition-all shadow-xs"
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
