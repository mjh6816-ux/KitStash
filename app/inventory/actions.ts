"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

/* eslint-disable @typescript-eslint/no-explicit-any -- FormData + dynamic selects + graceful fallback for evolving schema (new columns); keeps server actions simple */

export async function receiveStock(formData: FormData) {
  const supabase = await createClient();
  const partId = formData.get("partId") as string;

  if (!partId) return;

  const { data: part } = await supabase
    .from("aftermarket_parts")
    .select("quantity_owned")
    .eq("id", partId)
    .single();

  if (!part) return;

  const newQuantity = (part.quantity_owned ?? 0) + 1;

  await supabase
    .from("aftermarket_parts")
    .update({ quantity_owned: newQuantity })
    .eq("id", partId);

  revalidatePath("/inventory");
}

export async function receivePaintStock(formData: FormData) {
  const supabase = await createClient();
  const paintId = formData.get("paintId") as string;

  if (!paintId) return;

  const { data: paint } = await supabase
    .from("paints")
    .select("quantity_owned")
    .eq("id", paintId)
    .single();

  if (!paint) return;

  const newQuantity = (paint.quantity_owned ?? 0) + 1;

  await supabase
    .from("paints")
    .update({ quantity_owned: newQuantity })
    .eq("id", paintId);

  revalidatePath("/inventory");
}

export async function adjustPartStock(formData: FormData) {
  const supabase = await createClient();
  const partId = formData.get("partId") as string;
  const amount = parseInt(formData.get("amount") as string) || 0;

  if (!partId || amount === 0) return;

  const { data: part } = await supabase
    .from("aftermarket_parts")
    .select("quantity_owned")
    .eq("id", partId)
    .single();

  if (!part) return;

  const newQuantity = Math.max(0, (part.quantity_owned ?? 0) + amount);

  await supabase
    .from("aftermarket_parts")
    .update({ quantity_owned: newQuantity })
    .eq("id", partId);

  revalidatePath("/inventory");
}

export async function adjustPaintStock(formData: FormData) {
  const supabase = await createClient();
  const paintId = formData.get("paintId") as string;
  const amount = parseInt(formData.get("amount") as string) || 0;

  if (!paintId || amount === 0) return;

  const { data: paint } = await supabase
    .from("paints")
    .select("quantity_owned")
    .eq("id", paintId)
    .single();

  if (!paint) return;

  const newQuantity = Math.max(0, (paint.quantity_owned ?? 0) + amount);

  await supabase
    .from("paints")
    .update({ quantity_owned: newQuantity })
    .eq("id", paintId);

  revalidatePath("/inventory");
}

export async function adjustKitStock(formData: FormData) {
  const supabase = await createClient();
  const kitId = formData.get("kitId") as string;
  const amount = parseInt(formData.get("amount") as string) || 0;

  if (!kitId || amount === 0) return;

  const { data: kit } = await supabase
    .from("kits")
    .select("quantity_owned")
    .eq("id", kitId)
    .single();

  if (!kit) return;

  const newQuantity = Math.max(0, (kit.quantity_owned ?? 0) + amount);

  await supabase
    .from("kits")
    .update({ quantity_owned: newQuantity })
    .eq("id", kitId);

  revalidatePath("/inventory");
}

export async function deletePart(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  if (!id) return;

  await supabase.from("aftermarket_parts").delete().eq("id", id);
  revalidatePath("/inventory");
}

export async function deleteKit(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  if (!id) return;

  await supabase.from("kits").delete().eq("id", id);
  revalidatePath("/inventory");
}

export async function deletePaint(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  if (!id) return;

  await supabase.from("paints").delete().eq("id", id);
  revalidatePath("/inventory");
}

export async function addAftermarketPart(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const quantity = parseInt(formData.get("quantity") as string) || 1;
  const locationId = formData.get("locationId") as string || null;
  const pricePaid = formData.get("pricePaid") ? parseFloat(formData.get("pricePaid") as string) : null;
  const purchaseDate = formData.get("purchaseDate") as string || null;
  const purchaseSourceId = formData.get("purchaseSourceId") as string || null;
  const currentValue = formData.get("currentValue") ? parseFloat(formData.get("currentValue") as string) : null;
  const valueLastUpdated = formData.get("valueLastUpdated") as string || null;
  const notes = formData.get("notes") as string || null;
  const manufacturerId = formData.get("manufacturerId") as string || null;
  const scaleId = formData.get("scaleId") as string || null;
  const partTypeId = formData.get("partTypeId") as string || null;
  const imageUrl = formData.get("image_url") as string || null;
  const excludeFromOutOfStock = formData.get("excludeFromOutOfStock") === "on";
  const designedForKitId = formData.get("designedForKitId") as string || null;

  if (!name) {
    throw new Error("Part name is required");
  }

  const insertData: any = {
    user_id: USER_ID,
    name,
    quantity_owned: quantity,
    location_id: locationId,
    price_paid: pricePaid,
    purchase_date: purchaseDate,
    purchase_source_id: purchaseSourceId,
    current_value: currentValue,
    value_last_updated: valueLastUpdated,
    notes,
    manufacturer_id: manufacturerId,
    scale_id: scaleId,
    part_type_id: partTypeId,
    image_url: imageUrl || null,
    exclude_from_out_of_stock: excludeFromOutOfStock,
    designed_for_kit_id: designedForKitId,
  };
  let { data, error } = await supabase.from("aftermarket_parts").insert(insertData as any).select("id, name").single();

  if (error && error.message && (error.message.includes("exclude_from_out_of_stock") || error.message.includes("designed_for_kit_id"))) {
    console.warn("addAftermarketPart: newer column(s) missing, retrying without them (run kit-stash/add-exclude-out-of-stock.sql and/or add-designed-for-kit.sql)");
    delete insertData.exclude_from_out_of_stock;
    delete insertData.designed_for_kit_id;
    const retry = await supabase.from("aftermarket_parts").insert(insertData as any).select("id, name").single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("❌ addAftermarketPart FAILED:", error);
    throw new Error(`Failed to add part: ${error.message}`);
  }

  console.log("✅ addAftermarketPart SUCCESS — row created:", data);
  revalidatePath("/inventory");
}

