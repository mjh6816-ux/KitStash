"use client";

import { Search } from "lucide-react";

export function SearchButton({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("open-kitstash-search"))}
      className={className}
      title="Global search (kits, parts, paints)"
    >
      {children || (
        <>
          <Search className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Search</span>
        </>
      )}
    </button>
  );
}

export function SearchButtonMobile({ className = "" }: { className?: string }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("open-kitstash-search"))}
      className={`flex flex-col items-center gap-1 text-zinc-400 hover:text-white active:text-amber-400 ${className}`}
    >
      <Search className="h-5 w-5" />
      <span>Search</span>
    </button>
  );
}
