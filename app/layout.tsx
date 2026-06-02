import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { LayoutDashboard, Package, Wrench, BarChart3 } from "lucide-react";
import GlobalSearch from "@/components/GlobalSearch";
import { SearchButton, SearchButtonMobile } from "@/components/SearchButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "KitStash",
    template: "%s | KitStash",
  },
  description: "Scale model inventory & project tracker for the workbench. Track kits, aftermarket parts, paints, and build allocations with automatic stock deduction.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-200">
        {/* Top Navigation (Desktop) */}
        <nav className="hidden border-b border-zinc-800 bg-zinc-950/95 backdrop-blur md:block">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
            <div className="flex items-center gap-8">
              <a href="/" className="text-xl font-semibold tracking-tighter text-white">KitStash</a>
              <div className="flex items-center gap-2 text-sm">
                <a href="/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </a>
                <a href="/inventory" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition">
                  <Package className="h-4 w-4" /> Inventory
                </a>
                <a href="/projects" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition">
                  <Wrench className="h-4 w-4" /> Projects
                </a>
                <a href="/reports" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition">
                  <BarChart3 className="h-4 w-4" /> Reports
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <SearchButton className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-zinc-400 hover:text-white hover:border-zinc-700 active:text-amber-400 transition" />
              Workbench
            </div>
          </div>
        </nav>

        <main className="flex-1 pb-16 md:pb-0">
          {children}
        </main>

        {/* Bottom Navigation (Mobile - Workbench friendly) */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden">
          <div className="flex h-16 items-center justify-around text-[10px] font-medium">
            <a href="/dashboard" className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white active:text-amber-400">
              <LayoutDashboard className="h-5 w-5" />
              <span>Dashboard</span>
            </a>
            <a href="/inventory" className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white active:text-amber-400">
              <Package className="h-5 w-5" />
              <span>Inventory</span>
            </a>
            <a href="/projects" className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white active:text-amber-400">
              <Wrench className="h-5 w-5" />
              <span>Projects</span>
            </a>
            <a href="/reports" className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white active:text-amber-400">
              <BarChart3 className="h-5 w-5" />
              <span>Reports</span>
            </a>
            <SearchButtonMobile />
          </div>
        </nav>

        <Toaster position="top-center" richColors closeButton />
        {/* Global search modal (opens via CustomEvent from nav buttons) */}
        <GlobalSearch />
      </body>
    </html>
  );
}