export async function addKit(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const status = formData.get("status") as string || "in_stash";
  const quantity = parseInt(formData.get("quantity") as string) || 1;
  const locationId = formData.get("locationId") as string || null;
  const pricePaid = formData.get("pricePaid") ? parseFloat(formData.get("pricePaid") as string) : null;
  const purchaseDate = formData.get("purchaseDate") as string || null;
  const purchaseSourceId = formData.get("purchaseSourceId") as string || null;
  const currentValue = formData.get("currentValue") ? parseFloat(formData.get("currentValue") as string) : null;
  const valueLastUpdated = formData.get("valueLastUpdated") as string || null;
  const notes = formData.get("notes") as string || null;
  const manufacturerId = formData.get("manufacturerId") as string || null;
  const scaleId = formData.get("scaleId") as string || null;
  const kitTypeId = formData.get("kitTypeId") as string || null;
  const boxArtUrl = formData.get("box_art_url") as string || null;
  const barcode = formData.get("barcode") as string || null;

  if (!name) {
    throw new Error("Kit name is required");
  }

  const { data, error } = await supabase.from("kits").insert({
    user_id: USER_ID,
    name,
    status,
    quantity_owned: quantity,
    location_id: locationId,
    price_paid: pricePaid,
    purchase_date: purchaseDate,
    purchase_source_id: purchaseSourceId,
    current_value: currentValue,
    value_last_updated: valueLastUpdated,
    notes,
    manufacturer_id: manufacturerId,
    scale_id: scaleId,
    kit_type_id: kitTypeId,
    box_art_url: boxArtUrl || null,
    barcode,
  } as any).select("id, name").single();

  if (error) {
    console.error("❌ addKit FAILED:", error);
    throw new Error(`Failed to add kit: ${error.message}`);
  }

  console.log("✅ addKit SUCCESS — row created:", data);
  revalidatePath("/inventory");
}

export async function addPaint(formData: FormData) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,   // ← service role (bypasses RLS)
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const colorName = formData.get("colorName") as string;
  const paintBrandId = formData.get("paintBrandId") as string || null;
  const colorCode = formData.get("colorCode") as string || null;
  const series = formData.get("series") as string || null;
  const fsNumber = formData.get("fsNumber") as string || null;
  const ralNumber = formData.get("ralNumber") as string || null;
  const rlmNumber = formData.get("rlmNumber") as string || null;
  const anaNumber = formData.get("anaNumber") as string || null;
  const quantity = parseInt(formData.get("quantity") as string) || 1;
  const locationId = formData.get("locationId") as string || null;
  const pricePaid = formData.get("pricePaid") ? parseFloat(formData.get("pricePaid") as string) : null;
  const purchaseDate = formData.get("purchaseDate") as string || null;
  const purchaseSourceId = formData.get("purchaseSourceId") as string || null;
  const currentValue = formData.get("currentValue") ? parseFloat(formData.get("currentValue") as string) : null;
  const valueLastUpdated = formData.get("valueLastUpdated") as string || null;
  const notes = formData.get("notes") as string || null;
  const paintTypeId = formData.get("paintTypeId") as string || null;
  const excludeFromOutOfStock = formData.get("excludeFromOutOfStock") === "on";
  const designedForKitId = formData.get("designedForKitId") as string || null;

  if (!colorName) {
    throw new Error("Color name is required");
  }

  console.log("🟡 addPaint attempting full insert with:", { colorName, paintBrandId, paintTypeId });

  const insertData: any = {
    user_id: USER_ID,
    color_name: colorName,
    paint_brand_id: paintBrandId,
    color_code: colorCode,
    series,
    fs_number: fsNumber,
    ral_number: ralNumber,
    rlm_number: rlmNumber,
    ana_number: anaNumber,
    quantity_owned: quantity,
    location_id: locationId,
    price_paid: pricePaid,
    purchase_date: purchaseDate,
    purchase_source_id: purchaseSourceId,
    current_value: currentValue,
    value_last_updated: valueLastUpdated,
    notes,
    paint_type_id: paintTypeId,
    opened: false,
    exclude_from_out_of_stock: excludeFromOutOfStock,
    designed_for_kit_id: designedForKitId,
  };
  let { data, error } = await supabase
    .from("paints")
    .insert(insertData as any)
    .select("id, color_name, paint_brand_id, series")
    .single();

  if (error && error.message && (error.message.includes("exclude_from_out_of_stock") || error.message.includes("designed_for_kit_id"))) {
    console.warn("addPaint: newer column(s) missing, retrying without them (run the migration)");
    delete insertData.exclude_from_out_of_stock;
    delete insertData.designed_for_kit_id;
    const retry = await supabase.from("paints").insert(insertData as any).select("id, color_name, paint_brand_id, series").single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("❌ addPaint FAILED:", error);
    console.error("   Details:", JSON.stringify(error, null, 2));
    throw new Error(`Failed to add paint: ${error.message || error.code || 'unknown error'}`);
  }

  console.log("✅ addPaint SUCCESS — row created:", data);
  revalidatePath("/inventory");
}

