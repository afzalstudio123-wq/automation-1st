'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Product, updateProduct, deleteProduct, getAuditLogs, AuditLog } from '@/app/actions';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';
import { 
  Download, 
  Search, 
  Filter, 
  Archive, 
  ArrowUpDown, 
  Layers,
  ArrowUpRight,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Eye,
  X,
  History,
  Info,
  ExternalLink,
  Package,
  Loader2
} from 'lucide-react';

interface InventoryTableProps {
  products: Product[];
  userRole?: string;
  userName?: string;
}

export default function InventoryTable({ products, userRole = 'Operator', userName = 'Operator' }: InventoryTableProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'v_price' | 'margin'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { success, error } = useToast();

  // Dialog States
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleteSaving, setIsDeleteSaving] = useState(false);
  
  // Audit Logs State (Admin only)
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  // Form states for editing
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    v_price: 0,
    i_price: 0,
    category: '',
    sub_category: '',
    hsn_code: '',
    sku: ''
  });

  // Populate edit form when opening edit dialog
  const startEdit = (product: Product) => {
    if (userRole !== 'Admin' && isProductLocked(product.created_at)) {
      error("Previous inventory is locked. Please request Admin approval.");
      return;
    }
    setEditingProduct(product);
    setEditForm({
      title: product.title,
      description: product.description || '',
      v_price: product.v_price,
      i_price: product.i_price,
      category: product.category,
      sub_category: product.sub_category,
      hsn_code: product.hsn_code || '',
      sku: product.sku
    });
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: name.includes('price') ? parseFloat(value) || 0 : value
    }));
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    if (!editForm.title || !editForm.category || !editForm.sub_category || !editForm.sku) {
      error("Required fields (Title, Category, Sub Category, SKU) cannot be empty.");
      return;
    }

    setIsEditSaving(true);
    try {
      const res = await updateProduct(editingProduct.id, editForm, userRole, userName);
      if (res.success) {
        success(`Successfully updated SKU: ${editForm.sku}`);
        setEditingProduct(null);
      } else {
        error(res.error || 'Failed to update product.');
      }
    } catch (err: any) {
      error(err.message || 'An unexpected error occurred during update.');
    } finally {
      setIsEditSaving(false);
    }
  };

  const confirmDelete = (product: Product) => {
    if (userRole !== 'Admin' && isProductLocked(product.created_at)) {
      error("Previous inventory is locked. Please request Admin approval.");
      return;
    }
    setDeletingProduct(product);
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    setIsDeleteSaving(true);
    try {
      const res = await deleteProduct(deletingProduct.id, userRole, userName);
      if (res.success) {
        success(`Product deleted successfully.`);
        setDeletingProduct(null);
      } else {
        error(res.error || 'Failed to delete product.');
      }
    } catch (err: any) {
      error(err.message || 'An error occurred during deletion.');
    } finally {
      setIsDeleteSaving(false);
    }
  };

  // Fetch audit logs (Admin only)
  const handleOpenAuditLogs = async () => {
    if (userRole !== 'Admin') {
      error("Access denied: Admin role required to view audit logs.");
      return;
    }
    setShowAuditLogs(true);
    setIsAuditLoading(true);
    try {
      const logs = await getAuditLogs(userRole);
      setAuditLogs(logs);
    } catch (err: any) {
      error(err.message || 'Failed to retrieve audit logs.');
    } finally {
      setIsAuditLoading(false);
    }
  };

  // Date lock checker
  const isProductLocked = (createdAt: string) => {
    if (userRole === 'Admin') return false;
    const today = new Date().toDateString();
    const created = new Date(createdAt).toDateString();
    return today !== created;
  };

  // Extract unique categories for filters
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category.trim()));
    return ['all', ...Array.from(cats)];
  }, [products]);

  // Handle client-side search, filtering, and sorting
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        const matchesSearch = 
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.sku.toLowerCase().includes(search.toLowerCase()) ||
          p.sub_category.toLowerCase().includes(search.toLowerCase()) ||
          (p.created_by && p.created_by.toLowerCase().includes(search.toLowerCase()));
        
        const matchesCategory = 
          selectedCategory === 'all' || 
          p.category.toLowerCase().trim() === selectedCategory.toLowerCase().trim();

        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        let valA = 0;
        let valB = 0;

        if (sortBy === 'date') {
          valA = new Date(a.created_at).getTime();
          valB = new Date(b.created_at).getTime();
        } else if (sortBy === 'v_price') {
          valA = a.v_price;
          valB = b.v_price;
        } else if (sortBy === 'margin') {
          valA = a.v_price - a.i_price;
          valB = b.v_price - b.i_price;
        }

        if (sortOrder === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
      });
  }, [products, search, selectedCategory, sortBy, sortOrder]);

  // Export to Excel client-side
  const handleExportExcel = () => {
    if (products.length === 0) {
      error('No data available to export.');
      return;
    }

    try {
      const data = filteredProducts.map(p => ({
        'Serial No.': p.serial_number,
        'SKU': p.sku,
        'Title': p.title,
        'Description': p.description,
        'HSN Code': p.hsn_code || '',
        'Vendor Price (VPrice)': p.v_price,
        'Selling Price (IPrice)': p.i_price,
        'Margin Profit': p.v_price - p.i_price,
        'Category': p.category,
        'Sub Category': p.sub_category,
        'Image URL': p.image_url || '',
        'Created By': p.created_by || 'Operator',
        'Date Created': new Date(p.created_at).toLocaleDateString('en-IN'),
        'Time Created': new Date(p.created_at).toLocaleTimeString('en-IN')
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products Inventory');

      // Autofit columns
      const colsWidth = [
        { wch: 10 }, { wch: 18 }, { wch: 25 }, { wch: 35 }, { wch: 12 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
      ];
      worksheet['!cols'] = colsWidth;

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `inventory_report_${dateStr}.xlsx`);
      success('Excel sheet downloaded successfully.');
    } catch (err: any) {
      error(`Export failed: ${err.message || err}`);
    }
  };

  const toggleSort = (field: 'date' | 'v_price' | 'margin') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Stats summaries
  const stats = useMemo(() => {
    let totalItems = products.length;
    let totalValue = products.reduce((acc, p) => acc + p.v_price, 0);
    let totalCost = products.reduce((acc, p) => acc + p.i_price, 0);
    let potentialMargin = totalValue - totalCost;
    return { totalItems, totalValue, totalCost, potentialMargin };
  }, [products]);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Dynamic Summary Cards */}
      {products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/20 p-4 backdrop-blur-md">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Total Products</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold text-zinc-100">{stats.totalItems}</span>
              <span className="text-xs text-zinc-550 font-light">items total</span>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/20 p-4 backdrop-blur-md">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Stock Value (VPrice)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold text-emerald-450">
                ₹{stats.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/20 p-4 backdrop-blur-md">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Cost Basis (IPrice)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold text-zinc-300">
                ₹{stats.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/20 p-4 backdrop-blur-md bg-gradient-to-br from-emerald-500/5 to-transparent">
            <span className="text-[10px] uppercase tracking-wider text-emerald-500/80 font-medium">Est. Net Margin</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold text-emerald-450">
                ₹{stats.potentialMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-emerald-500/60 font-light">
                ({stats.totalValue > 0 ? ((stats.potentialMargin / stats.totalValue) * 100).toFixed(0) : 0}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Panel */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 backdrop-blur-xl shadow-2xl p-6 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-medium text-zinc-100 tracking-wide flex items-center gap-2">
              <Layers className="w-4 h-4 text-zinc-450" />
              Inventory Catalog
            </h2>
            <p className="text-xs text-zinc-500 font-light mt-0.5">Manage, edit, and export stored items</p>
          </div>

          <div className="flex items-center gap-2">
            {userRole === 'Admin' && (
              <button
                onClick={handleOpenAuditLogs}
                className="flex items-center justify-center gap-2 px-3 py-2 border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/60 rounded-xl text-xs text-zinc-350 hover:text-white transition-all duration-300"
              >
                <History className="w-3.5 h-3.5 text-emerald-450" />
                Audit Logs
              </button>
            )}

            {products.length > 0 && (
              <button
                onClick={handleExportExcel}
                className="flex items-center justify-center gap-2 px-4 py-2 border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/60 rounded-xl text-xs font-medium text-zinc-300 hover:text-white transition-all duration-300 shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                Download Excel
              </button>
            )}
          </div>
        </div>

        {products.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-zinc-900/50 flex items-center justify-center border border-zinc-800/80 text-zinc-650 mb-6 shadow-inner">
              <Archive className="h-8 w-8 text-zinc-600 animate-pulse" />
            </div>
            <h3 className="text-zinc-200 font-medium tracking-wide text-sm">No items in inventory</h3>
            <p className="text-zinc-500 text-xs font-light max-w-xs mt-2 leading-relaxed">
              Pasted items or uploaded folders of product images will automatically appear in this table once processed.
            </p>
          </div>
        ) : (
          /* Table Layout */
          <div className="flex flex-col gap-4">
            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-550" />
                <input
                  type="text"
                  placeholder="Search SKU, Title, SubCat, Operator..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-800 bg-zinc-950/40 text-xs text-zinc-350 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-all"
                />
              </div>

              <div className="flex w-full sm:w-auto items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-zinc-550 shrink-0" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full sm:w-44 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950/40 text-xs text-zinc-350 focus:outline-none focus:border-zinc-700 transition-all"
                >
                  <option value="all">All Categories</option>
                  {categories.filter(c => c !== 'all').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-850 bg-zinc-950/40 text-zinc-400 font-light text-[10px] tracking-wider uppercase select-none">
                    <th className="py-3 px-4 font-medium w-16">Image</th>
                    <th className="py-3 px-4 font-medium">Serial</th>
                    <th className="py-3 px-4 font-medium">SKU</th>
                    <th className="py-3 px-4 font-medium">Product Info</th>
                    <th className="py-3 px-4 font-medium">Category / Sub</th>
                    <th className="py-3 px-4 font-medium text-right cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => toggleSort('v_price')}>
                      <div className="flex items-center justify-end gap-1.5">
                        Pricing
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th className="py-3 px-4 font-medium text-right cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => toggleSort('margin')}>
                      <div className="flex items-center justify-end gap-1.5">
                        Margin
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th className="py-3 px-4 font-medium text-right cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => toggleSort('date')}>
                      <div className="flex items-center justify-end gap-1.5">
                        Added
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th className="py-3 px-4 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60 text-xs text-zinc-350 font-light">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-zinc-500 font-light text-xs">
                        No matches found for your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const profit = p.v_price - p.i_price;
                      const profitMargin = p.v_price > 0 ? (profit / p.v_price) * 100 : 0;
                      const locked = isProductLocked(p.created_at);
                      
                      return (
                        <tr key={p.id} className="hover:bg-zinc-900/20 transition-colors">
                          <td className="py-2.5 px-4 w-16">
                            {p.image_url ? (
                              <div className="relative h-10 w-10 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 group/img">
                                <img src={p.image_url} alt="product" className="h-full w-full object-cover transition-transform group-hover/img:scale-110" />
                                <a 
                                  href={p.image_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity"
                                >
                                  <ExternalLink className="w-3 h-3 text-white" />
                                </a>
                              </div>
                            ) : (
                              <div className="h-10 w-10 rounded-lg border border-zinc-850 bg-zinc-950 flex items-center justify-center text-zinc-600">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-zinc-400">
                            {p.category.slice(0, 3).toUpperCase()}-{String(p.serial_number).padStart(3, '0')}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-zinc-300 select-all">
                            {p.sku}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <span className="font-medium text-zinc-200 block truncate">{p.title}</span>
                            <span className="text-[10px] text-zinc-550 block truncate font-light mt-0.5" title={p.description}>
                              {p.description || <span className="italic opacity-60">No description provided</span>}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 items-center">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-medium tracking-wide bg-zinc-900 border border-zinc-800 text-zinc-450 uppercase">
                                {p.category}
                              </span>
                              <span className="text-zinc-650 text-[10px] shrink-0">/</span>
                              <span className="text-zinc-500 text-[10px] truncate">
                                {p.sub_category}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="font-mono text-[11px]">
                              <span className="text-zinc-200 block" title="Value Price">
                                ₹{p.v_price.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-zinc-650 block font-light" title="Import Price">
                                cost: ₹{p.i_price.toFixed(2)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="font-mono text-[11px] inline-flex flex-col items-end">
                              <span className="text-emerald-450 flex items-center font-medium">
                                +₹{profit.toFixed(2)}
                                <ArrowUpRight className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                              </span>
                              <span className="text-[9px] text-emerald-500/70 block">
                                {profitMargin.toFixed(0)}% margin
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-[10px] text-zinc-500 font-mono">
                            <div>
                              {new Date(p.created_at).toLocaleDateString(undefined, { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </div>
                            <div className="text-[9px] opacity-60 mt-0.5">by {p.created_by || 'Operator'}</div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {locked ? (
                                <div className="h-7 w-7 rounded-lg border border-zinc-800 bg-zinc-900/10 flex items-center justify-center text-zinc-600 cursor-not-allowed group/lock" title="Previous inventory is locked. Click for approval info.">
                                  <Lock 
                                    className="w-3.5 h-3.5 hover:text-zinc-400 transition-colors" 
                                    onClick={() => error("Previous inventory is locked. Please request Admin approval.")} 
                                  />
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEdit(p)}
                                    className="h-7 w-7 rounded-lg border border-zinc-800 bg-zinc-900/20 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all"
                                    title="Edit product info"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => confirmDelete(p)}
                                    className="h-7 w-7 rounded-lg border border-zinc-800 bg-zinc-900/20 flex items-center justify-center text-rose-450 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
                                    title="Delete product"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {filteredProducts.length > 0 && (
              <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1 mt-1">
                <span>Showing {filteredProducts.length} of {products.length} products</span>
                {selectedCategory !== 'all' || search ? (
                  <button 
                    onClick={() => { setSearch(''); setSelectedCategory('all'); }} 
                    className="text-emerald-500 hover:text-emerald-400 font-light"
                  >
                    Clear active filters
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- EDIT MODAL OVERLAY --- */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-805 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative flex flex-col gap-4 text-zinc-100">
            <button 
              onClick={() => setEditingProduct(null)} 
              className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-base font-semibold tracking-wide">Edit Product Details</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">Modifying SKU: {editingProduct.sku}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="col-span-2">
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">Product Title</label>
                <input
                  type="text"
                  name="title"
                  value={editForm.title}
                  onChange={handleEditChange}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">Description</label>
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  className="w-full h-16 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">Vendor Price</label>
                <input
                  type="number"
                  name="v_price"
                  value={editForm.v_price}
                  onChange={handleEditChange}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">Selling Price</label>
                <input
                  type="number"
                  name="i_price"
                  value={editForm.i_price}
                  onChange={handleEditChange}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">Category</label>
                <input
                  type="text"
                  name="category"
                  value={editForm.category}
                  onChange={handleEditChange}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">Sub Category</label>
                <input
                  type="text"
                  name="sub_category"
                  value={editForm.sub_category}
                  onChange={handleEditChange}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">HSN Code</label>
                <input
                  type="text"
                  name="hsn_code"
                  value={editForm.hsn_code}
                  onChange={handleEditChange}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">SKU</label>
                <input
                  type="text"
                  name="sku"
                  value={editForm.sku}
                  onChange={handleEditChange}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button 
                onClick={() => setEditingProduct(null)} 
                disabled={isEditSaving}
                className="px-4 py-2 border border-zinc-800 bg-transparent hover:bg-zinc-900 text-xs font-medium rounded-lg text-zinc-350 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={isEditSaving}
                className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow"
              >
                {isEditSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL OVERLAY --- */}
      {deletingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-805 p-6 rounded-2xl w-full max-w-md shadow-2xl relative flex flex-col gap-4 text-zinc-100">
            <button 
              onClick={() => setDeletingProduct(null)} 
              className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-base font-semibold tracking-wide text-rose-450">Delete Product Record</h3>
              <p className="text-[11px] text-zinc-500 mt-1">Are you sure you want to permanently delete SKU: <span className="font-mono text-zinc-350">{deletingProduct.sku}</span>?</p>
            </div>

            <div className="flex gap-2 justify-end mt-2">
              <button 
                onClick={() => setDeletingProduct(null)} 
                disabled={isDeleteSaving}
                className="px-4 py-2 border border-zinc-800 bg-transparent hover:bg-zinc-900 text-xs font-medium rounded-lg text-zinc-350 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={isDeleteSaving}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow"
              >
                {isDeleteSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Record'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADMIN AUDIT LOGS MODAL OVERLAY --- */}
      {showAuditLogs && userRole === 'Admin' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-805 p-6 rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl relative flex flex-col gap-4 text-zinc-100 overflow-hidden">
            <button 
              onClick={() => setShowAuditLogs(false)} 
              className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-base font-semibold tracking-wide flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-450" />
                Operational Audit Trail
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">Complete record edit, delete, and insert history</p>
            </div>

            <div className="flex-1 overflow-y-auto mt-2 rounded-lg border border-zinc-900 bg-zinc-950/40 p-2">
              {isAuditLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  <span className="text-xs text-zinc-500 font-light">Loading audit database...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-20 text-xs text-zinc-550 font-light">
                  No audit logs recorded yet.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg border border-zinc-850/60 bg-zinc-950/20 text-[11px] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-semibold tracking-wider ${
                            log.action === 'INSERT' || log.action === 'INSERT_BULK'
                              ? 'bg-emerald-950 text-emerald-400'
                              : log.action === 'UPDATE'
                              ? 'bg-sky-950 text-sky-400'
                              : 'bg-rose-950 text-rose-450'
                          }`}>
                            {log.action}
                          </span>
                          <span className="font-mono text-zinc-450">ID: {log.record_id.slice(0, 8)}...</span>
                          <span className="text-zinc-500">•</span>
                          <span className="text-zinc-350 font-medium">{log.user_name} ({log.user_role})</span>
                        </div>
                        
                        {log.action === 'UPDATE' && (
                          <div className="text-[10px] text-zinc-450 font-light mt-1 pl-1 border-l border-zinc-800">
                            Changed Title: <span className="text-zinc-300 font-mono">"{log.previous_value?.title}"</span> → <span className="text-emerald-400 font-mono">"{log.updated_value?.title}"</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right text-[10px] text-zinc-500 font-mono shrink-0 flex flex-col items-start sm:items-end">
                        <span>{new Date(log.created_at).toLocaleString('en-IN')}</span>
                        <span className="text-[9px] opacity-75 mt-0.5">IP: {log.ip_address}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setShowAuditLogs(false)} 
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold rounded-lg transition-colors"
              >
                Close Audit Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
