"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Package, Wrench, BarChart3 } from "lucide-react";
import { SearchButton, SearchButtonMobile } from "@/components/SearchButton";

export function TopNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="hidden border-b border-zinc-800 bg-zinc-950/95 backdrop-blur md:block">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-semibold tracking-tighter text-white">KitStash</Link>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
            <Link href="/inventory" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition">
              <Package className="h-4 w-4" /> Inventory
            </Link>
            <Link href="/projects" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition">
              <Wrench className="h-4 w-4" /> Projects
            </Link>
            <Link href="/reports" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition">
              <BarChart3 className="h-4 w-4" /> Reports
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <SearchButton className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-zinc-400 hover:text-white hover:border-zinc-700 active:text-amber-400 transition" />
          Workbench
        </div>
      </div>
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden">
      <div className="flex h-16 items-center justify-around text-[10px] font-medium">
        <Link href="/dashboard" className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white active:text-amber-400">
          <LayoutDashboard className="h-5 w-5" />
          <span>Dashboard</span>
        </Link>
        <Link href="/inventory" className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white active:text-amber-400">
          <Package className="h-5 w-5" />
          <span>Inventory</span>
        </Link>
        <Link href="/projects" className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white active:text-amber-400">
          <Wrench className="h-5 w-5" />
          <span>Projects</span>
        </Link>
        <Link href="/reports" className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white active:text-amber-400">
          <BarChart3 className="h-5 w-5" />
          <span>Reports</span>
        </Link>
        <SearchButtonMobile />
      </div>
    </nav>
  );
}

export function GlobalSearchWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return <>{children}</>;
}