export async function updateAftermarketPart(formData: FormData) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const quantity = parseInt(formData.get("quantity") as string) || 0;
  const locationId = formData.get("locationId") as string || null;
  const pricePaid = formData.get("pricePaid") ? parseFloat(formData.get("pricePaid") as string) : null;
  const purchaseDate = formData.get("purchaseDate") as string || null;
  const purchaseSourceId = formData.get("purchaseSourceId") as string || null;
  const currentValue = formData.get("currentValue") ? parseFloat(formData.get("currentValue") as string) : null;
  const valueLastUpdated = formData.get("valueLastUpdated") as string || null;
  const notes = formData.get("notes") as string || null;
  const manufacturerId = formData.get("manufacturerId") as string || null;
  const scaleId = formData.get("scaleId") as string || null;
  const partTypeId = formData.get("partTypeId") as string || null;
  const imageUrl = formData.get("image_url") as string | null;
  const excludeFromOutOfStock = formData.get("excludeFromOutOfStock") === "on";
  const designedForKitId = formData.get("designedForKitId") as string || null;

  if (!id || !name) throw new Error("Missing required fields for update");

  const updateData: any = {
    name,
    quantity_owned: quantity,
    location_id: locationId,
    price_paid: pricePaid,
    purchase_date: purchaseDate,
    purchase_source_id: purchaseSourceId,
    current_value: currentValue,
    value_last_updated: valueLastUpdated,
    notes,
    manufacturer_id: manufacturerId,
    scale_id: scaleId,
    part_type_id: partTypeId,
    exclude_from_out_of_stock: excludeFromOutOfStock,
    designed_for_kit_id: designedForKitId,
  };

  if (imageUrl !== null) {
    updateData.image_url = imageUrl || null;
  }

  let { data, error } = await supabase
    .from("aftermarket_parts")
    .update(updateData)
    .eq("id", id)
    .select("id, name")
    .single();

  if (error && error.message && (error.message.includes("exclude_from_out_of_stock") || error.message.includes("designed_for_kit_id"))) {
    console.warn("updateAftermarketPart: newer column(s) missing, retrying without them (run the migration)");
    delete updateData.exclude_from_out_of_stock;
    delete updateData.designed_for_kit_id;
    const retry = await supabase.from("aftermarket_parts").update(updateData).eq("id", id).select("id, name").single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("❌ updateAftermarketPart FAILED:", error);
    throw new Error(`Failed to update part: ${error.message}`);
  }

  console.log("✅ updateAftermarketPart SUCCESS:", data);
  revalidatePath("/inventory");
}

export async function updateKit(formData: FormData) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const status = formData.get("status") as string || "in_stash";
  const quantity = formData.get("quantity") !== null ? parseInt(formData.get("quantity") as string) : undefined;
  const locationId = formData.get("locationId") as string || null;
  const pricePaid = formData.get("pricePaid") ? parseFloat(formData.get("pricePaid") as string) : null;
  const purchaseDate = formData.get("purchaseDate") as string || null;
  const purchaseSourceId = formData.get("purchaseSourceId") as string || null;
  const currentValue = formData.get("currentValue") ? parseFloat(formData.get("currentValue") as string) : null;
  const valueLastUpdated = formData.get("valueLastUpdated") as string || null;
  const notes = formData.get("notes") as string || null;
  const manufacturerId = formData.get("manufacturerId") as string || null;
  const scaleId = formData.get("scaleId") as string || null;
  const kitTypeId = formData.get("kitTypeId") as string || null;
  const boxArtUrl = formData.get("box_art_url") as string | null;
  const barcode = formData.get("barcode") as string | null;

  if (!id || !name) throw new Error("Missing required fields for update");

  const updateData: any = {
    name,
    status,
    location_id: locationId,
    price_paid: pricePaid,
    purchase_date: purchaseDate,
    purchase_source_id: purchaseSourceId,
    current_value: currentValue,
    value_last_updated: valueLastUpdated,
    notes,
    manufacturer_id: manufacturerId,
    scale_id: scaleId,
    kit_type_id: kitTypeId,
    barcode,
  };

  if (quantity !== undefined) {
    updateData.quantity_owned = quantity;
  }

  if (boxArtUrl !== null) {
    updateData.box_art_url = boxArtUrl || null;
  }

  const { data, error } = await supabase
    .from("kits")
    .update(updateData)
    .eq("id", id)
    .select("id, name")
    .single();

  if (error) {
    console.error("❌ updateKit FAILED:", error);
    throw new Error(`Failed to update kit: ${error.message}`);
  }

  console.log("✅ updateKit SUCCESS:", data);
  revalidatePath("/inventory");
}

