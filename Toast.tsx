'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove after 4.5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const success = useCallback((message: string) => toast(message, 'success'), [toast]);
  const error = useCallback((message: string) => toast(message, 'error'), [toast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full sm:w-96 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl backdrop-blur-md border shadow-2xl transition-all duration-300 transform translate-y-0 scale-100 ${
              t.type === 'success'
                ? 'bg-zinc-950/80 border-emerald-500/20 text-emerald-50'
                : t.type === 'error'
                ? 'bg-zinc-950/80 border-rose-500/20 text-rose-50'
                : 'bg-zinc-950/80 border-zinc-700/20 text-zinc-50'
            }`}
            style={{
              boxShadow: t.type === 'success' 
                ? '0 10px 30px -10px rgba(16, 185, 129, 0.1), 0 1px 1px 0 rgba(255, 255, 255, 0.05) inset' 
                : t.type === 'error'
                ? '0 10px 30px -10px rgba(244, 63, 94, 0.1), 0 1px 1px 0 rgba(255, 255, 255, 0.05) inset'
                : '0 10px 30px -10px rgba(0, 0, 0, 0.3)'
            }}
          >
            {t.type === 'success' && (
              <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            )}
            {t.type === 'error' && (
              <div className="w-5 h-5 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0 mt-0.5 border border-rose-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              </div>
            )}
            
            <div className="flex-1 text-sm font-light tracking-wide leading-relaxed">
              <span className="font-semibold block mb-0.5">
                {t.type === 'success' ? 'Success' : t.type === 'error' ? 'Validation Error' : 'Notification'}
              </span>
              <p className="opacity-90 whitespace-pre-line">{t.message}</p>
            </div>
            
            <button
              onClick={() => removeToast(t.id)}
              className="text-zinc-500 hover:text-zinc-350 transition-colors shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
