"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Centralized single-user ID
const userId =
  process.env.SUPABASE_USER_ID || "a8e4287a-040b-41dd-ba45-87f6a3c07395";

// ============================================
// Stuff I Still Need (project_needed_items)
// ============================================

export async function addNeededItem(data: {
  projectId: string;
  itemType: 'kit' | 'part' | 'paint' | 'other';
  itemId?: string | null;
  name: string;
  quantityNeeded: number;
  notes?: string | null;
}) {
  const supabase = await createClient();

  const { error } = await (supabase as any).from("project_needed_items").insert({
    user_id: userId,
    project_id: data.projectId,
    item_type: data.itemType,
    item_id: data.itemId || null,
    name: data.name.trim(),
    quantity_needed: data.quantityNeeded,
    notes: data.notes || null,
  });

  if (error) {
    console.error("Failed to add needed item:", error);
    throw new Error("Failed to add item to 'Stuff I Still Need'");
  }

  revalidatePath("/projects");
}

export async function updateNeededItem(
  id: string,
  data: {
    quantityNeeded?: number;
    notes?: string | null;
    name?: string;
  }
) {
  const supabase = await createClient();

  const updateData: any = {};

  if (data.quantityNeeded !== undefined) updateData.quantity_needed = data.quantityNeeded;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.name) updateData.name = data.name.trim();

  const { error } = await (supabase as any).from("project_needed_items")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update needed item:", error);
    throw new Error("Failed to update item");
  }

  revalidatePath("/projects");
}

export async function deleteNeededItem(id: string) {
  const supabase = await createClient();

  const { error } = await (supabase as any).from("project_needed_items")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete needed item:", error);
    throw new Error("Failed to remove item");
  }

  revalidatePath("/projects");
}

export async function getNeededItemsForProject(projectId: string) {
  const supabase = await createClient();

  const { data, error } = await (supabase as any).from("project_needed_items")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load needed items:", error);
    return [];
  }

  return data || [];
}

// ============================================
// Progress Log (project_progress_notes)
// ============================================

export async function addProgressNote(projectId: string, note: string) {
  const supabase = await createClient();

  const { error } = await (supabase as any).from("project_progress_notes").insert({
    user_id: userId,
    project_id: projectId,
    note: note.trim(),
  });

  if (error) {
    console.error("Failed to add progress note:", error);
    throw new Error(`Failed to add progress note: ${error.message}`);
  }

  revalidatePath("/projects");
}

export async function getProgressNotesForProject(projectId: string) {
  const supabase = await createClient();

  const { data, error } = await (supabase as any).from("project_progress_notes")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load progress notes:", error);
    return [];
  }

  return data || [];
}

export async function deleteProgressNote(id: string) {
  const supabase = await createClient();

  const { error } = await (supabase as any).from("project_progress_notes")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete progress note:", error);
    throw new Error("Failed to delete note");
  }

  revalidatePath("/projects");
}

// ============================================
// Project References
// ============================================

export type ReferenceType = 'link' | 'book' | 'note' | 'photo';

export async function addReference(data: {
  projectId: string;
  referenceType: ReferenceType;
  title?: string | null;
  url?: string | null;
  author?: string | null;
  pageNumber?: string | null;
  isbn?: string | null;
  notes?: string | null;
}) {
  const supabase = await createClient();

  const { error } = await (supabase as any).from("project_references").insert({
    user_id: userId,
    project_id: data.projectId,
    reference_type: data.referenceType,
    title: data.title?.trim() || null,
    url: data.url?.trim() || null,
    author: data.author?.trim() || null,
    page_number: data.pageNumber?.trim() || null,
    isbn: data.isbn?.trim() || null,
    notes: data.notes?.trim() || null,
  });

  if (error) {
    console.error("Failed to add reference:", error);
    throw new Error("Failed to add reference");
  }

  revalidatePath("/projects");
}

export async function getReferencesForProject(projectId: string) {
  const supabase = await createClient();

  const { data, error } = await (supabase as any).from("project_references")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load references:", error);
    return [];
  }

  return data || [];
}

export async function updateReference(
  id: string,
  data: {
    title?: string | null;
    url?: string | null;
    author?: string | null;
    pageNumber?: string | null;
    isbn?: string | null;
    notes?: string | null;
  }
) {
  const supabase = await createClient();

  const updateData: any = {};

  if (data.title !== undefined) updateData.title = data.title?.trim() || null;
  if (data.url !== undefined) updateData.url = data.url?.trim() || null;
  if (data.author !== undefined) updateData.author = data.author?.trim() || null;
  if (data.pageNumber !== undefined) updateData.page_number = data.pageNumber?.trim() || null;
  if (data.isbn !== undefined) updateData.isbn = data.isbn?.trim() || null;
  if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;

  const { error } = await (supabase as any).from("project_references")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update reference:", error);
    throw new Error("Failed to update reference");
  }

  revalidatePath("/projects");
}

export async function deleteReference(id: string) {
  const supabase = await createClient();

  const { error } = await (supabase as any).from("project_references")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete reference:", error);
    throw new Error("Failed to delete reference");
  }

  revalidatePath("/projects");
}

// ============================================
// Project Updates (status workflow)
// ============================================

export async function updateProject(
  id: string,
  data: {
    name?: string;
    status?: string;
    conceived_date?: string | null;
    start_date?: string | null;
    target_date?: string | null;
    completed_date?: string | null;
    progress_percent?: number;
  }
) {
  const supabase = await createClient();

  const updateData: any = {};

  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.status !== undefined) updateData.status = data.status;
  if (data.conceived_date !== undefined) updateData.conceived_date = data.conceived_date || null;
  if (data.start_date !== undefined) updateData.start_date = data.start_date || null;
  if (data.target_date !== undefined) updateData.target_date = data.target_date || null;
  if (data.completed_date !== undefined) updateData.completed_date = data.completed_date || null;
  if (data.progress_percent !== undefined) updateData.progress_percent = data.progress_percent;

  const { error } = await supabase
    .from("projects")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update project:", error);
    throw new Error("Failed to update project");
  }

  revalidatePath("/projects");
}

export async function deleteProject(id: string) {
  const supabase = await createClient();

  // Note: related records (allocations, needed items, references, notes) should cascade via DB FKs
  // If not set up, we may need explicit deletes here in future.

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete project:", error);
    throw new Error("Failed to delete project");
  }

  revalidatePath("/projects");
}
