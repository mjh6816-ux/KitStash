import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import InventoryClient from "./InventoryClient";

/* eslint-disable @typescript-eslint/no-explicit-any -- fallback mappers and service fetches for schema-evolution resilience */

// Centralized single-user ID (same as in actions.ts)
const USER_ID =
  process.env.SUPABASE_USER_ID || "a8e4287a-040b-41dd-ba45-87f6a3c07395";

export default async function InventoryPage() {
  const supabase = await createClient();

  // Only fetch small lookup data on the server.
  // The actual inventory items will be loaded client-side with infinite scroll.
  const [manufacturersRes, scalesRes, partTypesRes, kitTypesRes, paintTypesRes, paintBrandsRes, locationsRes, purchaseSourcesRes] = await Promise.all([
    supabase.from("manufacturers").select("id, name").order("name"),
    supabase.from("scales").select("id, name").order("sort_order"),
    supabase.from("part_types").select("id, name").order("name"),
    supabase.from("kit_types").select("id, name").order("name"),
    supabase.from("paint_types").select("id, name").order("name"),
    supabase.from("paint_brands").select("id, name").order("name"),
    supabase.from("locations").select("id, name").order("name"),
    supabase.from("purchase_sources").select("id, name").order("name"),
  ]);

  const manufacturers = manufacturersRes.data || [];
  const scales = scalesRes.data || [];
  const partTypes = partTypesRes.data || [];
  const kitTypes = kitTypesRes.data || [];
  const paintTypes = paintTypesRes.data || [];
  const paintBrands = paintBrandsRes.data || [];
  const locations = locationsRes.data || [];
  const purchaseSources = purchaseSourcesRes.data || [];

  console.log("paintBrands fetched:", paintBrands.length, paintBrands);

  // Fetch initial inventory data server-side using service role (bypasses RLS).
  // Guarantees lists are present on first render/hydrate regardless of client auth state.
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // Helper to fetch with fallback for optional newer columns (exclude_from_out_of_stock + designed_for_kit).
  // On any error with the rich select we degrade to a core select so the page always renders lists.
  async function safeFetch(table: string, baseSelect: string, userId: string) {
    let res = await serviceSupabase.from(table).select(baseSelect).eq("user_id", userId);
    if (res.error) {
      console.warn(`safeFetch(${table}): rich select failed, falling back to core columns (run the add-*.sql migrations if you want the new flags/associations).`, res.error);
      // Strip the optional pieces from whatever select string was passed in.
      const core = baseSelect
        .replace(/,?\s*exclude_from_out_of_stock/g, "")
        .replace(/,?\s*designed_for_kit_id/g, "")
        .replace(/,?\s*designed_for_kit:kits\(id,\s*name\)/g, "");
      res = await serviceSupabase.from(table).select(core).eq("user_id", userId);
      if (res.error) {
        console.error(`safeFetch(${table}) core fallback also failed:`, res.error);
        return [];
      }
      return (res.data || []).map((r: any) => ({
        ...r,
        exclude_from_out_of_stock: false,
        designed_for_kit: null,
        designed_for_kit_id: null,
      }));
    }
    return (res.data || []).map((r: any) => ({
      ...r,
      exclude_from_out_of_stock: r.exclude_from_out_of_stock ?? false,
      designed_for_kit: r.designed_for_kit ?? null,
    }));
  }

  const [initialParts, initialKits, initialPaints] = await Promise.all([
    safeFetch(
      "aftermarket_parts",
      `id, name, notes, image_url, quantity_owned, quantity_allocated, quantity_used, location_id, price_paid, purchase_date, purchase_source_id, current_value, value_last_updated, created_at, updated_at, manufacturer_id, scale_id, part_type_id, exclude_from_out_of_stock, designed_for_kit_id, manufacturer:manufacturers(name), scale:scales(name), part_type:part_types(name), loc:locations(name), purchase_source:purchase_sources(name), designed_for_kit:kits(id, name)`,
      USER_ID
    ),
    serviceSupabase
      .from("kits")
      .select(`id, name, status, notes, barcode, box_art_url, quantity_owned, quantity_allocated, quantity_used, location_id, price_paid, purchase_date, purchase_source_id, current_value, value_last_updated, created_at, updated_at, manufacturer_id, scale_id, kit_type_id, manufacturer:manufacturers(name), scale:scales(name, sort_order), kit_type:kit_types(name), loc:locations(name), purchase_source:purchase_sources(name)`)
      .eq("user_id", USER_ID)
      .then(r => r.data || []),
    safeFetch(
      "paints",
      `id, color_name, brand, notes, quantity_owned, quantity_allocated, quantity_used, location_id, price_paid, purchase_date, purchase_source_id, current_value, value_last_updated, opened, created_at, updated_at, series, fs_number, ral_number, rlm_number, ana_number, paint_type_id, paint_brand_id, exclude_from_out_of_stock, designed_for_kit_id, paint_type:paint_types(name), paint_brand:paint_brands(name), loc:locations(name), purchase_source:purchase_sources(name), designed_for_kit:kits(id, name)`,
      USER_ID
    ),
  ]);

  console.log(`[inventory page server] initial data: parts=${initialParts.length}, kits=${initialKits.length}, paints=${initialPaints.length}`);

  return (
    <InventoryClient
      manufacturers={manufacturers}
      scales={scales}
      partTypes={partTypes}
      kitTypes={kitTypes}
      paintTypes={paintTypes}
      paintBrands={paintBrands}
      locations={locations}
      purchaseSources={purchaseSources}
      initialParts={initialParts}
      initialKits={initialKits}
      initialPaints={initialPaints}
    />
  );
}