export async function updatePaint(formData: FormData) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const id = formData.get("id") as string;
  const colorName = formData.get("colorName") as string;
  const paintBrandId = formData.get("paintBrandId") as string || null;
  const colorCode = formData.get("colorCode") as string || null;
  const series = formData.get("series") as string || null;
  const fsNumber = formData.get("fsNumber") as string || null;
  const ralNumber = formData.get("ralNumber") as string || null;
  const rlmNumber = formData.get("rlmNumber") as string || null;
  const anaNumber = formData.get("anaNumber") as string || null;
  const quantity = parseInt(formData.get("quantity") as string) || 0;
  const locationId = formData.get("locationId") as string || null;
  const pricePaid = formData.get("pricePaid") ? parseFloat(formData.get("pricePaid") as string) : null;
  const purchaseDate = formData.get("purchaseDate") as string || null;
  const purchaseSourceId = formData.get("purchaseSourceId") as string || null;
  const currentValue = formData.get("currentValue") ? parseFloat(formData.get("currentValue") as string) : null;
  const valueLastUpdated = formData.get("valueLastUpdated") as string || null;
  const notes = formData.get("notes") as string || null;
  const paintTypeId = formData.get("paintTypeId") as string || null;
  const excludeFromOutOfStock = formData.get("excludeFromOutOfStock") === "on";
  const designedForKitId = formData.get("designedForKitId") as string || null;

  if (!id || !colorName) throw new Error("Missing required fields for update");

  const updateData: any = {
    color_name: colorName,
    paint_brand_id: paintBrandId,
    color_code: colorCode,
    series,
    fs_number: fsNumber,
    ral_number: ralNumber,
    rlm_number: rlmNumber,
    ana_number: anaNumber,
    quantity_owned: quantity,
    location_id: locationId,
    price_paid: pricePaid,
    purchase_date: purchaseDate,
    purchase_source_id: purchaseSourceId,
    current_value: currentValue,
    value_last_updated: valueLastUpdated,
    notes,
    paint_type_id: paintTypeId,
    exclude_from_out_of_stock: excludeFromOutOfStock,
    designed_for_kit_id: designedForKitId,
  };
  let { data, error } = await supabase
    .from("paints")
    .update(updateData)
    .eq("id", id)
    .select("id, color_name")
    .single();

  if (error && error.message && (error.message.includes("exclude_from_out_of_stock") || error.message.includes("designed_for_kit_id"))) {
    console.warn("updatePaint: newer column(s) missing, retrying without them (run the migration)");
    delete updateData.exclude_from_out_of_stock;
    delete updateData.designed_for_kit_id;
    const retry = await supabase.from("paints").update(updateData).eq("id", id).select("id, color_name").single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("❌ updatePaint FAILED:", error);
    throw new Error(`Failed to update paint: ${error.message}`);
  }

  console.log("✅ updatePaint SUCCESS:", data);
  revalidatePath("/inventory");
}

