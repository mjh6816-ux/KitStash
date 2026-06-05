"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllParts, getAllKits, getAllPaints } from "@/app/inventory/actions";
import { Search, X, Package, Wrench, Droplet } from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";

/* eslint-disable @typescript-eslint/no-explicit-any -- search results from inventory fetches */

/**
 * GlobalSearch
 * - Renders the search modal (always mounted via layout).
 * - Opens when a 'open-kitstash-search' CustomEvent is dispatched from nav triggers.
 * - Loads full inventory via existing getAll* actions (reuses joins + defensive fallbacks).
 * - Client-side filter across name/notes + manufacturer/brand/kit context.
 * - Grouped results. "View" pushes /inventory?tab=...&view=ID (reuses the deep-link machinery).
 */
export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [parts, setParts] = useState<any[]>([]);
  const [kits, setKits] = useState<any[]>([]);
  const [paints, setPaints] = useState<any[]>([]);

  // Internal barcode scanning mode for quick kit lookup (works from any page)
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);

  // Listen for global open event (dispatched from layout nav buttons)
  // Also supports { detail: { barcode: "..." } } from scanner for quick kit lookup
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent;
      setOpen(true);
      if (custom.detail?.barcode) {
        // Barcode lookup mode: immediately search by the exact barcode
        setQuery(custom.detail.barcode);
      } else {
        setQuery("");
      }
    };
    window.addEventListener("open-kitstash-search", handler as EventListener);
    return () => window.removeEventListener("open-kitstash-search", handler as EventListener);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Load data the first time the modal is opened (small data set, cached for the session of the modal)
  useEffect(() => {
    if (!open) return;
    if (parts.length > 0 || kits.length > 0 || paints.length > 0) return; // already loaded

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [p, k, pa] = await Promise.all([
          getAllParts().catch(() => []),
          getAllKits().catch(() => []),
          getAllPaints().catch(() => []),
        ]);
        if (!cancelled) {
          setParts(p || []);
          setKits(k || []);
          setPaints(pa || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, parts.length, kits.length, paints.length]);

  // Debounced query (simple)
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim().toLowerCase()), 180);
    return () => clearTimeout(t);
  }, [query]);

  const q = debouncedQ;

  const filteredKits = useMemo(() => {
    if (!q) return kits.slice(0, 8);
    const matches = kits.filter((k: any) => {
      const name = (k.name || "").toLowerCase();
      const notes = (k.notes || "").toLowerCase();
      const mfr = (k.manufacturer?.name || "").toLowerCase();
      const scale = (k.scale?.name || "").toLowerCase();
      const barcode = (k.barcode || "").toLowerCase();
      return (
        name.includes(q) ||
        notes.includes(q) ||
        mfr.includes(q) ||
        scale.includes(q) ||
        barcode.includes(q)
      );
    });

    // Prioritize exact barcode matches for the "quick shop lookup" use case
    matches.sort((a: any, b: any) => {
      const aExact = (a.barcode || "").toLowerCase() === q;
      const bExact = (b.barcode || "").toLowerCase() === q;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return 0;
    });

    return matches.slice(0, 8);
  }, [kits, q]);

  const filteredParts = useMemo(() => {
    if (!q) return parts.slice(0, 8);
    return parts.filter((p: any) => {
      const name = (p.name || "").toLowerCase();
      const notes = (p.notes || "").toLowerCase();
      const mfr = (p.manufacturer?.name || "").toLowerCase();
      const kitName = (p.designed_for_kit?.name || "").toLowerCase();
      return name.includes(q) || notes.includes(q) || mfr.includes(q) || kitName.includes(q);
    }).slice(0, 8);
  }, [parts, q]);

  const filteredPaints = useMemo(() => {
    if (!q) return paints.slice(0, 8);
    return paints.filter((p: any) => {
      const name = (p.color_name || "").toLowerCase();
      const notes = (p.notes || "").toLowerCase();
      const brand = (p.paint_brand?.name || p.brand || "").toLowerCase();
      const kitName = (p.designed_for_kit?.name || "").toLowerCase();
      return name.includes(q) || notes.includes(q) || brand.includes(q) || kitName.includes(q);
    }).slice(0, 8);
  }, [paints, q]);

  const totalMatches = filteredKits.length + filteredParts.length + filteredPaints.length;

  const close = () => {
    setOpen(false);
    // small delay so the router push settles before clearing query
    setTimeout(() => setQuery(""), 120);
  };

  const goTo = (tab: "kits" | "parts" | "paints", id: string) => {
    router.push(`/inventory?tab=${tab}&view=${id}`);
    close();
  };

  const computeAvailable = (item: any) => {
    const owned = item.quantity_owned || 0;
    const alloc = item.quantity_allocated || 0;
    const used = item.quantity_used || 0;
    return Math.max(0, owned - alloc - used);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/70 p-3 pt-16 md:pt-20" onClick={close}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <Search className="h-5 w-5 text-zinc-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search kits, parts, paints (name, notes, brand, designed-for kit...)"
            className="flex-1 bg-transparent text-lg placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            onClick={() => {
              setIsScanningBarcode(true);
            }}
            className="text-xs px-2.5 py-1 rounded border border-zinc-700 hover:border-amber-500/60 flex items-center gap-1"
            title="Scan barcode to quickly check if you own this kit"
          >
            📷 Scan
          </button>
          <button onClick={close} className="text-zinc-400 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Barcode scanning UI (quick stock lookup mode) */}
        {isScanningBarcode && (
          <div className="p-4 border-b border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-medium">Scan kit barcode for stock lookup</div>
              <button onClick={() => setIsScanningBarcode(false)} className="text-xs text-zinc-400 hover:text-white">Cancel</button>
            </div>
            <BarcodeScanner
              onDetected={(code) => {
                setQuery(code);
                setIsScanningBarcode(false);
              }}
              stopOnFirstDetection={true}
            />
          </div>
        )}

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2 text-sm">
          {loading && (
            <div className="p-6 text-center text-zinc-400">Loading inventory…</div>
          )}

          {!loading && q && totalMatches === 0 && (
            <div className="p-6 text-center text-zinc-400">
              No matches for “{q}”. Try a different term.
              {q.replace(/\s/g, "").length > 6 && (
                <div className="mt-2 text-[11px] text-amber-400/80">
                  Looks like a barcode — nothing with this code in your stash.
                </div>
              )}
            </div>
          )}

          {!loading && !q && (
            <div className="p-3 text-xs text-zinc-500">Start typing to search across your whole stash. Results include designed-for associations.</div>
          )}

          {/* Kits */}
          {filteredKits.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" /> KITS
              </div>
              <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
                {filteredKits.map((k) => {
                  const avail = computeAvailable(k);
                  return (
                    <div key={k.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-950/60 cursor-pointer" onClick={() => goTo("kits", k.id)}>
                      <div className="w-9 h-9 rounded bg-zinc-800 flex-shrink-0 overflow-hidden">
                        {k.box_art_url ? <img src={k.box_art_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg">📦</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{k.name}</div>
                        <div className="text-[11px] text-zinc-400 truncate">
                          {[k.manufacturer?.name, k.scale?.name, k.kit_type?.name].filter(Boolean).join(" • ")}
                          {k.barcode && <span className="ml-2 font-mono text-[10px] text-amber-400/70">{k.barcode}</span>}
                        </div>
                      </div>
                      <div className="text-right text-xs tabular-nums text-emerald-400">
                        {avail} avail
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); goTo("kits", k.id); }}
                        className="text-xs px-2 py-0.5 rounded border border-zinc-700 hover:border-amber-500/60"
                      >
                        View
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Parts */}
          {filteredParts.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> AFTERMARKET PARTS
              </div>
              <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
                {filteredParts.map((p) => {
                  const avail = computeAvailable(p);
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-950/60 cursor-pointer" onClick={() => goTo("parts", p.id)}>
                      <div className="w-9 h-9 rounded bg-zinc-800 flex-shrink-0 overflow-hidden">
                        {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg">🔩</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-[11px] text-zinc-400 truncate">
                          {[p.manufacturer?.name, p.scale?.name, p.part_type?.name].filter(Boolean).join(" • ")}
                          {p.designed_for_kit?.name && <span className="ml-1.5 text-violet-400">for {p.designed_for_kit.name}</span>}
                        </div>
                      </div>
                      <div className="text-right text-xs tabular-nums text-emerald-400">
                        {avail} avail
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); goTo("parts", p.id); }}
                        className="text-xs px-2 py-0.5 rounded border border-zinc-700 hover:border-amber-500/60"
                      >
                        View
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Paints */}
          {filteredPaints.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                <Droplet className="h-3.5 w-3.5" /> PAINTS
              </div>
              <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
                {filteredPaints.map((p) => {
                  const avail = computeAvailable(p);
                  const brand = p.paint_brand?.name || p.brand;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-950/60 cursor-pointer" onClick={() => goTo("paints", p.id)}>
                      <div className="w-9 h-9 rounded bg-zinc-800 flex-shrink-0 flex items-center justify-center text-sm font-mono border border-zinc-700">
                        {p.color_code || "●"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{p.color_name}</div>
                        <div className="text-[11px] text-zinc-400 truncate">
                          {[brand, p.paint_type?.name].filter(Boolean).join(" • ")}
                          {p.designed_for_kit?.name && <span className="ml-1.5 text-violet-400">for {p.designed_for_kit.name}</span>}
                        </div>
                      </div>
                      <div className="text-right text-xs tabular-nums text-emerald-400">
                        {avail} avail
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); goTo("paints", p.id); }}
                        className="text-xs px-2 py-0.5 rounded border border-zinc-700 hover:border-amber-500/60"
                      >
                        View
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800 px-4 py-2 text-[10px] text-zinc-500 flex items-center justify-between">
          <div>Tip: search also matches notes and “designed for” kit names.</div>
          <div>ESC to close</div>
        </div>
      </div>
    </div>
  );
}
