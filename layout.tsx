import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aura Inventory — Personal Inventory Manager",
  description: "A premium, minimalist inventory management system for scanning WhatsApp catalogs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className={`${inter.className} min-h-full flex flex-col bg-zinc-950 text-zinc-100 selection:bg-emerald-500/20 selection:text-emerald-300`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}