// Image upload helper using service role (consistent with our privileged write pattern)
export async function uploadInventoryImage(formData: FormData) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const file = formData.get("image") as File;
  const type = formData.get("type") as "kit" | "part";
  const itemId = formData.get("itemId") as string;

  if (!file || !type || !itemId) {
    throw new Error("Missing image upload data");
  }

  const fileExt = file.name.split(".").pop();
  const fileName = `${itemId}-${Date.now()}.${fileExt}`;
  const folder = type === "kit" ? "kits" : "parts";
  const filePath = `${folder}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("inventory-images")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw new Error("Failed to upload image to storage");
  }

  const { data } = supabase.storage
    .from("inventory-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// ============================================
// Simple lookup creators (for quick "add new" from forms)
// Matches the simple form experience you had in Access
// ============================================

export async function createManufacturer(name: string) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase
    .from("manufacturers")
    .insert({ name: name.trim() })
    .select("id, name")
    .single();

  if (error) throw new Error(`Failed to create manufacturer: ${error.message}`);
  revalidatePath("/inventory");
  return data;
}

export async function createScale(name: string, sortOrder?: number) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase
    .from("scales")
    .insert({ 
      name: name.trim(), 
      sort_order: sortOrder ?? 999 
    })
    .select("id, name, sort_order")
    .single();

  if (error) throw new Error(`Failed to create scale: ${error.message}`);
  revalidatePath("/inventory");
  return data;
}

export async function createPartType(name: string) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase
    .from("part_types")
    .insert({ name: name.trim() })
    .select("id, name")
    .single();

  if (error) throw new Error(`Failed to create part type: ${error.message}`);
  revalidatePath("/inventory");
  return data;
}

export async function createKitType(name: string) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase
    .from("kit_types")
    .insert({ name: name.trim() })
    .select("id, name")
    .single();

  if (error) throw new Error(`Failed to create kit type: ${error.message}`);
  revalidatePath("/inventory");
  return data;
}

export async function createPaintType(name: string) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase
    .from("paint_types")
    .insert({ name: name.trim() })
    .select("id, name")
    .single();

  if (error) throw new Error(`Failed to create paint type: ${error.message}`);
  revalidatePath("/inventory");
  return data;
}

export async function createPaintBrand(name: string) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase
    .from("paint_brands")
    .insert({ name: name.trim() })
    .select("id, name")
    .single();

  if (error) throw new Error(`Failed to create paint brand: ${error.message}`);
  revalidatePath("/inventory");
  return data;
}

export async function createLocation(name: string) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase
    .from("locations")
    .insert({ name: name.trim() })
    .select("id, name")
    .single();

  if (error) throw new Error(`Failed to create location: ${error.message}`);
  revalidatePath("/inventory");
  return data;
}

export async function createPurchaseSource(name: string) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase
    .from("purchase_sources")
    .insert({ name: name.trim() })
    .select("id, name")
    .single();

  if (error) throw new Error(`Failed to create purchase source: ${error.message}`);
  revalidatePath("/inventory");
  return data;
}

// ============================================
// Export functionality
// ============================================

function toCSV(rows: any[]): string {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(','),
    ...rows.map(row => 
      headers.map(field => {
        let value = row[field];
        if (value === null || value === undefined) value = '';
        const stringValue = String(value).replace(/"/g, '""');
        return `"${stringValue}"`;
      }).join(',')
    )
  ];
  return csvRows.join('\n');
}

export async function exportInventoryData() {
  const supabase = await createClient();
  const userId = USER_ID;

  // Fetch all data
  const [
    { data: parts },
    { data: kits },
    { data: paints },
    { data: locations },
    { data: manufacturers },
    { data: scales },
    { data: partTypes },
    { data: kitTypes },
    { data: paintTypes },
    { data: paintBrands },
    { data: purchaseSources },
  ] = await Promise.all([
    supabase.from("aftermarket_parts").select("*").eq("user_id", userId),
    supabase.from("kits").select("*").eq("user_id", userId),
    supabase.from("paints").select("*").eq("user_id", userId),
    supabase.from("locations").select("*"),
    supabase.from("manufacturers").select("*"),
    supabase.from("scales").select("*"),
    supabase.from("part_types").select("*"),
    supabase.from("kit_types").select("*"),
    supabase.from("paint_types").select("*"),
    supabase.from("paint_brands").select("*"),
    supabase.from("purchase_sources").select("*"),
  ]);

  const zip = new JSZip();

  zip.file("aftermarket_parts.csv", toCSV(parts || []));
  zip.file("kits.csv", toCSV(kits || []));
  zip.file("paints.csv", toCSV(paints || []));
  zip.file("locations.csv", toCSV(locations || []));
  zip.file("manufacturers.csv", toCSV(manufacturers || []));
  zip.file("scales.csv", toCSV(scales || []));
  zip.file("part_types.csv", toCSV(partTypes || []));
  zip.file("kit_types.csv", toCSV(kitTypes || []));
  zip.file("paint_types.csv", toCSV(paintTypes || []));
  zip.file("paint_brands.csv", toCSV(paintBrands || []));
  zip.file("purchase_sources.csv", toCSV(purchaseSources || []));

  // Add helpful README
  const readme = `KitStash Export - ${new Date().toISOString().split('T')[0]}

This ZIP contains CSV exports of your KitStash data.

FILES INCLUDED:
- aftermarket_parts.csv   → All aftermarket parts (includes image_url)
- kits.csv                → All kits (includes box_art_url)
- paints.csv              → All paints
- locations.csv           → Your storage locations
- manufacturers.csv
- scales.csv
- part_types.csv
- kit_types.csv
- paint_types.csv
- paint_brands.csv
- purchase_sources.csv

IMAGE INFORMATION:
- Kit box art URLs are in the "box_art_url" column of kits.csv
- Part image URLs are in the "image_url" column of aftermarket_parts.csv
- These are the URLs stored in Supabase Storage.

RELATIONSHIPS:
- manufacturer_id in kits/parts links to manufacturers.csv (by id)
- location_id in kits/parts/paints links to locations.csv (by id)
- purchase_source_id links to purchase_sources.csv (by id)
- Similar for type/brand fields
- designed_for_kit_id in aftermarket_parts/paints is the uuid of a kit this specialized item (photoetch, specific paint, etc.) was bought for. It is pure metadata (does not affect stock/allocations). Match against id in kits.csv. Use project_allocations for actual usage in builds.

