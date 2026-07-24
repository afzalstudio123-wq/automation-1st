'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useToast } from './Toast';
import { addProduct, addBulkProduct } from '@/app/actions';
import { compressImage } from '@/lib/compression';
import { supabase } from '@/lib/supabase';
import { 
  ClipboardList, 
  Sparkles, 
  CornerDownLeft, 
  Loader2, 
  FolderOpen, 
  FileImage, 
  X, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  RotateCcw, 
  Clock 
} from 'lucide-react';

const MESSAGE_TEMPLATE = `Title: 
Desc: 
VPrice: 
IPrice: 
SKU: 
Cat: 
SubCat: `;

interface InventoryInputProps {
  userRole?: string;
  userName?: string;
}

interface QueueItem {
  id: string;
  file: File;
  compressedBlob?: Blob;
  status: 'idle' | 'compressing' | 'uploading' | 'inserting' | 'success' | 'failed';
  progress: number;
  error?: string;
  url?: string;
}

export default function InventoryInput({ userRole = 'Operator', userName = 'Operator' }: InventoryInputProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'folder'>('paste');
  const { success, error } = useToast();

  // --- TAB 1: WhatsApp Paste State ---
  const [text, setText] = useState('');
  const [isPasteLoading, setIsPasteLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertTemplate = () => {
    setText(MESSAGE_TEMPLATE);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(7, 7);
    }, 50);
  };

  const handlePasteSubmit = async () => {
    if (!text.trim()) {
      error('Please paste or type your inventory text first.');
      return;
    }

    setIsPasteLoading(true);
    try {
      const res = await addProduct(text, userRole, userName);
      if (res.success) {
        success(`Successfully added product: "${res.product?.title}" (SKU: ${res.product?.sku})`);
        setText('');
      } else {
        error(res.error || 'Failed to parse and insert the item.');
      }
    } catch (err: any) {
      error(err.message || 'An unexpected error occurred.');
    } finally {
      setIsPasteLoading(false);
    }
  };

  const handlePasteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handlePasteSubmit();
    }
  };

  // --- TAB 2: Folder Upload State ---
  const [commonInfo, setCommonInfo] = useState({
    title: '',
    description: '',
    v_price: '',
    i_price: '',
    sku_prefix: '',
    hsn_code: '',
    category: '',
    sub_category: ''
  });
  const [filesList, setFilesList] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  
  // Upload Queue tracking
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    completed: 0,
    currentFileName: '',
    estRemainingTime: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear URL previews to prevent memory leaks
  useEffect(() => {
    return () => {
      filePreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [filePreviews]);

  const handleCommonInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCommonInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    
    // Filter valid images only
    const imageFiles = selectedFiles.filter(file => {
      const type = file.type.toLowerCase();
      return type.includes('jpeg') || type.includes('jpg') || type.includes('png') || type.includes('webp');
    });

    if (imageFiles.length === 0) {
      error('No valid image files (JPG, JPEG, PNG, WEBP) found in the folder.');
      return;
    }

    if (imageFiles.length > 100) {
      error('Maximum 100 images are allowed in a single batch upload.');
      return;
    }

    // Set files list and create previews
    setFilesList(imageFiles);
    const previews = imageFiles.map(file => URL.createObjectURL(file));
    setFilePreviews(previews);
  };

  const removeFile = (index: number) => {
    setFilesList(prev => prev.filter((_, i) => i !== index));
    // Revoke and remove the preview URL
    URL.revokeObjectURL(filePreviews[index]);
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const resetFolderUpload = () => {
    setFilesList([]);
    setFilePreviews([]);
    setQueue([]);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBulkUpload = async (itemsToProcess: QueueItem[] = []) => {
    // 1. Validation check
    const { title, v_price, i_price, category, sub_category, sku_prefix } = commonInfo;
    if (!title || !v_price || !i_price || !category || !sub_category || !sku_prefix) {
      error('Please fill in all required common product fields.');
      return;
    }

    const vPriceNum = parseFloat(v_price);
    const iPriceNum = parseFloat(i_price);
    if (isNaN(vPriceNum) || isNaN(iPriceNum)) {
      error('Prices must be valid numbers.');
      return;
    }

    setIsUploading(true);

    let activeQueue: QueueItem[] = [];
    if (itemsToProcess.length > 0) {
      // Re-run mode for failed queue items
      activeQueue = queue.map(q => {
        const match = itemsToProcess.find(item => item.id === q.id);
        return match ? { ...q, status: 'idle' as const, error: undefined } : q;
      });
      setQueue(activeQueue);
    } else {
      // Initial queue setup
      activeQueue = filesList.map((file, idx) => ({
        id: Math.random().toString(36).substring(2, 9),
        file,
        status: 'idle',
        progress: 0
      }));
      setQueue(activeQueue);
    }

    const totalToUpload = activeQueue.filter(q => q.status === 'idle').length;
    let completedCount = 0;
    let successCount = activeQueue.filter(q => q.status === 'success').length;
    let failedCount = activeQueue.filter(q => q.status === 'failed').length;
    const batchStartTime = Date.now();

    setStats({
      total: activeQueue.length,
      success: successCount,
      failed: failedCount,
      completed: successCount + failedCount,
      currentFileName: '',
      estRemainingTime: 0
    });

    // Create worker pool with limit of 5 parallel uploads
    const queueToProcess = [...activeQueue];
    let activeWorkers = 0;
    const concurrencyLimit = 5;

    const processNext = async (): Promise<void> => {
      const item = queueToProcess.find(q => q.status === 'idle');
      if (!item) return;

      item.status = 'compressing';
      setQueue([...activeQueue]);
      setStats(prev => ({ ...prev, currentFileName: item.file.name }));

      try {
        // Step 1: Compress Image Client-Side
        const compressed = await compressImage(item.file, 0.75, 1200);
        item.status = 'uploading';
        setQueue([...activeQueue]);

        // Step 2: Upload to Supabase Storage
        const fileExt = item.file.name.split('.').pop() || 'webp';
        const uniqueId = Math.random().toString(36).substring(2, 10);
        const fileName = `${uniqueId}_${Date.now()}.${fileExt}`;
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const storagePath = `${category.trim().toLowerCase()}/${year}/${month}/${fileName}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('inventory')
          .upload(storagePath, compressed, {
            contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadErr) {
          throw uploadErr;
        }

        // Step 3: Get Public Image URL
        const { data: { publicUrl } } = supabase.storage
          .from('inventory')
          .getPublicUrl(storagePath);

        // Step 4: Insert Record into Database via Server Action
        item.status = 'inserting';
        setQueue([...activeQueue]);

        const dbPayload = {
          title,
          description: commonInfo.description,
          v_price: vPriceNum,
          i_price: iPriceNum,
          category,
          sub_category,
          sku_prefix,
          hsn_code: commonInfo.hsn_code,
          image_url: publicUrl
        };

        const dbRes = await addBulkProduct(dbPayload, userRole, userName);

        if (!dbRes.success) {
          throw new Error(dbRes.error || 'Failed to insert row in database.');
        }

        item.status = 'success';
        item.url = publicUrl;
        successCount++;
      } catch (err: any) {
        console.error(`Failed to process item: ${item.file.name}`, err);
        item.status = 'failed';
        item.error = err.message || 'Unknown processing error';
        failedCount++;
      } finally {
        completedCount++;
        item.progress = 100;
        
        // Calculate estimated remaining time
        const elapsed = (Date.now() - batchStartTime) / 1000;
        const avgTimePerItem = elapsed / completedCount;
        const remainingCount = totalToUpload - completedCount;
        const estRemainingTime = Math.round(avgTimePerItem * remainingCount);

        setQueue([...activeQueue]);
        setStats(prev => ({
          ...prev,
          success: successCount,
          failed: failedCount,
          completed: prev.completed + 1,
          estRemainingTime: estRemainingTime > 0 ? estRemainingTime : 0
        }));

        // Loop to next queue item
        await processNext();
      }
    };

    // Spawn workers up to concurrency limit
    const workerPromises: Promise<void>[] = [];
    for (let i = 0; i < Math.min(concurrencyLimit, totalToUpload); i++) {
      workerPromises.push(processNext());
    }

    await Promise.all(workerPromises);
    setIsUploading(false);

    if (failedCount === 0) {
      success(`Successfully uploaded and recorded all ${successCount} products!`);
      resetFolderUpload();
    } else {
      error(`Queue complete: ${successCount} succeeded, ${failedCount} failed.`);
    }
  };

  const handleRetryFailed = () => {
    const failedItems = queue.filter(q => q.status === 'failed');
    if (failedItems.length > 0) {
      handleBulkUpload(failedItems);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-zinc-805 bg-zinc-950/40 p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
      <div className="absolute -inset-px bg-gradient-to-r from-emerald-500/10 to-violet-500/10 rounded-2xl opacity-50 pointer-events-none" />

      {/* Tabs navigation */}
      <div className="flex border-b border-zinc-900 mb-6 gap-2 relative z-10">
        <button
          onClick={() => setActiveTab('paste')}
          className={`pb-2 px-3 text-xs tracking-wider font-medium transition-colors border-b ${
            activeTab === 'paste' 
              ? 'text-zinc-100 border-emerald-500' 
              : 'text-zinc-500 border-transparent hover:text-zinc-300'
          }`}
        >
          WhatsApp Paste
        </button>
        <button
          onClick={() => setActiveTab('folder')}
          className={`pb-2 px-3 text-xs tracking-wider font-medium transition-colors border-b ${
            activeTab === 'folder' 
              ? 'text-zinc-100 border-emerald-500' 
              : 'text-zinc-500 border-transparent hover:text-zinc-300'
          }`}
        >
          Bulk Folder Import
        </button>
      </div>

      <div className="relative z-10 flex flex-col gap-4">
        {/* --- TAB 1: WHATSAPP PASTE --- */}
        {activeTab === 'paste' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-medium text-zinc-100 tracking-wide">Import WhatsApp Message</h2>
                  <p className="text-xs text-zinc-550 font-light">Paste raw template details below</p>
                </div>
              </div>
              <button
                onClick={handleInsertTemplate}
                type="button"
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-light text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 bg-zinc-900/30 hover:bg-zinc-900/60 transition-all duration-200"
              >
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Insert Template
              </button>
            </div>

            <div className="relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handlePasteKeyDown}
                placeholder={`Example WhatsApp message:\n\nTitle: Wireless Headphones\nDesc: Active noise cancelling over-ear headphones\nVPrice: 4500\nIPrice: 2800\nSKU: WH-NC700-BLK\nCat: Electronics\nSubCat: Audio`}
                disabled={isPasteLoading}
                className="w-full h-64 px-4 py-3 rounded-xl border border-zinc-800/80 bg-zinc-950/50 text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 text-sm font-mono tracking-wide leading-relaxed resize-none transition-all duration-300 shadow-inner"
              />
              {text && (
                <button
                  onClick={() => setText('')}
                  className="absolute right-3 top-3 text-xs text-zinc-550 hover:text-zinc-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-1.5 text-xs text-zinc-550 font-light">
                <span className="px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-[10px] font-mono text-zinc-450">Ctrl</span>
                <span>+</span>
                <span className="px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-[10px] font-mono text-zinc-450">Enter</span>
                <span className="ml-1 text-zinc-650">to submit</span>
              </div>

              <button
                onClick={handlePasteSubmit}
                disabled={isPasteLoading || !text.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 text-zinc-900 bg-zinc-100 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
              >
                {isPasteLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <span>Add Item</span>
                    <CornerDownLeft className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* --- TAB 2: BULK FOLDER IMPORT --- */}
        {activeTab === 'folder' && (
          <div className="flex flex-col gap-5">
            {/* Common Info Form */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl border border-zinc-900 bg-zinc-950/20">
              <div className="col-span-2">
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">Product Title *</label>
                <input
                  type="text"
                  name="title"
                  value={commonInfo.title}
                  onChange={handleCommonInfoChange}
                  disabled={isUploading}
                  placeholder="e.g. Linen Slim Fit Shirt"
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">Product Description</label>
                <textarea
                  name="description"
                  value={commonInfo.description}
                  onChange={handleCommonInfoChange}
                  disabled={isUploading}
                  placeholder="Details of material, fits, and features..."
                  className="w-full h-16 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">Vendor Price *</label>
                <input
                  type="text"
                  name="v_price"
                  value={commonInfo.v_price}
                  onChange={handleCommonInfoChange}
                  disabled={isUploading}
                  placeholder="Cost Price (₹)"
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">Selling Price *</label>
                <input
                  type="text"
                  name="i_price"
                  value={commonInfo.i_price}
                  onChange={handleCommonInfoChange}
                  disabled={isUploading}
                  placeholder="Sales Price (₹)"
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">SKU Prefix *</label>
                <input
                  type="text"
                  name="sku_prefix"
                  value={commonInfo.sku_prefix}
                  onChange={handleCommonInfoChange}
                  disabled={isUploading}
                  placeholder="e.g. LSH"
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">HSN Code</label>
                <input
                  type="text"
                  name="hsn_code"
                  value={commonInfo.hsn_code}
                  onChange={handleCommonInfoChange}
                  disabled={isUploading}
                  placeholder="HSN Code number"
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">Category *</label>
                <input
                  type="text"
                  name="category"
                  value={commonInfo.category}
                  onChange={handleCommonInfoChange}
                  disabled={isUploading}
                  placeholder="e.g. Shirts"
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">Sub Category *</label>
                <input
                  type="text"
                  name="sub_category"
                  value={commonInfo.sub_category}
                  onChange={handleCommonInfoChange}
                  disabled={isUploading}
                  placeholder="e.g. Cotton"
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>
            </div>

            {/* Folder Select Drop Zone */}
            {filesList.length === 0 && queue.length === 0 && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl py-8 px-4 flex flex-col items-center justify-center gap-3 cursor-pointer bg-zinc-950/20 hover:bg-zinc-950/40 transition-all duration-300"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFolderSelect}
                  className="hidden"
                  // @ts-ignore
                  webkitdirectory=""
                  directory=""
                  multiple
                />
                <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-450">
                  <FolderOpen className="w-5 h-5 text-emerald-450" />
                </div>
                <div className="text-center">
                  <span className="text-xs text-zinc-300 block font-medium">Select Product Image Folder</span>
                  <span className="text-[10px] text-zinc-550 font-light mt-1 block">Supports JPG, JPEG, PNG, WEBP (Max 100 images)</span>
                </div>
              </div>
            )}

            {/* Files Preview Grid */}
            {filesList.length > 0 && !isUploading && queue.length === 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="text-zinc-400 font-light">{filesList.length} images selected</span>
                  <button onClick={resetFolderUpload} className="text-rose-450 hover:text-rose-400 transition-colors">Clear all</button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1.5 rounded-xl border border-zinc-900 bg-zinc-950/30">
                  {filePreviews.map((src, idx) => (
                    <div key={src} className="relative aspect-square rounded-lg border border-zinc-800/80 overflow-hidden group/item">
                      <img src={src} alt="preview" className="h-full w-full object-cover" />
                      <button 
                        onClick={() => removeFile(idx)}
                        className="absolute top-1 right-1 h-5 w-5 bg-black/70 hover:bg-black text-white rounded-full flex items-center justify-center hover:scale-105 transition-all opacity-0 group-hover/item:opacity-100 duration-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleBulkUpload()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-xl text-xs transition-all shadow-[0_4px_20px_-4px_rgba(16,185,129,0.2)]"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload & Create {filesList.length} Records
                </button>
              </div>
            )}

            {/* Uploading Progress System */}
            {(isUploading || queue.length > 0) && (
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/50 flex flex-col gap-4">
                {/* Stats Header */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-zinc-200">
                      {isUploading ? 'Uploading & processing...' : 'Upload completed'}
                    </span>
                    {isUploading && (
                      <span className="text-[10px] text-zinc-550 font-light font-mono truncate max-w-xs">
                        Current: {stats.currentFileName}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-emerald-400 font-semibold text-sm">
                    {Math.round((stats.completed / stats.total) * 100)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden relative border border-zinc-850/60">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                    style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                  />
                </div>

                {/* Counter Stats Grid */}
                <div className="grid grid-cols-3 gap-2 text-center border-t border-zinc-900 pt-3">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-medium block">Success</span>
                    <span className="text-sm font-semibold text-emerald-400 font-mono mt-0.5 block">{stats.success}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-medium block">Failed</span>
                    <span className="text-sm font-semibold text-rose-400 font-mono mt-0.5 block">{stats.failed}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-medium block">Total Queue</span>
                    <span className="text-sm font-semibold text-zinc-350 font-mono mt-0.5 block">{stats.completed} / {stats.total}</span>
                  </div>
                </div>

                {/* Time Indicator */}
                {isUploading && stats.estRemainingTime > 0 && (
                  <div className="flex items-center gap-1.5 justify-center text-[10px] text-zinc-500 font-light border-t border-zinc-900 pt-3">
                    <Clock className="w-3.5 h-3.5 text-zinc-550" />
                    <span>Est. Time Remaining: {stats.estRemainingTime}s</span>
                  </div>
                )}

                {/* Errors list for failed uploads */}
                {!isUploading && stats.failed > 0 && (
                  <div className="border-t border-zinc-900 pt-3 flex flex-col gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-rose-450">
                      <AlertCircle className="w-4 h-4" />
                      <span>{stats.failed} uploads failed. You can retry them below.</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={handleRetryFailed}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10 text-rose-300 font-semibold rounded-lg text-xs transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Retry Failed ({stats.failed})
                      </button>
                      <button
                        onClick={resetFolderUpload}
                        className="py-2 px-3 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/40 text-zinc-400 rounded-lg text-xs transition-all"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* Completion success panel */}
                {!isUploading && stats.failed === 0 && (
                  <div className="border-t border-zinc-900 pt-3 flex flex-col gap-2.5 items-center text-center">
                    <div className="h-8 w-8 bg-emerald-500/10 rounded-full border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs text-zinc-400 font-light">All records successfully inserted!</span>
                    <button 
                      onClick={resetFolderUpload}
                      className="text-[10px] text-emerald-500 hover:text-emerald-400 font-medium"
                    >
                      Upload New Batch
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
