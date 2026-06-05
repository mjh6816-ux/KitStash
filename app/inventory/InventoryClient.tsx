"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import BarcodeScanner from "@/components/BarcodeScanner";

/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic Supabase joined rows + form state; types would be very large for all the optional joins */
/* eslint-disable @next/next/no-img-element -- box art and item images are user-uploaded via Supabase Storage (dynamic URLs); next/image would add overhead for 100s of cards in infinite lists without much gain */
/* eslint-disable react-hooks/set-state-in-effect -- initial mount + refreshKey + deep-link loads call fetch helpers that set* state inside effects (by design for this app's cross-device sync); exhaustive-deps also intentionally partial */
/* eslint-disable react-hooks/exhaustive-deps -- the tab/filter effects and data loaders use curated deps + refreshKey pattern; full inclusion would bloat or cause unnecessary re-fetches */
import {
  deletePart, deleteKit, deletePaint,
  adjustPartStock, adjustPaintStock, adjustKitStock,
  addAftermarketPart, addKit, addPaint,
  updateAftermarketPart, updateKit, updatePaint,
  uploadInventoryImage,
  createManufacturer, createScale, createPartType, createKitType, createPaintType, createPaintBrand, createLocation, createPurchaseSource,
  getAllParts, getAllKits, getAllPaints
} from "./actions";

