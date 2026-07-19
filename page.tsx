import InventoryInput from "@/components/InventoryInput";
import InventoryTable from "@/components/InventoryTable";
import { getProducts } from "@/app/actions";
import { Package, User } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const products = await getProducts();

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-zinc-950">
      {/* Premium Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[55%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[65%] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />

      {/* Header Bar */}
      <header className="relative border-b border-zinc-900 bg-zinc-950/40 backdrop-blur-md z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
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

          <div className="flex items-center gap-4 text-xs font-light text-zinc-400">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Database Online
            </div>
            <div className="h-4 w-px bg-zinc-850" />
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-zinc-400" />
              </div>
              <span className="hidden sm:inline text-zinc-400 text-xs">Admin Workspace</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 flex flex-col gap-8 z-10 relative">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-medium text-zinc-100 tracking-wide">Dashboard</h1>
          <p className="text-zinc-500 text-xs font-light max-w-xl leading-relaxed">
            Personal high-speed catalog management tool. Paste raw WhatsApp messages to automatically extract and register inventory products.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left panel: Input form */}
          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <InventoryInput />
          </div>

          {/* Right panel: Table list & stats */}
          <div className="lg:col-span-8">
            <InventoryTable products={products} />
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
    </div>
  );
}
