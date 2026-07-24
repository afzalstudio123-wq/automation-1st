'use client';

import React, { useState } from 'react';
import InventoryInput from "@/components/InventoryInput";
import InventoryTable from "@/components/InventoryTable";
import { Product } from "@/app/actions";
import { useToast } from "@/components/Toast";
import { Package, User, Shield, KeyRound, X, RefreshCw } from "lucide-react";
import { useRouter } from 'next/navigation';

interface DashboardShellProps {
  initialProducts: Product[];
}

export default function DashboardShell({ initialProducts }: DashboardShellProps) {
  const [userRole, setUserRole] = useState<'Operator' | 'Admin'>('Operator');
  const [userName, setUserName] = useState('Operator Account');
  
  // Admin Unlock passcode states
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const { success, error } = useToast();
  const router = useRouter();

  const handleRoleToggle = (targetRole: 'Operator' | 'Admin') => {
    if (targetRole === 'Admin') {
      if (userRole === 'Admin') return;
      setShowAdminModal(true);
    } else {
      setUserRole('Operator');
      setUserName('Operator Account');
      success('Switched workspace role to Data Entry Operator.');
    }
  };

  const handleVerifyPin = () => {
    if (adminPin === '1234') {
      setUserRole('Admin');
      setUserName('Admin Workspace');
      setAdminPin('');
      setShowAdminModal(false);
      success('Admin override privileges unlocked.');
    } else {
      error('Incorrect Admin verification pin.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-zinc-950">
      {/* Ambient background blur glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[55%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[65%] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />

      {/* Header Panel */}
      <header className="relative border-b border-zinc-900 bg-zinc-950/40 backdrop-blur-md z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo brand */}
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-md">
              <div className="h-full w-full rounded-[6px] bg-zinc-950 flex items-center justify-center">
                <Package className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold tracking-wider text-xs text-zinc-150 uppercase">Aura</span>
              <span className="text-[9px] text-zinc-550 font-light leading-none">INVENTORY v2.0</span>
            </div>
          </div>

          {/* Interactive controls */}
          <div className="flex items-center gap-4 text-xs font-light">
            {/* Sync connection status */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Supabase Connected
            </div>

            {/* Refresh catalog button */}
            <button
              onClick={() => { router.refresh(); success('Inventory catalog synchronized with Database.'); }}
              className="h-7 w-7 rounded-lg border border-zinc-800 bg-zinc-900/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all hover:bg-zinc-900"
              title="Sync manual reload"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-zinc-850" />

            {/* Role selection widget */}
            <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 p-0.5 bg-zinc-950/60">
              <button
                onClick={() => handleRoleToggle('Operator')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  userRole === 'Operator'
                    ? 'bg-zinc-900 border border-zinc-800 text-zinc-200 font-medium shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-350'
                }`}
              >
                <User className="w-3 h-3" />
                Operator
              </button>
              <button
                onClick={() => handleRoleToggle('Admin')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  userRole === 'Admin'
                    ? 'bg-zinc-900 border border-emerald-500/20 text-emerald-450 font-medium shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-350'
                }`}
              >
                <Shield className="w-3 h-3" />
                Admin
              </button>
            </div>

            {/* Current user name edit */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-28 px-2.5 py-1 rounded-lg border border-zinc-800/80 bg-zinc-900/30 text-[11px] text-zinc-300 focus:outline-none focus:border-zinc-700"
                title="Enter operator name"
              />
            </div>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 flex flex-col gap-8 z-10 relative">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-medium text-zinc-100 tracking-wide">
              {userRole === 'Admin' ? 'Administrator Console' : 'Operator Dashboard'}
            </h1>
            <p className="text-zinc-500 text-xs font-light max-w-xl leading-relaxed">
              {userRole === 'Admin' 
                ? 'Authorized override access: Unlock previous days\' items, edit historical catalogs, and view system audit logs.'
                : 'Personal stock registrar space. Fill in product details, upload product image folders, or paste raw WhatsApp templates.'
              }
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Panel: Input forms */}
          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <InventoryInput userRole={userRole} userName={userName} />
          </div>

          {/* Right Panel: Data Catalog Table & stats summaries */}
          <div className="lg:col-span-8">
            <InventoryTable products={initialProducts} userRole={userRole} userName={userName} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/40 backdrop-blur-md py-5 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-zinc-600 font-light">
          <div>
            <span>Personal Inventory Suite</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Next.js 15 App Router</span>
            <span>•</span>
            <span>Tailwind CSS v4</span>
            <span>•</span>
            <span>Supabase SDK</span>
          </div>
        </div>
      </footer>

      {/* --- ADMIN PASSCODE MODAL OVERLAY --- */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-805 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative flex flex-col gap-4 text-zinc-100">
            <button 
              onClick={() => { setShowAdminModal(false); setAdminPin(''); }} 
              className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center text-center gap-2">
              <div className="h-10 w-10 bg-emerald-500/10 rounded-full border border-emerald-500/20 flex items-center justify-center text-emerald-450">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold tracking-wide mt-1">Unlock Admin Controls</h3>
              <p className="text-[11px] text-zinc-500">Please enter your passcode to obtain full override database privileges. (Passcode: 1234)</p>
            </div>

            <div>
              <input
                type="password"
                placeholder="••••"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPin()}
                maxLength={4}
                className="w-full text-center py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-base font-semibold tracking-[0.5em] text-zinc-100 focus:outline-none focus:border-zinc-700"
              />
            </div>

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => { setShowAdminModal(false); setAdminPin(''); }}
                className="flex-1 py-2 border border-zinc-800 hover:bg-zinc-900 rounded-lg text-xs font-semibold text-zinc-400"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyPin}
                className="flex-1 py-2 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg text-xs font-semibold"
              >
                Verify Passcode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
