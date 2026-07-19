'use client';

import React, { useState, useMemo } from 'react';
import { Product } from '@/app/actions';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';
import { 
  Download, 
  Search, 
  Filter, 
  Archive, 
  TrendingUp, 
  ArrowUpDown, 
  Layers,
  ArrowUpRight
} from 'lucide-react';

interface InventoryTableProps {
  products: Product[];
}

export default function InventoryTable({ products }: InventoryTableProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'v_price' | 'margin'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { success, error } = useToast();

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
          p.sub_category.toLowerCase().includes(search.toLowerCase());
        
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
        'Valuation Price (VPrice)': p.v_price,
        'Import Price (IPrice)': p.i_price,
        'Profit / Margin': p.v_price - p.i_price,
        'Category': p.category,
        'Sub Category': p.sub_category,
        'Date Created': new Date(p.created_at).toLocaleString(),
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products Inventory');

      // Autofit columns roughly
      const colsWidth = [
        { wch: 10 }, // Serial No
        { wch: 18 }, // SKU
        { wch: 25 }, // Title
        { wch: 35 }, // Description
        { wch: 15 }, // VPrice
        { wch: 15 }, // IPrice
        { wch: 15 }, // Profit
        { wch: 15 }, // Category
        { wch: 15 }, // SubCategory
        { wch: 22 }, // Date
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
              <span className="text-xs text-zinc-500 font-light">items total</span>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/20 p-4 backdrop-blur-md">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Stock Value (VPrice)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold text-emerald-400">
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
              <span className="text-2xl font-semibold text-emerald-400">
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
              <Layers className="w-4 h-4 text-zinc-400" />
              Inventory Catalog
            </h2>
            <p className="text-xs text-zinc-500 font-light mt-0.5">Manage, filter, and export stored items</p>
          </div>

          {products.length > 0 && (
            <button
              onClick={handleExportExcel}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900/60 transition-all duration-300 shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              Download Excel
            </button>
          )}
        </div>

        {products.length === 0 ? (
          /* Premium Empty State */
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-zinc-900/50 flex items-center justify-center border border-zinc-800/80 text-zinc-650 mb-6 shadow-inner">
              <Archive className="h-8 w-8 text-zinc-600 animate-pulse" />
            </div>
            <h3 className="text-zinc-200 font-medium tracking-wide text-sm">No items in inventory</h3>
            <p className="text-zinc-500 text-xs font-light max-w-xs mt-2 leading-relaxed">
              Pasted products from WhatsApp messages will automatically appear in this database table once processed.
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
                  placeholder="Search by Title, SKU, SubCat..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-800 bg-zinc-950/40 text-xs text-zinc-350 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-all"
                />
              </div>

              <div className="flex w-full sm:w-auto items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60 text-xs text-zinc-350 font-light">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500 font-light text-xs">
                        No matches found for your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const profit = p.v_price - p.i_price;
                      const profitMargin = p.v_price > 0 ? (profit / p.v_price) * 100 : 0;
                      
                      return (
                        <tr key={p.id} className="hover:bg-zinc-900/20 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-zinc-400">
                            {p.category.slice(0, 3).toUpperCase()}-{String(p.serial_number).padStart(3, '0')}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-zinc-300 select-all">
                            {p.sku}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <span className="font-medium text-zinc-200 block truncate">{p.title}</span>
                            <span className="text-[10px] text-zinc-550 block truncate font-light mt-0.5" title={p.description}>
                              {p.description}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 items-center">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-medium tracking-wide bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase">
                                {p.category}
                              </span>
                              <span className="text-zinc-600 text-[10px] shrink-0">/</span>
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
                              <span className="text-emerald-400 flex items-center font-medium">
                                +₹{profit.toFixed(2)}
                                <ArrowUpRight className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                              </span>
                              <span className="text-[9px] text-emerald-500/70 block">
                                {profitMargin.toFixed(0)}% margin
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-[10px] text-zinc-500 font-mono">
                            {new Date(p.created_at).toLocaleDateString(undefined, { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
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
    </div>
  );
}