This export is designed to be a complete backup of your collection.
`;

  zip.file("README.txt", readme);

  const zipContent = await zip.generateAsync({ type: "base64" });

  return {
    fileName: `kitstash-export-${new Date().toISOString().split('T')[0]}.zip`,
    content: zipContent,
  };
}

// Allocate inventory item to a project
export async function allocateToProject(projectId: string, itemId: string, itemType: 'kit' | 'part' | 'paint', quantity: number, notes?: string) {
  const supabase = await createClient();
  const userId = USER_ID;

  if (quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  // Verify the project belongs to the user
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (!project) {
    throw new Error("Project not found");
  }

  // Get current item to check available stock
  const table = itemType === 'kit' ? 'kits' : itemType === 'part' ? 'aftermarket_parts' : 'paints';
  const { data: item } = await supabase
    .from(table)
    .select("quantity_owned, quantity_allocated, quantity_used")
    .eq("id", itemId)
    .eq("user_id", userId)
    .single();

  if (!item) {
    throw new Error("Item not found");
  }

  const available = (item.quantity_owned ?? 0) - (item.quantity_allocated ?? 0) - (item.quantity_used ?? 0);

  if (quantity > available) {
    throw new Error(`Only ${available} available to allocate`);
  }

  // Create allocation
  const { error: allocError } = await supabase
    .from("project_allocations")
    .insert({
      user_id: userId,
      project_id: projectId,
      item_id: itemId,
      item_type: itemType,
      quantity,
      allocation_status: "allocated",
      notes: notes || null,
    });

  if (allocError) {
    throw new Error("Failed to create allocation");
  }

  // Increase allocated quantity on the source item
  const newAllocated = (item.quantity_allocated ?? 0) + quantity;

  const { error: updateError } = await supabase
    .from(table)
    .update({ quantity_allocated: newAllocated })
    .eq("id", itemId);

  if (updateError) {
    // Attempt to rollback the allocation (best effort)
    await supabase.from("project_allocations").delete().eq("project_id", projectId).eq("item_id", itemId).eq("quantity", quantity);
    throw new Error("Failed to update inventory stock");
  }

  revalidatePath("/projects");
  revalidatePath("/inventory");
}

// Remove (deallocate) an item from a project and restore available stock
export async function removeAllocation(allocationId: string) {
  const supabase = await createClient();
  const userId = USER_ID;

  // Get the allocation record
  const { data: allocation, error: allocFetchError } = await supabase
    .from("project_allocations")
    .select("id, project_id, item_id, item_type, quantity, allocation_status, project:projects(user_id)")
    .eq("id", allocationId)
    .single();

  if (allocFetchError || !allocation) {
    throw new Error("Allocation not found");
  }

  // Verify ownership via the project
  const project = allocation.project as any;
  if (!project || project.user_id !== userId) {
    throw new Error("Not authorized to modify this allocation");
  }

  const { item_id: itemId, item_type: itemType, quantity, allocation_status: status } = allocation;

  const table = itemType === 'kit' ? 'kits' : itemType === 'part' ? 'aftermarket_parts' : 'paints';

  // Get current stock numbers
  const { data: item } = await supabase
    .from(table)
    .select("quantity_allocated, quantity_used")
    .eq("id", itemId)
    .single();

  if (!item) {
    throw new Error("Source inventory item not found");
  }

  const isUsed = status === 'used';
  const currentVal = isUsed ? (item.quantity_used ?? 0) : (item.quantity_allocated ?? 0);
  const newVal = Math.max(0, currentVal - quantity);

  // Update the inventory item
  const updateData = isUsed 
    ? { quantity_used: newVal } 
    : { quantity_allocated: newVal };

  const { error: updateError } = await supabase
    .from(table)
    .update(updateData)
    .eq("id", itemId);

  if (updateError) {
    throw new Error("Failed to update inventory stock when removing allocation");
  }

  // Delete the allocation record
  const { error: deleteError } = await supabase
    .from("project_allocations")
    .delete()
    .eq("id", allocationId);

  if (deleteError) {
    // Best effort: try to restore the stock
    const restoreData = isUsed 
      ? { quantity_used: currentVal } 
      : { quantity_allocated: currentVal };
    await supabase.from(table).update(restoreData).eq("id", itemId);
    throw new Error("Failed to remove allocation record");
  }

  revalidatePath("/projects");
  revalidatePath("/inventory");
}

// Mark an allocation as "used" (consumed in the build)
// This moves quantity from allocated → used on the source inventory item
export async function markAllocationUsed(allocationId: string, quantityToMark?: number) {
  const supabase = await createClient();
  const userId = USER_ID;

  // Get the allocation (include more fields for partial)
  const { data: allocation, error: allocFetchError } = await supabase
    .from("project_allocations")
    .select("id, project_id, item_id, item_type, quantity, allocated_at, notes, allocation_status, project:projects(user_id)")
    .eq("id", allocationId)
    .single();

  if (allocFetchError || !allocation) {
    throw new Error("Allocation not found");
  }

  const project = allocation.project as any;
  if (!project || project.user_id !== userId) {
    throw new Error("Not authorized");
  }

  if (allocation.allocation_status !== "allocated") {
    throw new Error("Can only mark allocated items as used");
  }

  const { item_id: itemId, item_type: itemType, quantity: fullQuantity, project_id: projectId, allocated_at, notes } = allocation;

  const table = itemType === 'kit' ? 'kits' : itemType === 'part' ? 'aftermarket_parts' : 'paints';

  const toMark = quantityToMark && quantityToMark > 0 
    ? Math.min(quantityToMark, fullQuantity) 
    : fullQuantity;

  // Get current stock numbers
  const { data: item } = await supabase
    .from(table)
    .select("quantity_allocated, quantity_used")
    .eq("id", itemId)
    .single();

  if (!item) {
    throw new Error("Source inventory item not found");
  }

  const currentAllocated = item.quantity_allocated ?? 0;
  const currentUsed = item.quantity_used ?? 0;

  // Adjust inventory
  const newAllocated = Math.max(0, currentAllocated - toMark);
  const newUsed = currentUsed + toMark;

  const { error: updateError } = await supabase
    .from(table)
    .update({
      quantity_allocated: newAllocated,
      quantity_used: newUsed,
    })
    .eq("id", itemId);

  if (updateError) {
    throw new Error("Failed to update inventory when marking as used");
  }

  if (toMark === fullQuantity) {
    // Full amount - just flip this allocation to used
    const { error: allocUpdateError } = await supabase
      .from("project_allocations")
      .update({
        allocation_status: "used",
        used_at: new Date().toISOString(),
      })
      .eq("id", allocationId);

    if (allocUpdateError) {
      throw new Error("Failed to update allocation status");
    }
  } else {
    // Partial - reduce the original allocated row
    const remainingQty = fullQuantity - toMark;
    const { error: reduceError } = await supabase
      .from("project_allocations")
      .update({ quantity: remainingQty })
      .eq("id", allocationId);

    if (reduceError) {
      // best effort rollback inventory?
      await supabase.from(table).update({ quantity_allocated: currentAllocated, quantity_used: currentUsed }).eq("id", itemId);
      throw new Error("Failed to reduce allocation quantity");
    }

    // Insert a new row for the used portion
    const { error: insertError } = await supabase
      .from("project_allocations")
      .insert({
        user_id: userId,
        project_id: projectId,
        item_id: itemId,
        item_type: itemType,
        quantity: toMark,
        allocation_status: "used",
        allocated_at: allocated_at,
        used_at: new Date().toISOString(),
        notes: notes || null,
      });

    if (insertError) {
      // rollback the quantity reduction
      await supabase.from("project_allocations").update({ quantity: fullQuantity }).eq("id", allocationId);
      await supabase.from(table).update({ quantity_allocated: currentAllocated, quantity_used: currentUsed }).eq("id", itemId);
      throw new Error("Failed to create used allocation record");
    }
  }

  revalidatePath("/projects");
  revalidatePath("/inventory");
}

// ============================================
// Server-side data fetch using service role (bypasses RLS)
// Used by client to get inventory data via server actions (service role on server).
// This works reliably from any browser / deployment.
// ============================================

export async function getAllParts() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // Full select with optional newer columns (exclude flag + designed_for kit association).
  // These may not exist until the corresponding migrations are run.
  const fullSelect = `id, name, notes, image_url, quantity_owned, quantity_allocated, quantity_used, location_id, price_paid, purchase_date, purchase_source_id, current_value, value_last_updated, created_at, updated_at, manufacturer_id, scale_id, part_type_id, exclude_from_out_of_stock, designed_for_kit_id, manufacturer:manufacturers(name), scale:scales(name), part_type:part_types(name), loc:locations(name), purchase_source:purchase_sources(name), designed_for_kit:kits(id, name)`;

  // Core select guaranteed to work (no optional newer columns/embeds).
  const coreSelect = `id, name, notes, image_url, quantity_owned, quantity_allocated, quantity_used, location_id, price_paid, purchase_date, purchase_source_id, current_value, value_last_updated, created_at, updated_at, manufacturer_id, scale_id, part_type_id, manufacturer:manufacturers(name), scale:scales(name), part_type:part_types(name), loc:locations(name), purchase_source:purchase_sources(name)`;

  const { data: initialData, error: initialError } = await supabase
    .from("aftermarket_parts")
    .select(fullSelect)
    .eq("user_id", USER_ID);

  let data = initialData;
  const error = initialError;

  if (error) {
    // Any error on the rich select (missing columns, missing relationships in schema cache after ALTER without NOTIFY, etc.)
    // → degrade gracefully to core data. The new UI features just won't have values until migrations are applied + schema reloaded.
    console.warn("getAllParts: full select failed (likely missing designed_for_kit_id column or its relationship to kits). Falling back to core fields. Run kit-stash/add-designed-for-kit.sql (and add-exclude-out-of-stock.sql if not already) + NOTIFY pgrst, 'reload schema';", error);
    const fallback = await supabase
      .from("aftermarket_parts")
      .select(coreSelect)
      .eq("user_id", USER_ID);

    if (fallback.error) {
      console.error("getAllParts core fallback also failed:", fallback.error);
      throw fallback.error;
    }

    data = (fallback.data || []).map((row: any) => ({
      ...row,
      exclude_from_out_of_stock: false,
      designed_for_kit_id: null,
      designed_for_kit: null,
    }));
  }

  console.log(`[server action] getAllParts returned ${data ? data.length : 0} rows`);
  return data || [];
}

export async function getAllKits() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  const { data, error } = await supabase
    .from("kits")
    .select(`id, name, status, notes, barcode, box_art_url, quantity_owned, quantity_allocated, quantity_used, location_id, price_paid, purchase_date, purchase_source_id, current_value, value_last_updated, created_at, updated_at, manufacturer_id, scale_id, kit_type_id, manufacturer:manufacturers(name), scale:scales(name, sort_order), kit_type:kit_types(name), loc:locations(name), purchase_source:purchase_sources(name)`)
    .eq("user_id", USER_ID);
  if (error) {
    console.error("getAllKits error:", error);
    throw error;
  }
  console.log(`[server action] getAllKits returned ${data ? data.length : 0} rows`);
  return data || [];
}

export async function getAllPaints() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  const fullSelect = `id, color_name, brand, notes, quantity_owned, quantity_allocated, quantity_used, location_id, price_paid, purchase_date, purchase_source_id, current_value, value_last_updated, opened, created_at, updated_at, series, fs_number, ral_number, rlm_number, ana_number, paint_type_id, paint_brand_id, exclude_from_out_of_stock, designed_for_kit_id, paint_type:paint_types(name), paint_brand:paint_brands(name), loc:locations(name), purchase_source:purchase_sources(name), designed_for_kit:kits(id, name)`;

  const coreSelect = `id, color_name, brand, notes, quantity_owned, quantity_allocated, quantity_used, location_id, price_paid, purchase_date, purchase_source_id, current_value, value_last_updated, opened, created_at, updated_at, series, fs_number, ral_number, rlm_number, ana_number, paint_type_id, paint_brand_id, paint_type:paint_types(name), paint_brand:paint_brands(name), loc:locations(name), purchase_source:purchase_sources(name)`;

  const { data: initialData, error: initialError } = await supabase
    .from("paints")
    .select(fullSelect)
    .eq("user_id", USER_ID);

  let data = initialData;
  const error = initialError;

  if (error) {
    // Any error on the rich select (missing columns, missing relationships in schema cache, etc.)
    // → degrade gracefully to core data.
    console.warn("getAllPaints: full select failed (likely missing designed_for_kit_id column or its relationship to kits). Falling back to core fields. Run kit-stash/add-designed-for-kit.sql (and add-exclude-out-of-stock.sql if not already) + NOTIFY pgrst, 'reload schema';", error);
    const fallback = await supabase
      .from("paints")
      .select(coreSelect)
      .eq("user_id", USER_ID);

    if (fallback.error) {
      console.error("getAllPaints core fallback also failed:", fallback.error);
      throw fallback.error;
    }

    data = (fallback.data || []).map((row: any) => ({
      ...row,
      exclude_from_out_of_stock: false,
      designed_for_kit_id: null,
      designed_for_kit: null,
    }));
  }

  console.log(`[server action] getAllPaints returned ${data ? data.length : 0} rows`);
  return data || [];
}

// ============================================
// Dashboard & Reports data helpers (service role for full access)
// ============================================

// Centralized single-user ID for this personal app.
// Set SUPABASE_USER_ID in your environment (see .env.example).
// This is used for all RLS-filtered queries via service role.
const USER_ID =
  process.env.SUPABASE_USER_ID || "a8e4287a-040b-41dd-ba45-87f6a3c07395";

export async function getAllProjects() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  const { data, error } = await supabase
    .from("projects")
    .select(`*, scale:scales(name)`)
    .eq("user_id", USER_ID)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getAllProjects error:", error);
    throw error;
  }
  console.log(`[server action] getAllProjects returned ${data ? data.length : 0} rows`);
  return data || [];
}

export async function getAllProjectAllocations() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  const { data, error } = await supabase
    .from("project_allocations")
    .select(`*, project:projects(id, name, status, progress_percent)`)
    .eq("user_id", USER_ID)
    .order("allocated_at", { ascending: false });
  if (error) {
    console.error("getAllProjectAllocations error:", error);
    throw error;
  }
  console.log(`[server action] getAllProjectAllocations returned ${data ? data.length : 0} rows`);
  return data || [];
}

export async function getAllNeededItems() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  const { data, error } = await (supabase as any)
    .from("project_needed_items")
    .select(`*, project:projects(id, name, status)`)
    .eq("user_id", USER_ID)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getAllNeededItems error:", error);
    // table may have different casing or not exist in types, but runtime ok
    return [];
  }
  return data || [];
}

export async function getAllProgressNotes() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  const { data, error } = await (supabase as any)
    .from("project_progress_notes")
    .select(`*, project:projects(id, name)`)
    .eq("user_id", USER_ID)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getAllProgressNotes error:", error);
    return [];
  }
  return data || [];
}
