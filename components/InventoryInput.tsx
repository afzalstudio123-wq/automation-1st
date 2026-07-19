'use client';

import React, { useState, useRef } from 'react';
import { useToast } from './Toast';
import { addProduct } from '@/app/actions';
import { ClipboardList, Sparkles, CornerDownLeft, Loader2, RefreshCw } from 'lucide-react';

const MESSAGE_TEMPLATE = `Title: 
Desc: 
VPrice: 
IPrice: 
SKU: 
Cat: 
SubCat: `;

export default function InventoryInput() {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { success, error } = useToast();

  const handleInsertTemplate = () => {
    setText(MESSAGE_TEMPLATE);
    setTimeout(() => {
      textareaRef.current?.focus();
      // Set cursor at the end of "Title: "
      textareaRef.current?.setSelectionRange(7, 7);
    }, 50);
  };

  const handleSubmit = async () => {
    if (!text.trim()) {
      error('Please paste or type your inventory text first.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await addProduct(text);
      if (res.success) {
        success(`Successfully added product: "${res.product?.title}" (SKU: ${res.product?.sku})`);
        setText(''); // Clear on success
      } else {
        error(res.error || 'Failed to parse and insert the item.');
      }
    } catch (err: any) {
      error(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
      {/* Background glow lines */}
      <div className="absolute -inset-px bg-gradient-to-r from-emerald-500/10 to-violet-500/10 rounded-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
              <ClipboardList className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-medium text-zinc-100 tracking-wide">Import Inventory</h2>
              <p className="text-xs text-zinc-500 font-light">Paste WhatsApp format items below</p>
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
            onKeyDown={handleKeyDown}
            placeholder={`Example WhatsApp message:\n\nTitle: Wireless Headphones\nDesc: Active noise cancelling over-ear headphones\nVPrice: 4500\nIPrice: 2800\nSKU: WH-NC700-BLK\nCat: Electronics\nSubCat: Audio`}
            disabled={isLoading}
            className="w-full h-64 px-4 py-3 rounded-xl border border-zinc-800/80 bg-zinc-950/50 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 text-sm font-mono tracking-wide leading-relaxed resize-none transition-all duration-300 shadow-inner"
          />
          {text && (
            <button
              onClick={() => setText('')}
              className="absolute right-3 top-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-light">
            <span className="px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-[10px] font-mono text-zinc-400">Ctrl</span>
            <span>+</span>
            <span className="px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-[10px] font-mono text-zinc-400">Enter</span>
            <span className="ml-1 text-zinc-600">to submit directly</span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading || !text.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 text-zinc-900 bg-zinc-100 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_20px_-4px_rgba(255,255,255,0.12)] hover:shadow-[0_4px_25px_-2px_rgba(255,255,255,0.18)]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <span>Add to Inventory</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