export default function InventoryClient({
  manufacturers,
  scales,
  partTypes,
  kitTypes,
  paintTypes,
  paintBrands,
  locations,
  purchaseSources,
  initialParts = [],
  initialKits = [],
  initialPaints = [],
}: {
  manufacturers: { id: string; name: string }[];
  scales: { id: string; name: string }[];
  partTypes: { id: string; name: string }[];
  kitTypes: { id: string; name: string }[];
  paintTypes: { id: string; name: string }[];
  paintBrands: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  purchaseSources: { id: string; name: string }[];
  initialParts?: any[];
  initialKits?: any[];
  initialPaints?: any[];
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<"part" | "kit" | "paint">("part");

  // Barcode scanner state (used in kit forms and for quick lookup)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeScanTarget, setBarcodeScanTarget] = useState<"form" | "lookup">("form");

  // Result from quick barcode lookup (for shop/convention "do I own this?" flow)
  const [barcodeLookupResult, setBarcodeLookupResult] = useState<any>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formValues, setFormValues] = useState<any>(null);
  const [editFormKey, setEditFormKey] = useState(0);

  // Image handling for Kit / Part
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  // Refs for camera-triggered file inputs (mobile friendly)
  const partImageRef = useRef<HTMLInputElement>(null);
  const kitImageRef = useRef<HTMLInputElement>(null);

  // Quick Add Lookups (simple form like you had in Access)
  const [quickAddValues, setQuickAddValues] = useState({
    manufacturer: "",
    scale: "",
    partType: "",
    kitType: "",
    paintType: "",
    paintBrand: "",
    location: "",
    purchaseSource: "",
  });
  const [quickAddFeedback, setQuickAddFeedback] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    type: "part" | "kit" | "paint";
    name: string;
  } | null>(null);

  // Stock adjustment modal state
  const [stockAdjust, setStockAdjust] = useState<{
    id: string;
    type: "part" | "paint" | "kit";
    name: string;
    current: number;
  } | null>(null);
  const [stockAdjustAmount, setStockAdjustAmount] = useState(1);

  // Detail view modals (read-only)
  const [viewingKit, setViewingKit] = useState<any>(null);
  const [viewingPart, setViewingPart] = useState<any>(null);
  const [viewingPaint, setViewingPaint] = useState<any>(null);

  // Generic allocations for whichever item is being viewed in details
  const [itemProjectAllocations, setItemProjectAllocations] = useState<any[]>([]);

  // Deep link support: when arriving from a project "View" button (or ?view=ID), auto-open the details
  const [pendingViewId, setPendingViewId] = useState<string | null>(null);
  const deepLinkHandledRef = useRef(false);

  // Load allocations for an item (used by detail views). Defined early to avoid source-order/TDZ lint issues with effects that reference open* fns.
  const loadItemProjectAllocations = async (itemType: 'kit' | 'part' | 'paint', itemId: string) => {
    const { data, error } = await supabase
      .from("project_allocations")
      .select(`
        id,
        quantity,
        allocated_at,
        project:projects(id, name, status, conceived_date)
      `)
      .eq("item_id", itemId)
      .eq("item_type", itemType)
      .eq("allocation_status", "allocated")
      .order("allocated_at", { ascending: false });

    if (!error && data) {
      setItemProjectAllocations(data);
    } else {
      setItemProjectAllocations([]);
    }
  };

  // Open detail views (hoisted early for init effect + handler that close over them)
  const openKitDetails = (kit: any) => {
    setViewingKit(kit);
    loadItemProjectAllocations('kit', kit.id);
  };

  const openPartDetails = (part: any) => {
    setViewingPart(part);
    loadItemProjectAllocations('part', part.id);
  };

  const openPaintDetails = (paint: any) => {
    setViewingPaint(paint);
    loadItemProjectAllocations('paint', paint.id);
  };

  // Close helpers
  const closeKitDetails = () => {
    setViewingKit(null);
    setItemProjectAllocations([]);
  };

  const closePartDetails = () => {
    setViewingPart(null);
    setItemProjectAllocations([]);
  };

  const closePaintDetails = () => {
    setViewingPaint(null);
    setItemProjectAllocations([]);
  };

  // For live duplicate checking during Add
  const [addName, setAddName] = useState("");
  const [addBarcode, setAddBarcode] = useState("");

  // List density (global for now - very useful with 2500+ items)
  // Initialize compact on mobile during first client render to avoid setState-in-effect
  const [density, setDensity] = useState<"normal" | "compact">(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return "compact";
    }
    return "normal";
  });

  // Bump to force re-fetch on explicit header Refresh or window focus/visibility (cross-device sync)
  const [refreshKey, setRefreshKey] = useState(0);

  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB limit for now

  // Tabs + URL handling (must come before per-tab derived values)
  const router = useRouter();
  const pathname = usePathname();

  // Stable Supabase browser client for details loading (allocations etc.) - defined early so load/open fns can close over it without forward-ref issues
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const supabase = useMemo(() => createClient(), []);

  // Start with safe server/client defaults. URL params are applied in the effect below (post-hydration).
  // This guarantees the first render output during hydration matches what the server produced.
  const [activeTab, setActiveTabState] = useState<"parts" | "kits" | "paints">("kits");
  const [sortOption, setSortOptionState] = useState<string>("name-asc");

  // Per-tab filter + sort state (hoisted before init effect that closes over setTabStates + derived currents)
  type TabState = {
    searchTerm: string;
    filterManufacturer: string;
    filterScale: string;
    filterPartType: string;
    filterPaintType: string;
    filterStockStatus: string;
    filterLocation: string;
    sortOption: string;
  };

  const defaultTabState: TabState = {
    searchTerm: "",
    filterManufacturer: "",
    filterScale: "",
    filterPartType: "",
    filterPaintType: "",
    filterStockStatus: "",
    filterLocation: "",
    sortOption: "name-asc",
  };

  const [tabStates, setTabStates] = useState<Record<"parts" | "kits" | "paints", TabState>>({
    parts: { ...defaultTabState },
    kits: { ...defaultTabState },
    paints: { ...defaultTabState },
  });

  // Current tab's values (derived from per-tab state) - also hoisted
  const current = tabStates[activeTab] || defaultTabState;
  const searchTerm = current.searchTerm;
  const filterManufacturer = current.filterManufacturer;
  const filterScale = current.filterScale;
  const filterPartType = current.filterPartType;
  const filterPaintType = current.filterPaintType;
  const filterStockStatus = current.filterStockStatus;
  const filterLocation = current.filterLocation;

  // One-time (post-hydration): apply URL tab/sort if present, and seed the per-tab sort memory.
  // Only mutate tabStates when the sort actually differs, to avoid an unnecessary re-render on default loads.
  // Also handles deep-link "view" from Projects (auto-open details + ensure the item is visible by clearing filters).
  // Defer sets with 0 timeout to avoid "setState sync in effect" warnings/cascades during hydration+deep-link.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabFromUrl = params.get("tab") as "parts" | "kits" | "paints" | null;
      const sortFromUrl = params.get("sort") || null;
      const viewFromUrl = params.get("view");
      const tab = tabFromUrl || "kits";
      const sort = sortFromUrl || "name-asc";

      const applyInitial = () => {
        if (tabFromUrl || sortFromUrl) {
          setActiveTabState(tab as any);
          setSortOptionState(sort);
        } else if (viewFromUrl) {
          // Arrived with only ?view= (no explicit tab) — still switch to a sensible default for the item
          // (the handler effect will also force the precise tab once it finds the item)
          setActiveTabState(tab as any);
        }
        setTabStates(prev => {
          let next = prev;
          // apply sort
          if (prev[tab]?.sortOption !== sort) {
            next = {
              ...next,
              [tab]: { ...next[tab], sortOption: sort }
            };
          }
          // If arriving via deep link from a project "View", clear filters on the target tab
          // so the item is guaranteed to appear in the list (user expectation from "View" action).
          if (viewFromUrl) {
            next = {
              ...next,
              [tab]: {
                ...next[tab],
                searchTerm: "",
                filterManufacturer: "",
                filterScale: "",
                filterPartType: "",
                filterPaintType: "",
                filterStockStatus: "",
                filterLocation: "",
              }
            };
          }
          return next;
        });

        if (viewFromUrl) {
          setPendingViewId(viewFromUrl);

          // Primary open attempt: do it here inside the init effect.
          // At this point the effect body runs with closure over the mount render's values:
          // - the `kits`/`parts`/`paints` from useState(initial* from server props) -- full data is here
          // - the open* functions from this render
          // We trust the `tab` we computed from the URL (which is why the tab UI updates correctly).
          // Search the corresponding list (and fallback) using this data, then open + force tab/filters + clean URL.
          let match: any = null;
          let opener: ((item: any) => void) | null = null;
          const id = viewFromUrl;
          // Use the *initial* server props for the primary open (this effect runs on the mount render where state===initial)
          // Avoids source-order reference issues for the live state vars declared later in the component.
          if (tab === "kits") {
            match = (initialKits as any[]).find((k: any) => k.id === id);
            if (match) opener = openKitDetails;
          } else if (tab === "parts") {
            match = (initialParts as any[]).find((p: any) => p.id === id);
            if (match) opener = openPartDetails;
          } else if (tab === "paints") {
            match = (initialPaints as any[]).find((p: any) => p.id === id);
            if (match) opener = openPaintDetails;
          }
          if (!match) {
            // fallback search other lists just in case (still using initials here for primary)
            match = (initialKits as any[]).find((k: any) => k.id === id);
            if (match) opener = openKitDetails;
            if (!match) {
              match = (initialParts as any[]).find((p: any) => p.id === id);
              if (match) opener = openPartDetails;
            }
            if (!match) {
              match = (initialPaints as any[]).find((p: any) => p.id === id);
              if (match) opener = openPaintDetails;
            }
          }
          if (match && opener) {
            deepLinkHandledRef.current = true;
            // force the tab (in case) and ensure filters cleared for it
            setActiveTabState(tab as "kits" | "parts" | "paints");
            setTabStates(prev => ({
              ...prev,
              [tab]: {
                ...prev[tab],
                searchTerm: "",
                filterManufacturer: "",
                filterScale: "",
                filterPartType: "",
                filterPaintType: "",
                filterStockStatus: "",
                filterLocation: "",
              }
            }));
            opener(match);
            try {
              const p = new URLSearchParams(window.location.search);
              p.delete("view");
              p.set("tab", tab);
              const qs = p.toString();
              router.replace(`${pathname}${qs ? "?" + qs : ""}`, { scroll: false });
            } catch (e) {
              console.error("Deep link replace error", e);
            }
            setPendingViewId(null);
          }
        }
      };

      // Defer to avoid sync setState in effect lint/dev warnings
      setTimeout(applyInitial, 0);
    }
  }, []);

  // tabStates + derived current/* are hoisted early (before init effect + any closures over setTabStates).
  // Note: activeTab and sortOption are now local state (no useSearchParams) for reliable deep links and cross-device behavior.
  // We keep tabStates in sync for per-tab memory of filters. Changes update the URL via the setters.
  // sortOption is the state variable (we keep it in sync with tabStates[activeTab] and URL)

  // Lookups (start with server props, become refreshable on client)
  const [lookupData, setLookupData] = useState({
    manufacturers,
    scales,
    partTypes,
    kitTypes,
    paintTypes,
    paintBrands,
    locations,
    purchaseSources,
  });

  const refreshLookups = useCallback(async () => {
    try {
      const supabaseClient = createClient();
      const [m, s, pt, kt, paintT, paintB, locs, ps] = await Promise.all([
        supabaseClient.from("manufacturers").select("id, name").order("name"),
        supabaseClient.from("scales").select("id, name, sort_order").order("sort_order"),
        supabaseClient.from("part_types").select("id, name").order("name"),
        supabaseClient.from("kit_types").select("id, name").order("name"),
        supabaseClient.from("paint_types").select("id, name").order("name"),
        supabaseClient.from("paint_brands").select("id, name").order("name"),
        supabaseClient.from("locations").select("id, name").order("name"),
        supabaseClient.from("purchase_sources").select("id, name").order("name"),
      ]);

      setLookupData({
        manufacturers: m.data || [],
        scales: s.data || [],
        partTypes: pt.data || [],
        kitTypes: kt.data || [],
        paintTypes: paintT.data || [],
        paintBrands: paintB.data || [],
        locations: locs.data || [],
        purchaseSources: ps.data || [],
      });
    } catch (err) {
      console.error("Failed to refresh lookups:", err);
    }
  }, []);

  // setActiveTab switches tab and puts that tab's current sort into the URL
  const setActiveTab = (tab: "parts" | "kits" | "paints") => {
    setActiveTabState(tab);
    const targetSort = tabStates[tab]?.sortOption || "name-asc";
    setSortOptionState(targetSort);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    params.set("sort", targetSort);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Update sort for the currently active tab (state + URL)
  const setSortOption = (newSort: string) => {
    setSortOptionState(newSort);
    setTabStates(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], sortOption: newSort },
    }));

    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    params.set("sort", newSort);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Helper to update only the current tab's filters
  const updateCurrentTab = (patch: Partial<TabState>) => {
    setTabStates(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], ...patch },
    }));
  };

  // Quick Add for lookup tables (the simple form experience from Access)
  const handleQuickAdd = async (type: keyof typeof quickAddValues) => {
    const value = quickAddValues[type].trim();
    if (!value) return;

    setQuickAddFeedback(null);

    try {
      let result;
      switch (type) {
        case "manufacturer":
          result = await createManufacturer(value);
          break;
        case "scale":
          result = await createScale(value);
          break;
        case "partType":
          result = await createPartType(value);
          break;
        case "kitType":
          result = await createKitType(value);
          break;
        case "paintType":
          result = await createPaintType(value);
          break;
        case "paintBrand":
          result = await createPaintBrand(value);
          break;
        case "location":
          result = await createLocation(value);
          break;
        case "purchaseSource":
          result = await createPurchaseSource(value);
          break;
      }

      await refreshLookups();

      // Clear the input
      setQuickAddValues(prev => ({ ...prev, [type]: "" }));
      setQuickAddFeedback(`Added: ${result?.name || value}`);

      // Auto-clear feedback after a bit
      setTimeout(() => setQuickAddFeedback(null), 2500);
    } catch (err: any) {
      setQuickAddFeedback(`Error: ${err.message || "Failed to add"}`);
      setTimeout(() => setQuickAddFeedback(null), 4000);
    }
  };

  const updateQuickAdd = (type: keyof typeof quickAddValues, val: string) => {
    setQuickAddValues(prev => ({ ...prev, [type]: val }));
  };

  // Improved duplication awareness
  const findPotentialDuplicates = (name: string, manufacturerId?: string, scaleId?: string, itemTypeFilter?: string) => {
    if (!name || name.length < 3) return [];
    const lowerName = name.toLowerCase().trim();

    const allItems = [
      ...parts.map(p => ({ ...p, itemType: 'part' as const })),
      ...kits.map(k => ({ ...k, itemType: 'kit' as const })),
      ...paints.map(p => ({ ...p, itemType: 'paint' as const })),
    ];

    return allItems
      .filter(item => {
        const itemName = (item.name || item.color_name || '').toLowerCase();
        const nameMatch = itemName.includes(lowerName) || lowerName.includes(itemName);
        if (!nameMatch) return false;

        if (manufacturerId && item.manufacturer_id && item.manufacturer_id !== manufacturerId) return false;
        if (scaleId && item.scale_id && item.scale_id !== scaleId) return false;
        if (itemTypeFilter && item.itemType !== itemTypeFilter) return false;

        return true;
      })
      .slice(0, 3);
  };

  // Infinite scroll state (server-side)
  const [parts, setParts] = useState<any[]>(initialParts);
  const [kits, setKits] = useState<any[]>(initialKits);
  const [paints, setPaints] = useState<any[]>(initialPaints);

  const [partsLoading, setPartsLoading] = useState(false);
  const [kitsLoading, setKitsLoading] = useState(false);
  const [paintsLoading, setPaintsLoading] = useState(false);

  const [partsError, setPartsError] = useState<string | null>(null);
  const [kitsError, setKitsError] = useState<string | null>(null);
  const [paintsError, setPaintsError] = useState<string | null>(null);

  const fetchParts = useCallback(async () => {
    setPartsLoading(true);
    setPartsError(null);
    try {
      const items = await getAllParts();
      setParts(items);
      setPartsLoading(false);
    } catch (err: any) {
      console.error("fetchParts error", err);
      const msg = err?.message || (err && typeof err === "object" ? JSON.stringify(err) : String(err)) || "Failed to load parts";
      setPartsError(msg);
      setPartsLoading(false);
    }
  }, []);


  const fetchKits = useCallback(async () => {
    setKitsLoading(true);
    setKitsError(null);
    try {
      const items = await getAllKits();
      setKits(items);
      setKitsLoading(false);
    } catch (err: any) {
      console.error("fetchKits error", err);
      const msg = err?.message || (err && typeof err === "object" ? JSON.stringify(err) : String(err)) || "Failed to load kits";
      setKitsError(msg);
      setKitsLoading(false);
    }
  }, []);


  const fetchPaints = useCallback(async () => {
    setPaintsLoading(true);
    setPaintsError(null);
    try {
      const items = await getAllPaints();
      setPaints(items);
      setPaintsLoading(false);
    } catch (err: any) {
      console.error("fetchPaints error", err);
      const msg = err?.message || (err && typeof err === "object" ? JSON.stringify(err) : String(err)) || "Failed to load paints";
      setPaintsError(msg);
      setPaintsLoading(false);
    }
  }, []);


  // Load/refresh full data for all tabs on mount + when refreshKey is bumped (header Refresh or focus/visibility for cross-device sync).
  // We deliberately do NOT re-fetch on filter/search/sort changes — displayed* compute those instantly client-side.
  useEffect(() => {
    fetchParts();
    fetchKits();
    fetchPaints();
  }, [activeTab, refreshKey]);

  // Extra explicit mount-only load (ensures data even if timing differs across devices/browsers)
  useEffect(() => {
    fetchParts();
    fetchKits();
    fetchPaints();
  }, []);

  // Auto re-fetch when the window/tab regains focus or visibility.
  // This provides decent cross-device sync (e.g. add on phone → switch to PC → lists update without manual tap).
  useEffect(() => {
    const doRefresh = () => {
      setRefreshKey(k => k + 1);
    };
    const onFocus = () => doRefresh();
    const onVis = () => { if (!document.hidden) doRefresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [activeTab]);

  // Listen for barcode lookup trigger (from GlobalSearch "Scan" button or future nav items)
  // Opens the scanner directly in lookup mode for the shop/convention "do I own this?" flow.
  useEffect(() => {
    const handler = () => {
      setBarcodeScanTarget("lookup");
      setShowBarcodeScanner(true);
    };
    window.addEventListener("trigger-barcode-lookup", handler);
    return () => window.removeEventListener("trigger-barcode-lookup", handler);
  }, []);

  // Barcode handlers
  const handleBarcodeDetectedForForm = (code: string) => {
    if (editingItem) {
      setFormValues((prev: any) => ({ ...prev, barcode: code }));
    } else {
      setAddBarcode(code);
    }
    setShowBarcodeScanner(false);
    setBarcodeScanTarget("form");
  };

  const handleBarcodeDetectedForLookup = (code: string) => {
    setShowBarcodeScanner(false);
    setBarcodeScanTarget("lookup");

    // Direct fast lookup against currently loaded kits (no extra network for the check)
    const match = kits.find((k: any) => (k.barcode || "").toLowerCase() === code.toLowerCase());

    if (match) {
      const owned = (match.quantity_owned || 0) - (match.quantity_allocated || 0) - (match.quantity_used || 0);
      setBarcodeLookupResult({
        ...match,
        scannedCode: code,
        available: Math.max(0, owned),
        owned: true,
      });
    } else {
      setBarcodeLookupResult({
        scannedCode: code,
        owned: false,
        notFound: true,
      });
    }

    // Also push to GlobalSearch for full results / "View"
    window.dispatchEvent(new CustomEvent("open-kitstash-search", { detail: { barcode: code } }));
  };

  // Smart add/edit handler with optional image upload
  const handleAdd = async (fd: FormData) => {
    setAddError(null);
    try {
      const isEditing = !!editingItem;
      const type = addType;

      // Handle image upload if a new file was selected (only for kit/part)
      if (selectedImage && (type === "kit" || type === "part")) {
        const imageFormData = new FormData();
        imageFormData.append("image", selectedImage);
        imageFormData.append("type", type);
        imageFormData.append("itemId", isEditing ? editingItem.id : "new");

        const imageUrl = await uploadInventoryImage(imageFormData);

        // Append the resulting URL to the main form data
        if (type === "kit") {
          fd.append("box_art_url", imageUrl);
        } else {
          fd.append("image_url", imageUrl);
        }
      } else if (isEditing && !selectedImage && !currentImageUrl) {
        // User removed the existing image
        if (type === "kit") {
          fd.append("box_art_url", "");
        } else {
          fd.append("image_url", "");
        }
      }

      if (type === "part") {
        if (isEditing) {
          await updateAftermarketPart(fd);
        } else {
          await addAftermarketPart(fd);
        }
        await fetchParts();
      } else if (type === "kit") {
        if (isEditing) {
          await updateKit(fd);
        } else {
          await addKit(fd);
        }
        await fetchKits();
      } else if (type === "paint") {
        if (isEditing) {
          await updatePaint(fd);
        } else {
          await addPaint(fd);
        }
        await fetchPaints();
      }

      setShowAddModal(false);
      setEditingItem(null);
      setFormValues(null);
      setSelectedImage(null);
      setCurrentImageUrl(null);
      setAddName("");
      setAddBarcode("");
    } catch (err: any) {
      const msg = err?.message || "Failed to save. Check your terminal (next dev) for the exact error.";
      setAddError(msg);
      console.error("Save item error:", err);
    }
  };

  // Opens the nice delete confirmation modal
  const openDeleteConfirm = (id: string, type: "part" | "kit" | "paint", name: string) => {
    setDeleteConfirm({ id, type, name });
  };

  // Actually performs the deletion after user confirms in the modal
  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    const { id, type } = deleteConfirm;

    try {
      const formData = new FormData();
      formData.append("id", id);

      if (type === "part") {
        await deletePart(formData);
        await fetchParts();
      } else if (type === "kit") {
        await deleteKit(formData);
        await fetchKits();
      } else if (type === "paint") {
        await deletePaint(formData);
        await fetchPaints();
      }
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert("Failed to delete item. Please try again.");
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Open stock adjustment modal
  const openStockAdjust = (id: string, type: "part" | "paint" | "kit", name: string, current: number) => {
    setStockAdjust({ id, type, name, current });
    setStockAdjustAmount(1); // default to +1 for quick use
  };

  // Deep link handler (from Projects "View" buttons or direct /inventory?tab=...&view=<itemId>)
  // Runs after data arrives (or updates) and auto-opens the matching detail modal.
  // We also cleaned the filters for this tab on arrival so the card is visible in the list.
  // Robust: searches all lists (tab may lag) and forces correct activeTab + opens details.
  useEffect(() => {
    if (!pendingViewId || deepLinkHandledRef.current) return;

    let match: any = null;
    let opener: ((item: any) => void) | null = null;
    let foundTab: "kits" | "parts" | "paints" | null = null;

    // Check the list for the current activeTab first
    if (activeTab === "kits") {
      match = kits.find((k: any) => k.id === pendingViewId);
      if (match) { opener = openKitDetails; foundTab = "kits"; }
    } else if (activeTab === "parts") {
      match = parts.find((p: any) => p.id === pendingViewId);
      if (match) { opener = openPartDetails; foundTab = "parts"; }
    } else if (activeTab === "paints") {
      match = paints.find((p: any) => p.id === pendingViewId);
      if (match) { opener = openPaintDetails; foundTab = "paints"; }
    }

    if (!match) {
      // Fallback: search the other lists (in case activeTab state hasn't caught up to the URL intent yet)
      if (!match) {
        const m = kits.find((k: any) => k.id === pendingViewId);
        if (m) { match = m; opener = openKitDetails; foundTab = "kits"; }
      }
      if (!match) {
        const m = parts.find((p: any) => p.id === pendingViewId);
        if (m) { match = m; opener = openPartDetails; foundTab = "parts"; }
      }
      if (!match) {
        const m = paints.find((p: any) => p.id === pendingViewId);
        if (m) { match = m; opener = openPaintDetails; foundTab = "paints"; }
      }
    }

    if (match && opener) {
      // Defer sets to avoid "setState sync in effect" detector (data-arrival handler)
      setTimeout(() => {
        // Ensure we are showing the correct tab (in case timing made activeTab lag the url intent)
        if (foundTab && activeTab !== foundTab) {
          setActiveTabState(foundTab);
        }

        // Make sure filters on the target tab are cleared so the item appears in the list (not just in the modal)
        if (foundTab) {
          setTabStates(prev => ({
            ...prev,
            [foundTab]: {
              ...prev[foundTab],
              searchTerm: "",
              filterManufacturer: "",
              filterScale: "",
              filterPartType: "",
              filterPaintType: "",
              filterStockStatus: "",
              filterLocation: "",
            }
          }));
        }

        deepLinkHandledRef.current = true;
        opener(match);

        // Clean the view param from URL (keep tab so deep links remain bookmarkable for the tab)
        try {
          const params = new URLSearchParams(window.location.search);
          params.delete("view");
          if (foundTab) params.set("tab", foundTab);
          const qs = params.toString();
          router.replace(`${pathname}${qs ? "?" + qs : ""}`, { scroll: false });
        } catch (e) {
          console.error("Deep link replace error (handler)", e);
        }
        setPendingViewId(null);
      }, 0);
    }
    // Re-run when pending changes, tab changes, or any of the lists get new data (new array ref from set)
  }, [pendingViewId, activeTab, kits, parts, paints, router, pathname]);

  // Perform the stock adjustment
  const confirmStockAdjust = async () => {
    if (!stockAdjust) return;

    const { id, type } = stockAdjust;
    const amount = stockAdjustAmount;

    if (amount === 0) {
      setStockAdjust(null);
      return;
    }

    try {
      const formData = new FormData();
      if (type === "part") {
        formData.append("partId", id);
      } else if (type === "paint") {
        formData.append("paintId", id);
      } else {
        formData.append("kitId", id);
      }
      formData.append("amount", amount.toString());

      if (type === "part") {
        await adjustPartStock(formData);
        await fetchParts();
      } else if (type === "paint") {
        await adjustPaintStock(formData);
        await fetchPaints();
      } else if (type === "kit") {
        await adjustKitStock(formData);
        await fetchKits();
      }
    } catch (err: any) {
      console.error("Stock adjustment failed:", err);
      alert("Failed to adjust stock. Please try again.");
    } finally {
      setStockAdjust(null);
    }
  };

  const openEdit = (item: any, type: "part" | "kit" | "paint") => {
    console.log('[openEdit] item received:', {
      id: item.id,
      name: item.name,
      notes: item.notes,
      manufacturer_id: item.manufacturer_id,
      scale_id: item.scale_id,
      kit_type_id: item.kit_type_id,
      status: item.status,
      location: item.location,
    });

    setEditingItem(item);
    // Make a clean copy for the form so we don't mutate the list item
    setFormValues({
      ...item,
      // Ensure common fields exist so controlled inputs don't start as uncontrolled
      quantity_owned: item.quantity_owned ?? 0,
      quantity_allocated: item.quantity_allocated ?? 0,
      quantity_used: item.quantity_used ?? 0,
    });
    setEditFormKey(k => k + 1);   // force full remount of the form so controlled inputs initialize cleanly from the fresh formValues

    // Set current image URL for preview
    if (type === "kit") {
      setCurrentImageUrl(item.box_art_url || null);
    } else if (type === "part") {
      setCurrentImageUrl(item.image_url || null);
    } else {
      setCurrentImageUrl(null);
    }
    setSelectedImage(null);

    setAddType(type);
    setAddError(null);
    refreshLookups();           // pick up any newly added lookup values (types, brands, etc.)
    setShowAddModal(true);
  };

  // Client-side filter + sort (instant, no server roundtrip on typing or dropdown changes)
  const applySort = (items: any[], sort: string, nameKey: string, brandFallback?: string) => {
    if (!items.length) return items;
    const arr = [...items];
    if (["manufacturer-asc", "manufacturer-desc", "scale-asc", "scale-desc", "type-asc", "type-desc"].includes(sort)) {
      return arr.sort((a: any, b: any) => {
        let cmp = 0;
        if (sort === "manufacturer-asc" || sort === "manufacturer-desc") {
          const ma = (brandFallback ? (a[brandFallback]?.name || a.brand || "") : (a.manufacturer?.name || "")) || "";
          const mb = (brandFallback ? (b[brandFallback]?.name || b.brand || "") : (b.manufacturer?.name || "")) || "";
          cmp = ma.localeCompare(mb);
          if (cmp === 0) cmp = (a[nameKey] || "").localeCompare(b[nameKey] || "");
          if (sort === "manufacturer-desc") cmp = -cmp;
        } else if (sort === "scale-asc" || sort === "scale-desc") {
          const sa = a.scale?.sort_order ?? 9999;
          const sb = b.scale?.sort_order ?? 9999;
          cmp = sa - sb;
          if (cmp === 0) cmp = (a[nameKey] || "").localeCompare(b[nameKey] || "");
          if (sort === "scale-desc") cmp = -cmp;
        } else if (sort === "type-asc" || sort === "type-desc") {
          const ta = (a.part_type?.name || a.kit_type?.name || a.paint_type?.name || "") as string;
          const tb = (b.part_type?.name || b.kit_type?.name || b.paint_type?.name || "") as string;
          cmp = ta.localeCompare(tb);
          if (cmp === 0) cmp = (a[nameKey] || "").localeCompare(b[nameKey] || "");
          if (sort === "type-desc") cmp = -cmp;
        }
        return cmp;
      });
    } else if (sort === "name-desc") {
      return arr.sort((a: any, b: any) => (b[nameKey] || "").localeCompare(a[nameKey] || ""));
    } else if (sort === "newest") {
      return arr.sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
    } else if (sort === "oldest") {
      return arr.sort((a: any, b: any) => (a.created_at || "").localeCompare(b.created_at || ""));
    } else if (sort === "updated-desc") {
      return arr.sort((a: any, b: any) => (b.updated_at || "").localeCompare(a.updated_at || ""));
    } else if (sort === "stock-low") {
      return arr.sort((a: any, b: any) => ((a.quantity_owned ?? 0) - (b.quantity_owned ?? 0)) || (a[nameKey] || "").localeCompare(b[nameKey] || ""));
    } else if (sort === "stock-high") {
      return arr.sort((a: any, b: any) => ((b.quantity_owned ?? 0) - (a.quantity_owned ?? 0)) || (a[nameKey] || "").localeCompare(b[nameKey] || ""));
    }
    // default name-asc
    return arr.sort((a: any, b: any) => (a[nameKey] || "").localeCompare(b[nameKey] || ""));
  };

  const displayedPartsBase = parts.filter((item: any) => {
    const name = item.name || '';
    const matchesSearch = !searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesManufacturer = !filterManufacturer || item.manufacturer?.name === filterManufacturer;
    const matchesScale = !filterScale || item.scale?.name === filterScale;
    const matchesPartType = !filterPartType || item.part_type?.name === filterPartType;

    let matchesStock = true;
    if (filterStockStatus && typeof item.quantity_owned === 'number') {
      if (filterStockStatus === 'out') matchesStock = item.quantity_owned === 0;
      if (filterStockStatus === 'low') matchesStock = item.quantity_owned > 0 && item.quantity_owned <= 2;
    }
    const matchesLocation = !filterLocation || item.loc?.name === filterLocation;
    return matchesSearch && matchesManufacturer && matchesScale && matchesPartType && matchesStock && matchesLocation;
  });
  const displayedParts = applySort(displayedPartsBase, sortOption, 'name');

  const displayedKitsBase = kits.filter((item: any) => {
    const name = item.name || '';
    const matchesSearch = !searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesManufacturer = !filterManufacturer || item.manufacturer?.name === filterManufacturer;
    const matchesScale = !filterScale || item.scale?.name === filterScale;

    let matchesStock = true;
    if (filterStockStatus) {
      const owned = item.quantity_owned ?? 0;
      const allocated = item.quantity_allocated ?? 0;
      const used = item.quantity_used ?? 0;
      const available = Math.max(0, owned - allocated - used);

      if (filterStockStatus === 'out') matchesStock = available === 0;
      if (filterStockStatus === 'low') matchesStock = available > 0 && available <= 2;
    }
    const matchesLocation = !filterLocation || item.loc?.name === filterLocation;
    return matchesSearch && matchesManufacturer && matchesScale && matchesStock && matchesLocation;
  });
  const displayedKits = applySort(displayedKitsBase, sortOption, 'name');

  const displayedPaintsBase = paints.filter((item: any) => {
    const name = item.color_name || '';
    const matchesSearch = !searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesManufacturer = !filterManufacturer || item.brand === filterManufacturer;
    const matchesPaintType = !filterPaintType || item.paint_type?.name === filterPaintType;

    let matchesStock = true;
    if (filterStockStatus && typeof item.quantity_owned === 'number') {
      if (filterStockStatus === 'out') matchesStock = item.quantity_owned === 0;
      if (filterStockStatus === 'low') matchesStock = item.quantity_owned > 0 && item.quantity_owned <= 2;
    }
    const matchesLocation = !filterLocation || item.loc?.name === filterLocation;
    return matchesSearch && matchesManufacturer && matchesPaintType && matchesStock && matchesLocation;
  });
  const displayedPaints = applySort(displayedPaintsBase, sortOption, 'color_name', 'paint_brand');

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-zinc-400 mt-1">
            {activeTab === "parts" && "Aftermarket Parts"}
            {activeTab === "kits" && "Kits"}
            {activeTab === "paints" && "Paints"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => {
            setAddError(null);
            // Fire and forget; don't let refresh throw block the modal
            Promise.resolve().then(() => refreshLookups().catch(() => {})).catch(() => {});
            setShowAddModal(true);
          }}>+ Add Item</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBarcodeScanTarget("lookup");
              setShowBarcodeScanner(true);
            }}
          >
            📷 Scan to Lookup Kit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey(k => k + 1)}
          >
            ↻ Refresh
          </Button>
        </div>
      </div>

      {/* Quick Barcode Lookup Result (for shop/convention "do I already own this kit?" scans) */}
      {barcodeLookupResult && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-zinc-950 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-amber-400/80">Barcode Lookup</div>
              <div className="font-mono text-sm text-amber-300 mt-0.5">{barcodeLookupResult.scannedCode}</div>

              {barcodeLookupResult.owned ? (
                <div className="mt-2">
                  <div className="text-emerald-400 font-semibold">You own this kit</div>
                  <div className="text-sm mt-1">
                    {barcodeLookupResult.name} • {barcodeLookupResult.scale?.name} • {barcodeLookupResult.manufacturer?.name}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">
                    Owned: {barcodeLookupResult.quantity_owned} • Available: {barcodeLookupResult.available ?? 0} • Status: {barcodeLookupResult.status}
                    {barcodeLookupResult.loc?.name && ` • ${barcodeLookupResult.loc.name}`}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-amber-400 font-medium">Not in your stash</div>
              )}
            </div>

            <div className="flex flex-col gap-2 items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBarcodeLookupResult(null)}
              >
                Dismiss
              </Button>
              {barcodeLookupResult.owned && barcodeLookupResult.id && (
                <Button
                  size="sm"
                  onClick={() => {
                    // Jump to inventory detail
                    window.location.href = `/inventory?tab=kits&view=${barcodeLookupResult.id}`;
                  }}
                >
                  View Details
                </Button>
              )}
              {barcodeLookupResult.notFound && (
                <Button
                  size="sm"
                  onClick={() => {
                    setAddType("kit");
                    setAddBarcode(barcodeLookupResult.scannedCode);
                    setFormValues({ barcode: barcodeLookupResult.scannedCode });
                    setShowAddModal(true);
                    setBarcodeLookupResult(null);
                  }}
                >
                  Add This Kit
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 mb-6">
        {[
          { key: "parts" as const, label: "Aftermarket Parts", count: displayedParts.length },
          { key: "kits" as const, label: "Kits", count: displayedKits.length },
          { key: "paints" as const, label: "Paints", count: displayedPaints.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-amber-500 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
            <span className="ml-2 text-xs text-zinc-500">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-zinc-400">Sort:</span>
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="manufacturer-asc">Manufacturer A–Z</option>
          <option value="manufacturer-desc">Manufacturer Z–A</option>
          <option value="scale-asc">Scale (small to large)</option>
          <option value="scale-desc">Scale (large to small)</option>
          <option value="type-asc">Type A–Z</option>
          <option value="type-desc">Type Z–A</option>
          <option value="newest">Recently Added</option>
          <option value="oldest">Oldest First</option>
          <option value="updated-desc">Last Modified</option>
          <option value="stock-low">Lowest Stock</option>
          <option value="stock-high">Highest Stock</option>
        </select>

        <span className="text-sm text-zinc-400 ml-2">View:</span>
        <select
          value={density}
          onChange={(e) => setDensity(e.target.value as "normal" | "compact")}
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="normal">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => updateCurrentTab({ searchTerm: e.target.value })}
          className="w-full md:w-64 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm placeholder:text-zinc-500"
        />

        <select
          value={filterManufacturer}
          onChange={(e) => updateCurrentTab({ filterManufacturer: e.target.value })}
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="">All Manufacturers</option>
          {lookupData.manufacturers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>

        <select
          value={filterScale}
          onChange={(e) => updateCurrentTab({ filterScale: e.target.value })}
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="">All Scales</option>
          {lookupData.scales.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>

        {activeTab === "parts" && (
          <select
            value={filterPartType}
            onChange={(e) => updateCurrentTab({ filterPartType: e.target.value })}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="">All Part Types</option>
            {lookupData.partTypes.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        )}

        {activeTab === "paints" && (
          <select
            value={filterPaintType}
            onChange={(e) => updateCurrentTab({ filterPaintType: e.target.value })}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="">All Paint Types</option>
            {lookupData.paintTypes.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        )}

        <select
          value={filterStockStatus}
          onChange={(e) => updateCurrentTab({ filterStockStatus: e.target.value })}
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="">All Stock Levels</option>
          <option value="low">Low Stock (1-2)</option>
          <option value="out">Out of Stock (0)</option>
        </select>

        <select
          value={current.filterLocation || ""}
          onChange={(e) => updateCurrentTab({ filterLocation: e.target.value })}
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="">All Locations</option>
          {lookupData.locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
        </select>
      </div>

      {/* Aftermarket Parts - Infinite Scroll */}
      {activeTab === "parts" && (
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          Aftermarket Parts
          <span className="text-sm font-normal text-zinc-500">({displayedParts.length})</span>
        </h2>

        {partsError ? (
          <div className="card p-8 text-center text-red-400 border border-red-500/50">Error loading parts: {partsError}</div>
        ) : displayedParts.length === 0 && !partsLoading ? (
          <div className="card p-8 text-center text-zinc-400">No parts found. Adjust filters or add some.</div>
        ) : (
          <div className="space-y-3">
            {displayedParts.map((part) => {
              const mfg = part.manufacturer;
              const scl = part.scale;
              const typ = part.part_type;

              return (
                <div 
                  key={part.id} 
                  className={`card flex flex-col md:flex-row md:items-center gap-3 ${density === "compact" ? "p-2.5" : "p-4"}`}
                >
                  {part.image_url && density === "normal" && (
                    <img 
                      src={part.image_url} 
                      alt={part.name}
                      onClick={(e) => { e.stopPropagation(); openPartDetails(part); }}
                      className="h-14 w-14 rounded object-cover border border-zinc-700 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${density === "compact" ? "text-base" : "text-lg"}`}>{part.name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {[typ?.name, scl?.name, mfg?.name].filter(Boolean).join(" • ")}
                    </div>
                    {part.loc?.name && <div className="text-[10px] text-zinc-500 mt-0.5">Location: {part.loc.name}</div>}
                    {part.notes && density === "normal" && (
                      <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">Notes: {part.notes}</div>
                    )}
                    {part.exclude_from_out_of_stock && (
                      <div className="text-[9px] text-amber-400 mt-0.5">⚠ Excluded from out-of-stock</div>
                    )}
                    {part.designed_for_kit?.name && (
                      <div className="text-[9px] text-violet-400 mt-0.5">For: {part.designed_for_kit.name}</div>
                    )}
                  </div>

                  <div className={`flex items-center ${density === "compact" ? "gap-4 text-xs" : "gap-6 text-sm"}`}>
                    {(() => {
                      const owned = part.quantity_owned ?? 0;
                      const allocated = part.quantity_allocated ?? 0;
                      const used = part.quantity_used ?? 0;
                      const available = Math.max(0, owned - allocated - used);
                      return (
                        <>
                          <div>
                            <div className="text-[10px] text-zinc-400">Owned</div>
                            <div className={`font-semibold tabular-nums ${density === "compact" ? "text-base" : "text-xl"}`}>{owned}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">Avail</div>
                            <div className={`font-medium text-emerald-400 tabular-nums ${density === "compact" ? "text-sm" : "text-lg"}`}>{available}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">Alloc</div>
                            <div className={`font-medium text-violet-400 tabular-nums ${density === "compact" ? "text-sm" : "text-lg"}`}>{allocated}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">Used</div>
                            <div className={`font-medium text-amber-400 tabular-nums ${density === "compact" ? "text-sm" : "text-lg"}`}>{used}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className={`flex gap-2 md:ml-auto ${density === "compact" ? "text-xs" : ""}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(part, "part")}
                      className={density === "compact" ? "h-7 px-2 text-xs" : ""}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openStockAdjust(part.id, "part", part.name, part.quantity_owned ?? 0)}
                      className={density === "compact" ? "h-7 px-2 text-xs" : ""}
                    >
                      Adjust
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPartDetails(part)}
                      className={density === "compact" ? "h-7 px-2 text-xs" : ""}
                    >
                      Details
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteConfirm(part.id, "part", part.name)}
                      className={density === "compact" ? "h-7 px-2 text-xs" : ""}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      {/* Kits - Infinite Scroll */}
      {activeTab === "kits" && (
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          Kits
          <span className="text-sm font-normal text-zinc-500">({displayedKits.length})</span>
        </h2>

        {kitsError ? (
          <div className="card p-8 text-center text-red-400 border border-red-500/50">Error loading kits: {kitsError}</div>
        ) : displayedKits.length === 0 && !kitsLoading ? (
          <div className="card p-8 text-center text-zinc-400">No kits found. Adjust filters or add some.</div>
        ) : (
          <div className="space-y-3">
            {displayedKits.map((kit) => {
              const mfg = kit.manufacturer;
              const scl = kit.scale;
              const typ = kit.kit_type;

              return (
                <div 
                  key={kit.id} 
                  className={`card flex flex-col md:flex-row md:items-center gap-3 ${density === "compact" ? "p-2.5" : "p-4"}`}
                >
                  {kit.box_art_url && density === "normal" && (
                    <img 
                      src={kit.box_art_url} 
                      alt={kit.name}
                      onClick={(e) => { e.stopPropagation(); openKitDetails(kit); }}
                      className="h-14 w-14 rounded object-cover border border-zinc-700 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${density === "compact" ? "text-base" : "text-lg"}`}>{kit.name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {[typ?.name, scl?.name, mfg?.name].filter(Boolean).join(" • ")}
                      {kit.barcode && <span className="ml-2 font-mono text-[10px] text-amber-400/70">{kit.barcode}</span>}
                    </div>
                    {kit.loc?.name && <div className="text-[10px] text-zinc-500 mt-0.5">Location: {kit.loc.name}</div>}
                    {kit.notes && density === "normal" && (
                      <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">Notes: {kit.notes}</div>
                    )}
                  </div>

                  <div className={density === "compact" ? "text-xs" : ""}>
                    <div className="text-[10px] text-zinc-400">Status</div>
                    <div className="font-medium capitalize">{kit.status.replace("_", " ")}</div>
                  </div>

                  <div className={`flex items-center ${density === "compact" ? "gap-4 text-xs" : "gap-6 text-sm"}`}>
                    {(() => {
                      const owned = kit.quantity_owned ?? 0;
                      const allocated = kit.quantity_allocated ?? 0;
                      const used = kit.quantity_used ?? 0;
                      const available = Math.max(0, owned - allocated - used);
                      return (
                        <>
                          <div>
                            <div className="text-[10px] text-zinc-400">Owned</div>
                            <div className={`font-semibold tabular-nums ${density === "compact" ? "text-base" : "text-xl"}`}>{owned}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">Avail</div>
                            <div className={`font-medium text-emerald-400 tabular-nums ${density === "compact" ? "text-sm" : "text-lg"}`}>{available}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">Alloc</div>
                            <div className={`font-medium text-violet-400 tabular-nums ${density === "compact" ? "text-sm" : "text-lg"}`}>{allocated}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">Used</div>
                            <div className={`font-medium text-amber-400 tabular-nums ${density === "compact" ? "text-sm" : "text-lg"}`}>{used}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className={`flex gap-2 md:ml-auto ${density === "compact" ? "text-xs" : ""}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(kit, "kit")}
                      className={density === "compact" ? "h-7 px-2 text-xs" : ""}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openStockAdjust(kit.id, "kit", kit.name, kit.quantity_owned ?? 0)}
                      className={density === "compact" ? "h-7 px-2 text-xs" : ""}
                    >
                      Adjust
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openKitDetails(kit)}
                      className={density === "compact" ? "h-7 px-2 text-xs" : ""}
                    >
                      Details
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteConfirm(kit.id, "kit", kit.name)}
                      className={density === "compact" ? "h-7 px-2 text-xs" : ""}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      {/* Paints - Infinite Scroll */}
      {activeTab === "paints" && (
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          Paints
          <span className="text-sm font-normal text-zinc-500">({displayedPaints.length})</span>
        </h2>

        {paintsError ? (
          <div className="card p-8 text-center text-red-400 border border-red-500/50">Error loading paints: {paintsError}</div>
        ) : displayedPaints.length === 0 && !paintsLoading ? (
          <div className="card p-8 text-center text-zinc-400">No paints found. Adjust filters or add some.</div>
        ) : (
          <div className="space-y-3">
            {displayedPaints.map((paint) => {
              const ptype = paint.paint_type;

              return (
                <div 
                  key={paint.id} 
                  className={`card flex flex-col md:flex-row md:items-center gap-3 ${density === "compact" ? "p-2.5" : "p-4"}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${density === "compact" ? "text-base" : "text-lg"}`}>{paint.color_name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {[paint.paint_brand?.name || paint.brand, ptype?.name].filter(Boolean).join(" • ")}
                      {paint.opened && <span className="ml-2 text-amber-400">(Opened)</span>}
                    </div>

                    {/* Color reference numbers - only in normal mode to save space */}
                    {density === "normal" && (paint.series || paint.fs_number || paint.ral_number || paint.rlm_number || paint.ana_number) && (
                      <div className="text-[10px] text-zinc-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                        {paint.series && <span>Series: {paint.series}</span>}
                        {paint.fs_number && <span>FS#: {paint.fs_number}</span>}
                        {paint.ral_number && <span>RAL#: {paint.ral_number}</span>}
                        {paint.rlm_number && <span>RLM#: {paint.rlm_number}</span>}
                        {paint.ana_number && <span>ANA#: {paint.ana_number}</span>}
                      </div>
                    )}

                    {paint.loc?.name && <div className="text-[10px] text-zinc-500 mt-0.5">Location: {paint.loc.name}</div>}
                    {paint.notes && density === "normal" && (
                      <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">Notes: {paint.notes}</div>
                    )}
                    {paint.exclude_from_out_of_stock && (
                      <div className="text-[9px] text-amber-400 mt-0.5">⚠ Excluded from out-of-stock</div>
                    )}
                    {paint.designed_for_kit?.name && (
                      <div className="text-[9px] text-violet-400 mt-0.5">For: {paint.designed_for_kit.name}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    {(() => {
                      const owned = paint.quantity_owned ?? 0;
                      const allocated = paint.quantity_allocated ?? 0;
                      const used = paint.quantity_used ?? 0;
                      const available = Math.max(0, owned - allocated - used);
                      return (
                        <>
                          <div>
                            <div className="text-[10px] text-zinc-400">Owned</div>
                            <div className={`font-semibold tabular-nums ${density === "compact" ? "text-base" : "text-xl"}`}>{owned}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">Avail</div>
                            <div className={`font-medium text-emerald-400 tabular-nums ${density === "compact" ? "text-sm" : "text-lg"}`}>{available}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">Alloc</div>
                            <div className={`font-medium text-violet-400 tabular-nums ${density === "compact" ? "text-sm" : "text-lg"}`}>{allocated}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">Used</div>
                            <div className={`font-medium text-amber-400 tabular-nums ${density === "compact" ? "text-sm" : "text-lg"}`}>{used}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className={`flex gap-2 md:ml-auto ${density === "compact" ? "text-xs" : ""}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(paint, "paint")}
                      className={density === "compact" ? "h-7 px-2 text-xs" : ""}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openStockAdjust(paint.id, "paint", paint.color_name, paint.quantity_owned ?? 0)}
                      className={density === "compact" ? "h-7 px-2 text-xs" : ""}
                    >
                      Adjust
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPaintDetails(paint)}
                      className={density === "compact" ? "h-7 px-2 text-xs" : ""}
                    >
                      Details
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteConfirm(paint.id, "paint", paint.color_name)}
                      className={density === "compact" ? "h-7 px-2 text-xs" : ""}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      <div className="mt-10 text-xs text-amber-400 border-t border-zinc-800 pt-4">
        Full inventory loads via server actions (service role) + client filters + focus/refresh sync. Density toggle for large collections.
      </div>

      {/* Barcode Scanner Overlay (used for both form population and quick kit lookup) */}
      {showBarcodeScanner && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-900 rounded-2xl p-5 w-full max-w-md border border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-semibold">Scan Kit Barcode</div>
                <div className="text-xs text-zinc-500">Use the largest retail UPC/EAN barcode on the box (ignore small/internal codes)</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowBarcodeScanner(false);
                  setBarcodeScanTarget("form");
                }}
              >
                Cancel
              </Button>
            </div>

            <BarcodeScanner
              onDetected={(code) => {
                if (barcodeScanTarget === "form") {
                  handleBarcodeDetectedForForm(code);
                } else {
                  handleBarcodeDetectedForLookup(code);
                }
              }}
              onError={(err) => {
                console.warn("Scanner error:", err);
              }}
              stopOnFirstDetection={true}
            />

            <div className="mt-3 text-[10px] text-center text-zinc-500">
              Works on phone camera. Tap outside or Cancel to close.
            </div>
          </div>
        </div>
      )}

      {/* Mobile floating + Add button (FAB) for one-handed use */}
      <div className="fixed bottom-20 right-4 z-[60] md:hidden">
        <Button
          size="lg"
          className="h-14 w-14 rounded-full text-3xl shadow-xl active:scale-95"
          onClick={() => {
            setAddError(null);
            // Fire and forget; don't let refresh throw block the modal
            Promise.resolve().then(() => refreshLookups().catch(() => {})).catch(() => {});
            setShowAddModal(true);
          }}
          aria-label="Add new item"
        >
          +
        </Button>
      </div>

      {/* Add / Edit Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md border border-zinc-800">
            <h2 className="text-xl font-semibold mb-4">
              {editingItem ? "Edit Item" : "Add New Item"} <span className="text-xs text-zinc-500">(📷 camera friendly on phone/tablet)</span>
            </h2>

            <div className="mb-4">
              <label className="block text-sm mb-1">Type</label>
              <select value={addType} onChange={(e) => {
                const newType = e.target.value as any;
                setAddType(newType);
                setAddError(null);
                setAddName("");
                setAddBarcode("");
                if (editingItem) {
                  // Switching type while editing → exit edit mode
                  setEditingItem(null);
                }
              }} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2">
                <option value="part">Aftermarket Part</option>
                <option value="kit">Kit</option>
                <option value="paint">Paint</option>
              </select>
            </div>

            {addError && (
              <div className="mb-3 rounded-lg border border-red-500/50 bg-red-950/30 p-3 text-sm text-red-400">
                {addError}
              </div>
            )}

            {/* Aftermarket Part Form */}
            {addType === "part" && (
              <form
                key={editingItem ? `edit-part-${editingItem.id}-${editFormKey}` : `add-part-${editFormKey}`}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget as HTMLFormElement);
                  await handleAdd(fd);
                }}
                className="space-y-3"
              >
                {editingItem && <input type="hidden" name="id" value={editingItem.id} />}

                {/* Image Upload for Parts */}
                <div className="space-y-2 pb-2 border-b border-zinc-800">
                  <div className="text-sm font-medium text-zinc-300">Image <span className="text-xs text-zinc-500">(tap button below to use phone/tablet camera)</span></div>
                  
                  {currentImageUrl && !selectedImage && (
                    <div className="flex items-center gap-3">
                      <img 
                        src={currentImageUrl} 
                        alt="Current" 
                        className="h-16 w-16 rounded object-cover border border-zinc-700" 
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentImageUrl(null);
                          setSelectedImage(null);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  )}

                  <input
                    ref={partImageRef}
                    type="file"
                    name="image"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file && file.size > MAX_IMAGE_SIZE) {
                        setAddError("Image is too large. Maximum size is 5MB.");
                        e.target.value = ""; // clear the input
                        setSelectedImage(null);
                        return;
                      }
                      setSelectedImage(file);
                      if (addError?.includes("Image is too large")) setAddError(null);
                    }}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => partImageRef.current?.click()}
                    className="w-full text-sm py-3 active:scale-[0.98] transition-transform"
                  >
                    📷 Take Photo (camera) or Choose Image
                  </Button>
                  {selectedImage && (
                    <div className="text-xs text-emerald-400">
                      Selected: {selectedImage.name}
                    </div>
                  )}
                </div>

                {editingItem ? (
                  // Fully controlled when editing
                  <>
                    <input
                      type="text"
                      name="name"
                      placeholder="Part Name *"
                      required
                      value={formValues?.name ?? ""}
                      onChange={(e) => setFormValues((prev: any) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        name="manufacturerId"
                        value={formValues?.manufacturer_id ?? ""}
                        onChange={(e) => setFormValues((prev: any) => ({ ...prev, manufacturer_id: e.target.value }))}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                      >
                        <option value="">Manufacturer (optional)</option>
                        {lookupData.manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <select
                        name="scaleId"
                        value={formValues?.scale_id ?? ""}
                        onChange={(e) => setFormValues((prev: any) => ({ ...prev, scale_id: e.target.value }))}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                      >
                        <option value="">Scale (optional)</option>
                        {lookupData.scales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <select
                      name="partTypeId"
                      value={formValues?.part_type_id ?? ""}
                      onChange={(e) => setFormValues((prev: any) => ({ ...prev, part_type_id: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    >
                      <option value="">Part Type (optional)</option>
                      {lookupData.partTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        name="quantity"
                        placeholder="Quantity"
                        value={formValues?.quantity_owned ?? 0}
                        onChange={(e) => setFormValues((prev: any) => ({ ...prev, quantity_owned: parseInt(e.target.value) || 0 }))}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                      />
                      <select
                        name="locationId"
                        value={formValues?.location_id ?? ""}
                        onChange={(e) => setFormValues((prev: any) => ({ ...prev, location_id: e.target.value }))}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                      >
                        <option value="">Location (optional)</option>
                        {lookupData.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>

                    {/* Purchase Info + Current Value */}
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" name="pricePaid" placeholder="Price Paid" step="0.01" value={formValues?.price_paid ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, price_paid: e.target.value ? parseFloat(e.target.value) : null }))} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                      <input type="date" name="purchaseDate" value={formValues?.purchase_date ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, purchase_date: e.target.value }))} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex gap-1">
                      <select name="purchaseSourceId" value={formValues?.purchase_source_id ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, purchase_source_id: e.target.value }))} className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                        <option value="">Purchase Source</option>
                        {lookupData.purchaseSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <Button type="button" variant="outline" size="sm" onClick={() => { const val = prompt("New purchase source:"); if (val) createPurchaseSource(val).then(() => refreshLookups()); }} className="px-2">+</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" name="currentValue" placeholder="Current Value" step="0.01" value={formValues?.current_value ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, current_value: e.target.value ? parseFloat(e.target.value) : null }))} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                      <input type="date" name="valueLastUpdated" value={formValues?.value_last_updated ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, value_last_updated: e.target.value }))} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                    </div>

                    <textarea
                      name="notes"
                      placeholder="Notes"
                      value={formValues?.notes ?? ""}
                      onChange={(e) => setFormValues((prev: any) => ({ ...prev, notes: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                      rows={2}
                    />

                    <select
                      name="designedForKitId"
                      value={formValues?.designed_for_kit_id ?? ""}
                      onChange={(e) => setFormValues((prev: any) => ({ ...prev, designed_for_kit_id: e.target.value || null }))}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    >
                      <option value="">Designed for kit (optional — e.g. specific photoetch set for one model)</option>
                      {kits.map((k: any) => (
                        <option key={k.id} value={k.id}>
                          {k.name}{k.scale?.name ? ` (${k.scale.name})` : ""}{k.manufacturer?.name ? ` — ${k.manufacturer.name}` : ""}
                        </option>
                      ))}
                    </select>

                    <label className="flex items-center gap-2 text-sm text-zinc-300 pt-1">
                      <input 
                        type="checkbox" 
                        name="excludeFromOutOfStock" 
                        className="rounded" 
                        checked={!!formValues?.exclude_from_out_of_stock}
                        onChange={(e) => setFormValues((prev: any) => ({ ...prev, exclude_from_out_of_stock: e.target.checked }))}
                      />
                      Exclude from Out of Stock alerts (specialized/project-specific item, e.g. photoetch for one model)
                    </label>
                  </>
                ) : (
                  // Uncontrolled for Add (keeps it simple)
                  <>
                    <input 
                      type="text" 
                      name="name" 
                      placeholder="Part Name *" 
                      required 
                      value={addName}
                      onChange={(e) => {
                        setAddName(e.target.value);
                      }}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" 
                    />
                    {/* Basic duplication awareness */}
                    {addName.length > 3 && (() => {
                      const dups = findPotentialDuplicates(addName);
                      return dups.length > 0 ? (
                        <div className="mt-1 p-2 bg-amber-950/40 border border-amber-600/50 rounded text-xs text-amber-300">
                          Possible duplicate(s) found:
                          {dups.map((d, i) => (
                            <div key={i} className="ml-2">• {d.name || d.color_name} {d.loc?.name ? `(${d.loc.name})` : ''}</div>
                          ))}
                        </div>
                      ) : null;
                    })()}
                    <div className="grid grid-cols-2 gap-3">
                      <select name="manufacturerId" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                        <option value="">Manufacturer (optional)</option>
                        {lookupData.manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <select name="scaleId" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                        <option value="">Scale (optional)</option>
                        {lookupData.scales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <select name="partTypeId" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                      <option value="">Part Type (optional)</option>
                      {lookupData.partTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" name="quantity" placeholder="Quantity" defaultValue="1" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                      <select name="locationId" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                        <option value="">Location (optional)</option>
                        {lookupData.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>

                    {/* Purchase & Value */}
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" name="pricePaid" placeholder="Price Paid" step="0.01" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                      <input type="date" name="purchaseDate" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex gap-1">
                      <select name="purchaseSourceId" className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                        <option value="">Purchase Source</option>
                        {lookupData.purchaseSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <Button type="button" variant="outline" size="sm" onClick={() => { const val = prompt("New purchase source:"); if (val) createPurchaseSource(val).then(() => refreshLookups()); }} className="px-2">+</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" name="currentValue" placeholder="Current Value" step="0.01" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                      <input type="date" name="valueLastUpdated" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                    </div>

                    <textarea name="notes" placeholder="Notes" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" rows={2} />

                    <select name="designedForKitId" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                      <option value="">Designed for kit (optional — e.g. specific photoetch set for one model)</option>
                      {kits.map((k: any) => (
                        <option key={k.id} value={k.id}>
                          {k.name}{k.scale?.name ? ` (${k.scale.name})` : ""}{k.manufacturer?.name ? ` — ${k.manufacturer.name}` : ""}
                        </option>
                      ))}
                    </select>

                    <label className="flex items-center gap-2 text-sm text-zinc-300 pt-1">
                      <input type="checkbox" name="excludeFromOutOfStock" className="rounded" />
                      Exclude from Out of Stock alerts (specialized/project-specific item, e.g. photoetch for one model)
                    </label>
                  </>
                )}
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => { setAddError(null); setShowAddModal(false); setEditingItem(null); setFormValues(null); setAddBarcode(""); }} className="flex-1">Cancel</Button>
                  <Button type="submit" className="flex-1">{editingItem ? "Save Changes" : "Add Part"}</Button>
                </div>
              </form>
            )}

            {/* Kit Form */}
            {addType === "kit" && (
              <form
                key={editingItem ? `edit-kit-${editingItem.id}-${editFormKey}` : `add-kit-${editFormKey}`}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget as HTMLFormElement);
                  await handleAdd(fd);
                }}
                className="space-y-3"
              >
                {editingItem && <input type="hidden" name="id" value={editingItem.id} />}

                {/* Image Upload for Kits */}
                <div className="space-y-2 pb-2 border-b border-zinc-800">
                  <div className="text-sm font-medium text-zinc-300">Box Art <span className="text-xs text-zinc-500">(tap button below to use phone/tablet camera)</span></div>
                  
                  {currentImageUrl && !selectedImage && (
                    <div className="flex items-center gap-3">
                      <img 
                        src={currentImageUrl} 
                        alt="Current box art" 
                        className="h-16 w-16 rounded object-cover border border-zinc-700" 
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentImageUrl(null);
                          setSelectedImage(null);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  )}

                  <input
                    ref={kitImageRef}
                    type="file"
                    name="image"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file && file.size > MAX_IMAGE_SIZE) {
                        setAddError("Image is too large. Maximum size is 5MB.");
                        e.target.value = ""; // clear the input
                        setSelectedImage(null);
                        return;
                      }
                      setSelectedImage(file);
                      if (addError?.includes("Image is too large")) setAddError(null);
                    }}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => kitImageRef.current?.click()}
                    className="w-full text-sm py-3 active:scale-[0.98] transition-transform"
                  >
                    📷 Take Photo (camera) or Choose Image
                  </Button>
                  {selectedImage && (
                    <div className="text-xs text-emerald-400">
                      Selected: {selectedImage.name}
                    </div>
                  )}
                </div>

                {editingItem ? (
                  <>
                    <input
                      type="text"
                      name="name"
                      placeholder="Kit Name *"
                      required
                      value={formValues?.name ?? ""}
                      onChange={(e) => setFormValues((prev: any) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    />

                    {/* Barcode with scan button (especially useful for kits) */}
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        name="barcode"
                        placeholder="Barcode (UPC/EAN) — great for lookups"
                        value={formValues?.barcode ?? ""}
                        onChange={(e) => setFormValues((prev: any) => ({ ...prev, barcode: e.target.value }))}
                        className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBarcodeScanTarget("form");
                          setShowBarcodeScanner(true);
                        }}
                        className="whitespace-nowrap px-3"
                      >
                        📷 Scan
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <select
                        name="manufacturerId"
                        value={formValues?.manufacturer_id ?? ""}
                        onChange={(e) => setFormValues((prev: any) => ({ ...prev, manufacturer_id: e.target.value }))}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                      >
                        <option value="">Manufacturer</option>
                        {lookupData.manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <select
                        name="scaleId"
                        value={formValues?.scale_id ?? ""}
                        onChange={(e) => setFormValues((prev: any) => ({ ...prev, scale_id: e.target.value }))}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                      >
                        <option value="">Scale</option>
                        {lookupData.scales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <select
                      name="kitTypeId"
                      value={formValues?.kit_type_id ?? ""}
                      onChange={(e) => setFormValues((prev: any) => ({ ...prev, kit_type_id: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    >
                      <option value="">Kit Type</option>
                      {lookupData.kitTypes.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                    </select>
                    <select
                      name="status"
                      value={formValues?.status ?? "in_stash"}
                      onChange={(e) => setFormValues((prev: any) => ({ ...prev, status: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    >
                      <option value="in_stash">In Stash</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        name="quantity"
                        placeholder="Quantity"
                        value={formValues?.quantity_owned ?? 0}
                        onChange={(e) => setFormValues((prev: any) => ({ ...prev, quantity_owned: parseInt(e.target.value) || 0 }))}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                      />
                      <select
                        name="locationId"
                        value={formValues?.location_id ?? ""}
                        onChange={(e) => setFormValues((prev: any) => ({ ...prev, location_id: e.target.value }))}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                      >
                        <option value="">Location (optional)</option>
                        {lookupData.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>

                    {/* Purchase & Value for Kits (edit) */}
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" name="pricePaid" placeholder="Price Paid" step="0.01" value={formValues?.price_paid ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, price_paid: e.target.value ? parseFloat(e.target.value) : null }))} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                      <input type="date" name="purchaseDate" value={formValues?.purchase_date ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, purchase_date: e.target.value }))} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex gap-1">
                      <select name="purchaseSourceId" value={formValues?.purchase_source_id ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, purchase_source_id: e.target.value }))} className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                        <option value="">Purchase Source</option>
                        {lookupData.purchaseSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <Button type="button" variant="outline" size="sm" onClick={() => { const val = prompt("New purchase source:"); if (val) createPurchaseSource(val).then(() => refreshLookups()); }} className="px-2">+</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" name="currentValue" placeholder="Current Value" step="0.01" value={formValues?.current_value ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, current_value: e.target.value ? parseFloat(e.target.value) : null }))} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                      <input type="date" name="valueLastUpdated" value={formValues?.value_last_updated ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, value_last_updated: e.target.value }))} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                    </div>
                  </>
                ) : (
                  <>
                    <input 
                      type="text" 
                      name="name" 
                      placeholder="Kit Name *" 
                      required 
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" 
                    />

                    {/* Barcode for new kit add */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="barcode"
                        placeholder="Barcode (UPC/EAN)"
                        value={addBarcode}
                        onChange={(e) => setAddBarcode(e.target.value)}
                        className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBarcodeScanTarget("form");
                          setShowBarcodeScanner(true);
                        }}
                        className="whitespace-nowrap"
                      >
                        Scan
                      </Button>
                    </div>

                    {addName.length > 3 && addType === "kit" && (() => {
                      const dups = findPotentialDuplicates(addName, undefined, undefined, "kit");
                      return dups.length > 0 ? (
                        <div className="mt-1 p-2 bg-amber-950/40 border border-amber-600/50 rounded text-xs text-amber-300">
                          Possible duplicate(s):
                          {dups.map((d, i) => (
                            <div key={i} className="ml-2">• {d.name} {d.loc?.name ? `(${d.loc.name})` : ''}</div>
                          ))}
                        </div>
                      ) : null;
                    })()}
                    <div className="grid grid-cols-2 gap-3">
                      <select name="manufacturerId" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                        <option value="">Manufacturer</option>
                        {lookupData.manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <select name="scaleId" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                        <option value="">Scale</option>
                        {lookupData.scales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <select name="kitTypeId" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                      <option value="">Kit Type</option>
                      {lookupData.kitTypes.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                    </select>
                    <select name="status" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                      <option value="in_stash">In Stash</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        name="quantity"
                        placeholder="Quantity"
                        defaultValue={1}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                      />
                      <select name="locationId" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                        <option value="">Location (optional)</option>
                        {lookupData.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>

                    {/* Purchase & Value for Kits */}
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" name="pricePaid" placeholder="Price Paid" step="0.01" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                      <input type="date" name="purchaseDate" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex gap-1">
                      <select name="purchaseSourceId" className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                        <option value="">Purchase Source</option>
                        {lookupData.purchaseSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <Button type="button" variant="outline" size="sm" onClick={() => { const val = prompt("New purchase source:"); if (val) createPurchaseSource(val).then(() => refreshLookups()); }} className="px-2">+</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" name="currentValue" placeholder="Current Value" step="0.01" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                      <input type="date" name="valueLastUpdated" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                    </div>
                  </>
                )}
                <textarea
                  name="notes"
                  placeholder="Notes"
                  value={formValues?.notes ?? ""}
                  onChange={(e) => setFormValues((prev: any) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  rows={2}
                />
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => { setAddError(null); setShowAddModal(false); setEditingItem(null); setFormValues(null); setAddBarcode(""); }} className="flex-1">Cancel</Button>
                  <Button type="submit" className="flex-1">{editingItem ? "Save Changes" : "Add Kit"}</Button>
                </div>
              </form>
            )}

            {/* Paint Form */}
            {addType === "paint" && (
              <form
                key={editingItem ? `edit-paint-${editingItem.id}-${editFormKey}` : `add-paint-${editFormKey}`}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget as HTMLFormElement);
                  await handleAdd(fd);
                }}
                className="space-y-3"
              >
                {editingItem && <input type="hidden" name="id" value={editingItem.id} />}

                {/* Paint Type + Quantity moved to the top as requested */}
                <div className="grid grid-cols-2 gap-3">
                  <select
                    name="paintTypeId"
                    value={formValues?.paint_type_id ?? ""}
                    onChange={(e) => setFormValues((prev: any) => ({ ...prev, paint_type_id: e.target.value }))}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  >
                    <option value="">Paint Type</option>
                    {lookupData.paintTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input
                    type="number"
                    name="quantity"
                    placeholder="Quantity"
                    value={formValues?.quantity_owned ?? 0}
                    onChange={(e) => setFormValues((prev: any) => ({ ...prev, quantity_owned: parseInt(e.target.value) || 0 }))}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  />
                </div>

                <select
                  name="paintBrandId"
                  value={formValues?.paint_brand_id ?? ""}
                  onChange={(e) => setFormValues((prev: any) => ({ ...prev, paint_brand_id: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                >
                  <option value="">Paint Brand (optional)</option>
                  {lookupData.paintBrands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  name="colorName"
                  placeholder="Color Name *"
                  required
                  value={formValues?.color_name ?? ""}
                  onChange={(e) => {
                    setFormValues((prev: any) => ({ ...prev, color_name: e.target.value }));
                    if (addType === "paint") setAddName(e.target.value);
                  }}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
                {addName.length > 3 && addType === "paint" && (() => {
                  const dups = findPotentialDuplicates(addName, undefined, undefined, "paint");
                  return dups.length > 0 ? (
                    <div className="mt-1 p-2 bg-amber-950/40 border border-amber-600/50 rounded text-xs text-amber-300">
                      Possible duplicate(s):
                      {dups.map((d, i) => (
                        <div key={i} className="ml-2">• {d.color_name} {d.loc?.name ? `(${d.loc.name})` : ''}</div>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* Color Reference Numbers */}
                <div className="space-y-2">
                  <div className="text-xs text-zinc-400 font-medium">Color Reference Numbers (optional)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      name="series"
                      placeholder="Series"
                      value={formValues?.series ?? ""}
                      onChange={(e) => setFormValues((prev: any) => ({ ...prev, series: e.target.value }))}
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      name="fsNumber"
                      placeholder="FS#"
                      value={formValues?.fs_number ?? ""}
                      onChange={(e) => setFormValues((prev: any) => ({ ...prev, fs_number: e.target.value }))}
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      name="ralNumber"
                      placeholder="RAL#"
                      value={formValues?.ral_number ?? ""}
                      onChange={(e) => setFormValues((prev: any) => ({ ...prev, ral_number: e.target.value }))}
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      name="rlmNumber"
                      placeholder="RLM#"
                      value={formValues?.rlm_number ?? ""}
                      onChange={(e) => setFormValues((prev: any) => ({ ...prev, rlm_number: e.target.value }))}
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      name="anaNumber"
                      placeholder="ANA#"
                      value={formValues?.ana_number ?? ""}
                      onChange={(e) => setFormValues((prev: any) => ({ ...prev, ana_number: e.target.value }))}
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm col-span-2"
                    />
                  </div>
                </div>

                <select
                  name="locationId"
                  value={formValues?.location_id ?? ""}
                  onChange={(e) => setFormValues((prev: any) => ({ ...prev, location_id: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                >
                  <option value="">Location (optional)</option>
                  {lookupData.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>

                {/* Purchase & Value for Paint */}
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" name="pricePaid" placeholder="Price Paid" step="0.01" value={formValues?.price_paid ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, price_paid: e.target.value ? parseFloat(e.target.value) : null }))} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                  <input type="date" name="purchaseDate" value={formValues?.purchase_date ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, purchase_date: e.target.value }))} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-1">
                  <select name="purchaseSourceId" value={formValues?.purchase_source_id ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, purchase_source_id: e.target.value }))} className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                    <option value="">Purchase Source</option>
                    {lookupData.purchaseSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={() => { const val = prompt("New purchase source:"); if (val) createPurchaseSource(val).then(() => refreshLookups()); }} className="px-2">+</Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" name="currentValue" placeholder="Current Value" step="0.01" value={formValues?.current_value ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, current_value: e.target.value ? parseFloat(e.target.value) : null }))} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                  <input type="date" name="valueLastUpdated" value={formValues?.value_last_updated ?? ""} onChange={(e) => setFormValues((prev: any) => ({ ...prev, value_last_updated: e.target.value }))} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                </div>

                <textarea
                  name="notes"
                  placeholder="Notes"
                  value={formValues?.notes ?? ""}
                  onChange={(e) => setFormValues((prev: any) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  rows={2}
                />

                <select
                  name="designedForKitId"
                  value={formValues?.designed_for_kit_id ?? ""}
                  onChange={(e) => setFormValues((prev: any) => ({ ...prev, designed_for_kit_id: e.target.value || null }))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                >
                  <option value="">Designed for kit (optional — e.g. specific photoetch set for one model)</option>
                  {kits.map((k: any) => (
                    <option key={k.id} value={k.id}>
                      {k.name}{k.scale?.name ? ` (${k.scale.name})` : ""}{k.manufacturer?.name ? ` — ${k.manufacturer.name}` : ""}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-2 text-sm text-zinc-300 pt-1">
                  <input 
                    type="checkbox" 
                    name="excludeFromOutOfStock" 
                    className="rounded" 
                    checked={!!formValues?.exclude_from_out_of_stock}
                    onChange={(e) => setFormValues((prev: any) => ({ ...prev, exclude_from_out_of_stock: e.target.checked }))}
                  />
                  Exclude from Out of Stock alerts (specialized/project-specific item, e.g. photoetch for one model)
                </label>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => { setAddError(null); setShowAddModal(false); setEditingItem(null); setFormValues(null); setAddBarcode(""); }} className="flex-1">Cancel</Button>
                  <Button type="submit" className="flex-1">{editingItem ? "Save Changes" : "Add Paint"}</Button>
                </div>
              </form>
            )}

            {/* Quick Add Lookups — simple form like you had in Access */}
            <div className="mt-6 pt-4 border-t border-zinc-700">
              <div className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                Quick Add Lookups
                <span className="text-[10px] text-zinc-500 font-normal">(new values appear in dropdowns immediately)</span>
              </div>

              {quickAddFeedback && (
                <div className="mb-2 text-xs text-emerald-400">{quickAddFeedback}</div>
              )}

              <div className="grid grid-cols-2 gap-2 w-full">
                {/* Shared: Manufacturer + Scale (Parts & Kits) */}
                {(addType === "part" || addType === "kit") && (
                  <>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="New Manufacturer"
                        value={quickAddValues.manufacturer}
                        onChange={(e) => updateQuickAdd("manufacturer", e.target.value)}
                        className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                        onKeyDown={(e) => e.key === "Enter" && handleQuickAdd("manufacturer")}
                      />
                      <Button type="button" variant="outline" onClick={() => handleQuickAdd("manufacturer")} className="h-6 w-6 p-0 text-xs flex items-center justify-center flex-shrink-0">+</Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="New Scale (e.g. 1/48)"
                        value={quickAddValues.scale}
                        onChange={(e) => updateQuickAdd("scale", e.target.value)}
                        className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                        onKeyDown={(e) => e.key === "Enter" && handleQuickAdd("scale")}
                      />
                      <Button type="button" variant="outline" onClick={() => handleQuickAdd("scale")} className="h-6 w-6 p-0 text-xs flex items-center justify-center flex-shrink-0">+</Button>
                    </div>
                  </>
                )}

                {/* Part-specific */}
                {addType === "part" && (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="New Part Type"
                      value={quickAddValues.partType}
                      onChange={(e) => updateQuickAdd("partType", e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                      onKeyDown={(e) => e.key === "Enter" && handleQuickAdd("partType")}
                    />
                    <Button type="button" variant="outline" onClick={() => handleQuickAdd("partType")} className="h-6 w-6 p-0 text-xs flex items-center justify-center flex-shrink-0">+</Button>
                  </div>
                )}

                {/* Kit-specific */}
                {addType === "kit" && (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="New Kit Type"
                      value={quickAddValues.kitType}
                      onChange={(e) => updateQuickAdd("kitType", e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                      onKeyDown={(e) => e.key === "Enter" && handleQuickAdd("kitType")}
                    />
                    <Button type="button" variant="outline" onClick={() => handleQuickAdd("kitType")} className="h-6 w-6 p-0 text-xs flex items-center justify-center flex-shrink-0">+</Button>
                  </div>
                )}

                {/* Paint-specific */}
                {addType === "paint" && (
                  <>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="New Paint Type"
                        value={quickAddValues.paintType}
                        onChange={(e) => updateQuickAdd("paintType", e.target.value)}
                        className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                        onKeyDown={(e) => e.key === "Enter" && handleQuickAdd("paintType")}
                      />
                      <Button type="button" variant="outline" onClick={() => handleQuickAdd("paintType")} className="h-6 w-6 p-0 text-xs flex items-center justify-center flex-shrink-0">+</Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="New Paint Brand"
                        value={quickAddValues.paintBrand}
                        onChange={(e) => updateQuickAdd("paintBrand", e.target.value)}
                        className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                        onKeyDown={(e) => e.key === "Enter" && handleQuickAdd("paintBrand")}
                      />
                      <Button type="button" variant="outline" onClick={() => handleQuickAdd("paintBrand")} className="h-6 w-6 p-0 text-xs flex items-center justify-center flex-shrink-0">+</Button>
                    </div>
                  </>
                )}

                {/* Location is useful for all types */}
                <div className="flex items-center gap-1 col-span-2">
                  <input
                    type="text"
                    placeholder="New Location"
                    value={quickAddValues.location}
                    onChange={(e) => updateQuickAdd("location", e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                    onKeyDown={(e) => e.key === "Enter" && handleQuickAdd("location")}
                  />
                  <Button type="button" variant="outline" onClick={() => handleQuickAdd("location")} className="h-6 w-6 p-0 text-xs flex items-center justify-center flex-shrink-0">+</Button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border border-zinc-800">
            <h2 className="text-xl font-semibold mb-3 text-red-400">
              Confirm Delete
            </h2>

            <div className="mb-6 text-zinc-300">
              Are you sure you want to permanently delete{" "}
              <span className="font-medium text-white">
                “{deleteConfirm.name}”
              </span>
              ?
            </div>

            <div className="text-sm text-zinc-400 mb-6">
              This action cannot be undone.
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={confirmDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {stockAdjust && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border border-zinc-800">
            <h2 className="text-xl font-semibold mb-2">Adjust Stock</h2>

            <div className="mb-4">
              <div className="text-sm text-zinc-400">Item</div>
              <div className="font-medium text-white">{stockAdjust.name}</div>
            </div>

            <div className="mb-4">
              <div className="text-sm text-zinc-400">Current Total Owned</div>
              <div className="text-2xl font-semibold tabular-nums">{stockAdjust.current}</div>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-zinc-400 mb-1">
                Adjustment (positive or negative)
              </label>
              <input
                type="number"
                value={stockAdjustAmount}
                onChange={(e) => setStockAdjustAmount(parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-lg tabular-nums"
              />
              <div className="text-xs text-zinc-500 mt-1">
                Example: 5 to add, -2 to remove
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStockAdjust(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={confirmStockAdjust}
                disabled={stockAdjustAmount === 0}
              >
                Apply Change
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Kit Details Modal — focused on large box art + useful info */}
      {viewingKit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-3xl border border-zinc-800 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start p-6 pb-4 border-b border-zinc-800">
              <div>
                <div className="text-sm text-zinc-400">Kit Details</div>
                <h2 className="text-2xl font-semibold mt-1">{viewingKit.name}</h2>
                <div className="text-sm text-zinc-400 mt-1">
                  {[viewingKit.kit_type?.name, viewingKit.scale?.name, viewingKit.manufacturer?.name]
                    .filter(Boolean)
                    .join(" • ")}
                  {viewingKit.barcode && (
                    <span className="ml-3 font-mono text-amber-400/80">{viewingKit.barcode}</span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={closeKitDetails}
              >
                Close
              </Button>
            </div>

            {/* Large Box Art */}
            {viewingKit.box_art_url ? (
              <div className="p-6 flex justify-center bg-zinc-950">
                <img
                  src={viewingKit.box_art_url}
                  alt={viewingKit.name}
                  className="max-h-[420px] w-auto max-w-full rounded-xl border border-zinc-700 object-contain shadow-lg"
                />
              </div>
            ) : (
              <div className="p-12 text-center bg-zinc-950">
                <div className="text-6xl mb-3">📦</div>
                <div className="text-zinc-400">No box art uploaded yet</div>
              </div>
            )}

            <div className="p-6 space-y-6">
              {/* Status + Location */}
              <div className="flex flex-wrap gap-4">
                <div>
                  <div className="text-xs text-zinc-400 mb-1">Status</div>
                  <div className="inline-block px-3 py-1 rounded-full bg-zinc-800 text-sm font-medium capitalize">
                    {viewingKit.status?.replace("_", " ")}
                  </div>
                </div>
                {viewingKit.loc?.name && (
                  <div>
                    <div className="text-xs text-zinc-400 mb-1">Location</div>
                    <div className="text-sm font-medium">{viewingKit.loc.name}</div>
                  </div>
                )}
              </div>

              {/* Stock Breakdown */}
              <div>
                <div className="text-xs text-zinc-400 mb-2">Stock</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(() => {
                    const owned = viewingKit.quantity_owned ?? 0;
                    const allocated = viewingKit.quantity_allocated ?? 0;
                    const used = viewingKit.quantity_used ?? 0;
                    const available = Math.max(0, owned - allocated - used);
                    return (
                      <>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                          <div className="text-xs text-zinc-400">Owned</div>
                          <div className="text-3xl font-semibold tabular-nums mt-1">{owned}</div>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                          <div className="text-xs text-emerald-400">Available</div>
                          <div className="text-3xl font-semibold tabular-nums text-emerald-400 mt-1">{available}</div>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                          <div className="text-xs text-violet-400">Allocated</div>
                          <div className="text-3xl font-semibold tabular-nums text-violet-400 mt-1">{allocated}</div>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                          <div className="text-xs text-amber-400">Used</div>
                          <div className="text-3xl font-semibold tabular-nums text-amber-400 mt-1">{used}</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Projects this kit is allocated to */}
              <div>
                <div className="text-xs text-zinc-400 mb-2">Allocated to Projects</div>
                {itemProjectAllocations.length > 0 ? (
                  <div className="space-y-2">
                    {itemProjectAllocations.map((alloc) => {
                      const proj = alloc.project;
                      return (
                        <div
                          key={alloc.id}
                          onClick={() => {
                            if (proj?.id) {
                              router.push(`/projects?project=${proj.id}`);
                            }
                          }}
                          className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm cursor-pointer hover:border-amber-600/60 hover:bg-zinc-900 transition-colors"
                          title="Open project"
                        >
                          <div>
                            <span className="font-medium">{proj?.name || "Unknown project"}</span>
                            {proj?.status && (
                              <span className="ml-2 text-xs text-zinc-400 capitalize">({proj.status})</span>
                            )}
                          </div>
                          <div className="text-right text-xs text-zinc-400">
                            Qty: <span className="font-semibold text-white">{alloc.quantity}</span>
                            <div>Allocated {new Date(alloc.allocated_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                    This kit is not currently allocated to any projects.
                  </div>
                )}
              </div>

              {/* Parts & paints designed specifically for this kit (metadata only — does not allocate or affect stock) */}
              <div>
                <div className="text-xs text-zinc-400 mb-2">Parts &amp; paints designed for this kit</div>
                {(() => {
                  const assocParts = parts.filter((p: any) =>
                    (p.designed_for_kit && p.designed_for_kit.id === viewingKit.id) || p.designed_for_kit_id === viewingKit.id
                  );
                  const assocPaints = paints.filter((p: any) =>
                    (p.designed_for_kit && p.designed_for_kit.id === viewingKit.id) || p.designed_for_kit_id === viewingKit.id
                  );

                  if (assocParts.length === 0 && assocPaints.length === 0) {
                    return (
                      <div className="text-sm text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                        No parts or paints are currently marked as designed specifically for this kit.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {assocParts.map((p: any) => {
                        const avail = Math.max(0, (p.quantity_owned || 0) - (p.quantity_allocated || 0) - (p.quantity_used || 0));
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              closeKitDetails();
                              openPartDetails(p);
                            }}
                            className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm cursor-pointer hover:border-violet-600/50 active:bg-zinc-900"
                          >
                            {p.image_url && (
                              <img
                                src={p.image_url}
                                alt=""
                                className="w-8 h-8 rounded object-cover border border-zinc-700 flex-shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1 truncate">
                              {p.name}{" "}
                              <span className="text-[10px] text-zinc-500">({p.part_type?.name || "part"})</span>
                            </div>
                            <div className="text-xs text-emerald-400 tabular-nums flex-shrink-0 ml-2">{avail} avail</div>
                          </div>
                        );
                      })}
                      {assocPaints.map((p: any) => {
                        const avail = Math.max(0, (p.quantity_owned || 0) - (p.quantity_allocated || 0) - (p.quantity_used || 0));
                        const brand = p.paint_brand?.name || p.brand;
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              closeKitDetails();
                              openPaintDetails(p);
                            }}
                            className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm cursor-pointer hover:border-violet-600/50 active:bg-zinc-900"
                          >
                            <div className="min-w-0 flex-1 truncate">
                              {p.color_name}{" "}
                              <span className="text-[10px] text-zinc-500">({brand || "paint"})</span>
                            </div>
                            <div className="text-xs text-emerald-400 tabular-nums flex-shrink-0 ml-2">{avail} avail</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                <div className="text-[10px] text-zinc-500 mt-1">
                  Linked via the “Designed for kit” field on the part/paint record (pure metadata).
                </div>
              </div>

              {/* Notes */}
              {viewingKit.notes && (
                <div>
                  <div className="text-xs text-zinc-400 mb-1.5">Notes</div>
                  <div className="text-sm text-zinc-200 whitespace-pre-wrap bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                    {viewingKit.notes}
                  </div>
                </div>
              )}

              {/* Purchase & Value Info */}
              {(viewingKit.price_paid != null ||
                viewingKit.current_value != null ||
                viewingKit.purchase_source?.name ||
                viewingKit.purchase_date) && (
                <div>
                  <div className="text-xs text-zinc-400 mb-2">Purchase & Value</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {viewingKit.price_paid != null && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                        Price Paid: <span className="font-medium tabular-nums">${viewingKit.price_paid}</span>
                      </div>
                    )}
                    {viewingKit.current_value != null && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                        Current Value: <span className="font-medium tabular-nums">${viewingKit.current_value}</span>
                      </div>
                    )}
                    {viewingKit.purchase_date && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                        Purchased: {new Date(viewingKit.purchase_date).toLocaleDateString()}
                      </div>
                    )}
                    {viewingKit.purchase_source?.name && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                        Source: {viewingKit.purchase_source.name}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex flex-col sm:flex-row gap-3 p-6 pt-2 border-t border-zinc-800">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  closeKitDetails();
                  openEdit(viewingKit, "kit");
                }}
              >
                Edit Kit
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  closeKitDetails();
                  openStockAdjust(viewingKit.id, "kit", viewingKit.name, viewingKit.quantity_owned ?? 0);
                }}
              >
                Adjust Stock
              </Button>
              <Button
                className="flex-1"
                onClick={closeKitDetails}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Part Details Modal */}
      {viewingPart && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-3xl border border-zinc-800 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start p-6 pb-4 border-b border-zinc-800">
              <div>
                <div className="text-sm text-zinc-400">Part Details</div>
                <h2 className="text-2xl font-semibold mt-1">{viewingPart.name}</h2>
                <div className="text-sm text-zinc-400 mt-1">
                  {[viewingPart.part_type?.name, viewingPart.scale?.name, viewingPart.manufacturer?.name]
                    .filter(Boolean)
                    .join(" • ")}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={closePartDetails}>Close</Button>
            </div>

            {/* Large Image */}
            {viewingPart.image_url ? (
              <div className="p-6 flex justify-center bg-zinc-950">
                <img
                  src={viewingPart.image_url}
                  alt={viewingPart.name}
                  className="max-h-[380px] w-auto max-w-full rounded-xl border border-zinc-700 object-contain shadow-lg"
                />
              </div>
            ) : (
              <div className="p-10 text-center bg-zinc-950">
                <div className="text-5xl mb-2">🔧</div>
                <div className="text-zinc-400 text-sm">No image uploaded</div>
              </div>
            )}

            <div className="p-6 space-y-6">
              {/* Stock */}
              <div>
                <div className="text-xs text-zinc-400 mb-2">Stock</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(() => {
                    const owned = viewingPart.quantity_owned ?? 0;
                    const allocated = viewingPart.quantity_allocated ?? 0;
                    const used = viewingPart.quantity_used ?? 0;
                    const available = Math.max(0, owned - allocated - used);
                    return (
                      <>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                          <div className="text-xs text-zinc-400">Owned</div>
                          <div className="text-3xl font-semibold tabular-nums mt-1">{owned}</div>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                          <div className="text-xs text-emerald-400">Available</div>
                          <div className="text-3xl font-semibold tabular-nums text-emerald-400 mt-1">{available}</div>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                          <div className="text-xs text-violet-400">Allocated</div>
                          <div className="text-3xl font-semibold tabular-nums text-violet-400 mt-1">{allocated}</div>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                          <div className="text-xs text-amber-400">Used</div>
                          <div className="text-3xl font-semibold tabular-nums text-amber-400 mt-1">{used}</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Allocated to Projects */}
              <div>
                <div className="text-xs text-zinc-400 mb-2">Allocated to Projects</div>
                {itemProjectAllocations.length > 0 ? (
                  <div className="space-y-2">
                    {itemProjectAllocations.map((alloc) => {
                      const proj = alloc.project;
                      return (
                        <div
                          key={alloc.id}
                          onClick={() => {
                            if (proj?.id) {
                              router.push(`/projects?project=${proj.id}`);
                            }
                          }}
                          className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm cursor-pointer hover:border-amber-600/60 hover:bg-zinc-900 transition-colors"
                          title="Open project"
                        >
                          <div>
                            <span className="font-medium">{proj?.name || "Unknown project"}</span>
                            {proj?.status && <span className="ml-2 text-xs text-zinc-400 capitalize">({proj.status})</span>}
                          </div>
                          <div className="text-right text-xs text-zinc-400">
                            Qty: <span className="font-semibold text-white">{alloc.quantity}</span>
                            <div>Allocated {new Date(alloc.allocated_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                    This part is not currently allocated to any projects.
                  </div>
                )}
              </div>

              {/* Location + Notes */}
              {viewingPart.loc?.name && (
                <div>
                  <div className="text-xs text-zinc-400 mb-1">Location</div>
                  <div className="text-sm">{viewingPart.loc.name}</div>
                </div>
              )}

              {viewingPart.notes && (
                <div>
                  <div className="text-xs text-zinc-400 mb-1.5">Notes</div>
                  <div className="text-sm text-zinc-200 whitespace-pre-wrap bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                    {viewingPart.notes}
                  </div>
                </div>
              )}

              {viewingPart.exclude_from_out_of_stock && (
                <div className="text-xs text-amber-400 bg-amber-950/30 border border-amber-800/50 rounded px-3 py-1">
                  Flagged as specialized / one-time item — excluded from Out of Stock alerts
                </div>
              )}

              {viewingPart.designed_for_kit && (
                <div>
                  <div className="text-xs text-zinc-400 mb-1">Designed for</div>
                  <button
                    onClick={() => {
                      const kid = viewingPart.designed_for_kit?.id;
                      if (kid) {
                        closePartDetails();
                        router.push(`/inventory?tab=kits&view=${kid}`);
                      }
                    }}
                    className="text-sm text-violet-400 hover:text-violet-300 underline decoration-dotted"
                  >
                    {viewingPart.designed_for_kit.name}
                  </button>
                </div>
              )}

              {/* Purchase & Value */}
              {(viewingPart.price_paid != null || viewingPart.current_value != null || viewingPart.purchase_source?.name || viewingPart.purchase_date) && (
                <div>
                  <div className="text-xs text-zinc-400 mb-2">Purchase & Value</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {viewingPart.price_paid != null && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                        Price Paid: <span className="font-medium tabular-nums">${viewingPart.price_paid}</span>
                      </div>
                    )}
                    {viewingPart.current_value != null && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                        Current Value: <span className="font-medium tabular-nums">${viewingPart.current_value}</span>
                      </div>
                    )}
                    {viewingPart.purchase_date && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                        Purchased: {new Date(viewingPart.purchase_date).toLocaleDateString()}
                      </div>
                    )}
                    {viewingPart.purchase_source?.name && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                        Source: {viewingPart.purchase_source.name}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row gap-3 p-6 pt-2 border-t border-zinc-800">
              <Button variant="outline" className="flex-1" onClick={() => { closePartDetails(); openEdit(viewingPart, "part"); }}>
                Edit Part
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { closePartDetails(); openStockAdjust(viewingPart.id, "part", viewingPart.name, viewingPart.quantity_owned ?? 0); }}>
                Adjust Stock
              </Button>
              <Button className="flex-1" onClick={closePartDetails}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Paint Details Modal */}
      {viewingPaint && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-3xl border border-zinc-800 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start p-6 pb-4 border-b border-zinc-800">
              <div>
                <div className="text-sm text-zinc-400">Paint Details</div>
                <h2 className="text-2xl font-semibold mt-1">{viewingPaint.color_name}</h2>
                <div className="text-sm text-zinc-400 mt-1">
                  {[viewingPaint.paint_brand?.name || viewingPaint.brand, viewingPaint.paint_type?.name].filter(Boolean).join(" • ")}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={closePaintDetails}>Close</Button>
            </div>

            <div className="p-6 space-y-6">
              {/* Quick visual + Stock */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {/* Color reference visual */}
                <div className="md:col-span-2">
                  <div className="text-xs text-zinc-400 mb-2">Color Reference</div>
                  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {viewingPaint.paint_brand?.name && <div><span className="text-zinc-400">Brand:</span> {viewingPaint.paint_brand.name}</div>}
                      {viewingPaint.series && <div><span className="text-zinc-400">Series:</span> {viewingPaint.series}</div>}
                      {viewingPaint.fs_number && <div><span className="text-zinc-400">FS#:</span> {viewingPaint.fs_number}</div>}
                      {viewingPaint.ral_number && <div><span className="text-zinc-400">RAL#:</span> {viewingPaint.ral_number}</div>}
                      {viewingPaint.rlm_number && <div><span className="text-zinc-400">RLM#:</span> {viewingPaint.rlm_number}</div>}
                      {viewingPaint.ana_number && <div><span className="text-zinc-400">ANA#:</span> {viewingPaint.ana_number}</div>}
                      {viewingPaint.opened && <div className="text-amber-400">Opened</div>}
                    </div>
                  </div>
                </div>

                {/* Stock */}
                <div className="md:col-span-3">
                  <div className="text-xs text-zinc-400 mb-2">Stock</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(() => {
                      const owned = viewingPaint.quantity_owned ?? 0;
                      const allocated = viewingPaint.quantity_allocated ?? 0;
                      const used = viewingPaint.quantity_used ?? 0;
                      const available = Math.max(0, owned - allocated - used);
                      return (
                        <>
                          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                            <div className="text-xs text-zinc-400">Owned</div>
                            <div className="text-3xl font-semibold tabular-nums mt-1">{owned}</div>
                          </div>
                          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                            <div className="text-xs text-emerald-400">Available</div>
                            <div className="text-3xl font-semibold tabular-nums text-emerald-400 mt-1">{available}</div>
                          </div>
                          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                            <div className="text-xs text-violet-400">Allocated</div>
                            <div className="text-3xl font-semibold tabular-nums text-violet-400 mt-1">{allocated}</div>
                          </div>
                          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                            <div className="text-xs text-amber-400">Used</div>
                            <div className="text-3xl font-semibold tabular-nums text-amber-400 mt-1">{used}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Allocated to Projects */}
              <div>
                <div className="text-xs text-zinc-400 mb-2">Allocated to Projects</div>
                {itemProjectAllocations.length > 0 ? (
                  <div className="space-y-2">
                    {itemProjectAllocations.map((alloc) => {
                      const proj = alloc.project;
                      return (
                        <div
                          key={alloc.id}
                          onClick={() => {
                            if (proj?.id) {
                              router.push(`/projects?project=${proj.id}`);
                            }
                          }}
                          className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm cursor-pointer hover:border-amber-600/60 hover:bg-zinc-900 transition-colors"
                          title="Open project"
                        >
                          <div>
                            <span className="font-medium">{proj?.name || "Unknown project"}</span>
                            {proj?.status && <span className="ml-2 text-xs text-zinc-400 capitalize">({proj.status})</span>}
                          </div>
                          <div className="text-right text-xs text-zinc-400">
                            Qty: <span className="font-semibold text-white">{alloc.quantity}</span>
                            <div>Allocated {new Date(alloc.allocated_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                    This paint is not currently allocated to any projects.
                  </div>
                )}
              </div>

              {/* Location + Notes */}
              {viewingPaint.loc?.name && (
                <div>
                  <div className="text-xs text-zinc-400 mb-1">Location</div>
                  <div className="text-sm">{viewingPaint.loc.name}</div>
                </div>
              )}

              {viewingPaint.notes && (
                <div>
                  <div className="text-xs text-zinc-400 mb-1.5">Notes</div>
                  <div className="text-sm text-zinc-200 whitespace-pre-wrap bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                    {viewingPaint.notes}
                  </div>
                </div>
              )}

              {viewingPaint.exclude_from_out_of_stock && (
                <div className="text-xs text-amber-400 bg-amber-950/30 border border-amber-800/50 rounded px-3 py-1">
                  Flagged as specialized / one-time item — excluded from Out of Stock alerts
                </div>
              )}

              {viewingPaint.designed_for_kit && (
                <div>
                  <div className="text-xs text-zinc-400 mb-1">Designed for</div>
                  <button
                    onClick={() => {
                      const kid = viewingPaint.designed_for_kit?.id;
                      if (kid) {
                        closePaintDetails();
                        router.push(`/inventory?tab=kits&view=${kid}`);
                      }
                    }}
                    className="text-sm text-violet-400 hover:text-violet-300 underline decoration-dotted"
                  >
                    {viewingPaint.designed_for_kit.name}
                  </button>
                </div>
              )}

              {/* Purchase & Value */}
              {(viewingPaint.price_paid != null || viewingPaint.current_value != null || viewingPaint.purchase_source?.name || viewingPaint.purchase_date) && (
                <div>
                  <div className="text-xs text-zinc-400 mb-2">Purchase & Value</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {viewingPaint.price_paid != null && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                        Price Paid: <span className="font-medium tabular-nums">${viewingPaint.price_paid}</span>
                      </div>
                    )}
                    {viewingPaint.current_value != null && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                        Current Value: <span className="font-medium tabular-nums">${viewingPaint.current_value}</span>
                      </div>
                    )}
                    {viewingPaint.purchase_date && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                        Purchased: {new Date(viewingPaint.purchase_date).toLocaleDateString()}
                      </div>
                    )}
                    {viewingPaint.purchase_source?.name && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                        Source: {viewingPaint.purchase_source.name}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row gap-3 p-6 pt-2 border-t border-zinc-800">
              <Button variant="outline" className="flex-1" onClick={() => { closePaintDetails(); openEdit(viewingPaint, "paint"); }}>
                Edit Paint
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { closePaintDetails(); openStockAdjust(viewingPaint.id, "paint", viewingPaint.color_name, viewingPaint.quantity_owned ?? 0); }}>
                Adjust Stock
              </Button>
              <Button className="flex-1" onClick={closePaintDetails}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
