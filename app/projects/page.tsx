"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { allocateToProject, removeAllocation, markAllocationUsed } from "../inventory/actions";
import { 
  addNeededItem, 
  updateNeededItem, 
  deleteNeededItem, 
  getNeededItemsForProject,
  addProgressNote,
  getProgressNotesForProject,
  deleteProgressNote,
  addReference,
  getReferencesForProject,
  updateReference,
  deleteReference,
  updateProject,
  deleteProject,
  type ReferenceType
} from "./actions";

type Project = {
  id: string;
  name: string;
  status: string;
  conceived_date?: string | null;
  start_date: string | null;
  target_date: string | null;
  completed_date: string | null;
  progress_percent: number | null;
  notes: string | null;
  created_at: string | null;
};

type AllocatedItem = {
  id: string;
  item_id: string;
  item_type: 'kit' | 'part' | 'paint';
  quantity: number;
  allocated_at: string | null;
  used_at?: string | null;
  notes?: string | null;
  // Populated details
  name: string;
  manufacturer?: string;
  scale?: string;
  // Financial fields for value rollup
  price_paid?: number | null;
  current_value?: number | null;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newConceivedDate, setNewConceivedDate] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [newStatus, setNewStatus] = useState("planning");

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [allocatedItems, setAllocatedItems] = useState<AllocatedItem[]>([]);
  const [usedItems, setUsedItems] = useState<AllocatedItem[]>([]);
  const [neededItems, setNeededItems] = useState<any[]>([]);
  const [progressNotes, setProgressNotes] = useState<any[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);

  // References
  const [references, setReferences] = useState<any[]>([]);
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [editingReference, setEditingReference] = useState<any>(null);
  const [refType, setRefType] = useState<ReferenceType>("link");
  const [refTitle, setRefTitle] = useState("");
  const [refUrl, setRefUrl] = useState("");
  const [refAuthor, setRefAuthor] = useState("");
  const [refPage, setRefPage] = useState("");
  const [refIsbn, setRefIsbn] = useState("");
  const [refNotes, setRefNotes] = useState("");
  const [isSavingRef, setIsSavingRef] = useState(false);

  // Project Edit (status workflow)
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectStatus, setEditProjectStatus] = useState("planning");
  const [editConceivedDate, setEditConceivedDate] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editCompletedDate, setEditCompletedDate] = useState("");
  const [editProgress, setEditProgress] = useState(0);
  const [isSavingProject, setIsSavingProject] = useState(false);

  // Mark Used partial
  const [showMarkUsedModal, setShowMarkUsedModal] = useState(false);
  const [markUsedItem, setMarkUsedItem] = useState<AllocatedItem | null>(null);
  const [markUsedQtyInput, setMarkUsedQtyInput] = useState(1);

  // Deep link support: auto-open a project detail when arriving via ?project=ID (e.g. from inventory "Allocated to Projects")
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [allocateSearch, setAllocateSearch] = useState("");
  const [allocateResults, setAllocateResults] = useState<any[]>([]);
  const [selectedItemForAllocation, setSelectedItemForAllocation] = useState<any>(null);
  const [allocateQuantity, setAllocateQuantity] = useState(1);
  const [isAllocating, setIsAllocating] = useState(false);

  // Needed Items (Stuff I Still Need)
  const [showAddNeededModal, setShowAddNeededModal] = useState(false);
  const [neededItemType, setNeededItemType] = useState<'kit' | 'part' | 'paint' | 'other'>('other');
  const [neededItemName, setNeededItemName] = useState("");
  const [neededItemQuantity, setNeededItemQuantity] = useState(1);
  const [neededItemNotes, setNeededItemNotes] = useState("");
  const [isSavingNeeded, setIsSavingNeeded] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const userId =
  process.env.SUPABASE_USER_ID || "a8e4287a-040b-41dd-ba45-87f6a3c07395";

  // One-time parse for deep link ?project=ID (from inventory allocated sections)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const pid = params.get("project");
      if (pid) {
        setPendingProjectId(pid);
      }
    }
  }, []);

  function viewInInventory(item: AllocatedItem) {
    // Deep link: go to the correct tab + pass the item id so InventoryClient can auto-open the details modal
    // (and will clear filters on that tab so the item is visible in the list)
    const tab = item.item_type === "kit" ? "kits" : item.item_type === "part" ? "parts" : "paints";
    router.push(`/inventory?tab=${tab}&view=${item.item_id}`);
    // Close this project detail so the user lands cleanly on the inventory details
    setSelectedProject(null);
    setAllocatedItems([]);
    setUsedItems([]);
    setNeededItems([]);
    setProgressNotes([]);
    setReferences([]);
  }

  async function loadProjects() {
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProjects(data);
    }
    setLoading(false);
  }

  async function loadAllocatedItems(projectId: string) {
    const { data: allocations, error } = await supabase
      .from("project_allocations")
      .select("*")
      .eq("project_id", projectId)
      .eq("allocation_status", "allocated")
      .order("allocated_at", { ascending: false });

    if (error || !allocations) {
      setAllocatedItems([]);
      return;
    }

    // For a first version, we'll do separate fetches for names.
    // In a future iteration we can optimize with more advanced joins or views.
    const enriched: AllocatedItem[] = [];

    for (const alloc of allocations) {
      let name = "Unknown item";
      let manufacturer = "";
      let scale = "";
      let price_paid: number | null = null;
      let current_value: number | null = null;

      if (alloc.item_type === "part") {
        const { data } = await supabase
          .from("aftermarket_parts")
          .select(`name, price_paid, current_value, manufacturer:manufacturers(name), scale:scales(name)`)
          .eq("id", alloc.item_id)
          .single();
        if (data) {
          name = data.name;
          manufacturer = data.manufacturer?.name || "";
          scale = data.scale?.name || "";
          price_paid = data.price_paid;
          current_value = data.current_value;
        }
      } else if (alloc.item_type === "kit") {
        const { data } = await supabase
          .from("kits")
          .select(`name, price_paid, current_value, manufacturer:manufacturers(name), scale:scales(name)`)
          .eq("id", alloc.item_id)
          .single();
        if (data) {
          name = data.name;
          manufacturer = data.manufacturer?.name || "";
          scale = data.scale?.name || "";
          price_paid = data.price_paid;
          current_value = data.current_value;
        }
      } else if (alloc.item_type === "paint") {
        const { data } = await supabase
          .from("paints")
          .select(`color_name, price_paid, current_value, paint_brand:paint_brands(name)`)
          .eq("id", alloc.item_id)
          .single();
        if (data) {
          name = data.color_name;
          manufacturer = data.paint_brand?.name || "";
          price_paid = data.price_paid;
          current_value = data.current_value;
        }
      }

      enriched.push({
        id: alloc.id,
        item_id: alloc.item_id,
        item_type: alloc.item_type as 'kit' | 'part' | 'paint',
        quantity: alloc.quantity,
        allocated_at: alloc.allocated_at,
        used_at: alloc.used_at,
        notes: alloc.notes,
        name,
        manufacturer,
        scale,
        price_paid,
        current_value,
      });
    }

    setAllocatedItems(enriched);
  }

  async function loadUsedItems(projectId: string) {
    const { data: allocations, error } = await supabase
      .from("project_allocations")
      .select("*")
      .eq("project_id", projectId)
      .eq("allocation_status", "used")
      .order("used_at", { ascending: false });

    if (error || !allocations) {
      setUsedItems([]);
      return;
    }

    const enriched: AllocatedItem[] = [];

    for (const alloc of allocations) {
      let name = "Unknown item";
      let manufacturer = "";
      let scale = "";
      let price_paid: number | null = null;
      let current_value: number | null = null;

      if (alloc.item_type === "part") {
        const { data } = await supabase
          .from("aftermarket_parts")
          .select(`name, price_paid, current_value, manufacturer:manufacturers(name), scale:scales(name)`)
          .eq("id", alloc.item_id)
          .single();
        if (data) {
          name = data.name;
          manufacturer = data.manufacturer?.name || "";
          scale = data.scale?.name || "";
          price_paid = data.price_paid;
          current_value = data.current_value;
        }
      } else if (alloc.item_type === "kit") {
        const { data } = await supabase
          .from("kits")
          .select(`name, price_paid, current_value, manufacturer:manufacturers(name), scale:scales(name)`)
          .eq("id", alloc.item_id)
          .single();
        if (data) {
          name = data.name;
          manufacturer = data.manufacturer?.name || "";
          scale = data.scale?.name || "";
          price_paid = data.price_paid;
          current_value = data.current_value;
        }
      } else if (alloc.item_type === "paint") {
        const { data } = await supabase
          .from("paints")
          .select(`color_name, price_paid, current_value, paint_brand:paint_brands(name)`)
          .eq("id", alloc.item_id)
          .single();
        if (data) {
          name = data.color_name;
          manufacturer = data.paint_brand?.name || "";
          price_paid = data.price_paid;
          current_value = data.current_value;
        }
      }

      enriched.push({
        id: alloc.id,
        item_id: alloc.item_id,
        item_type: alloc.item_type as 'kit' | 'part' | 'paint',
        quantity: alloc.quantity,
        allocated_at: alloc.allocated_at,
        used_at: alloc.used_at,
        notes: alloc.notes,
        name,
        manufacturer,
        scale,
        price_paid,
        current_value,
      });
    }

    setUsedItems(enriched);
  }

  async function loadNeededItems(projectId: string) {
    const items = await getNeededItemsForProject(projectId);
    setNeededItems(items);
  }

  async function loadProgressNotes(projectId: string) {
    const notes = await getProgressNotesForProject(projectId);
    setProgressNotes(notes);
  }

  async function loadReferences(projectId: string) {
    const refs = await getReferencesForProject(projectId);
    setReferences(refs);
  }

  // React to deep link pendingProjectId once the projects list is available
  useEffect(() => {
    if (!pendingProjectId || projects.length === 0) {
      return;
    }

    const match = projects.find((p) => p.id === pendingProjectId);
    if (match) {
      setSelectedProject(match);
      loadAllocatedItems(match.id);
      loadUsedItems(match.id);
      loadNeededItems(match.id);
      loadProgressNotes(match.id);
      loadReferences(match.id);

      // Clean the param
      try {
        const params = new URLSearchParams(window.location.search);
        params.delete("project");
        const qs = params.toString();
        router.replace(`/projects${qs ? "?" + qs : ""}`, { scroll: false });
      } catch {}
      setPendingProjectId(null);
    }
  }, [pendingProjectId, projects, router]);

  async function handleAddProgressNote() {
    if (!selectedProject || !newNoteText.trim()) return;

    setIsAddingNote(true);

    try {
      await addProgressNote(selectedProject.id, newNoteText.trim());
      await loadProgressNotes(selectedProject.id);
      setNewNoteText("");
    } catch (err: any) {
      console.error("Add progress note error:", err);
      alert(err.message || "Failed to add progress note");
    } finally {
      setIsAddingNote(false);
    }
  }

  async function handleDeleteProgressNote(id: string) {
    if (!confirm("Delete this note?")) return;

    try {
      await deleteProgressNote(id);
      if (selectedProject) {
        await loadProgressNotes(selectedProject.id);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete note");
    }
  }

  async function handleSaveReference() {
    if (!selectedProject) return;

    setIsSavingRef(true);

    try {
      const payload = {
        projectId: selectedProject.id,
        referenceType: refType,
        title: refTitle.trim() || null,
        url: refUrl.trim() || null,
        author: refAuthor.trim() || null,
        pageNumber: refPage.trim() || null,
        isbn: refIsbn.trim() || null,
        notes: refNotes.trim() || null,
      };

      if (editingReference) {
        await updateReference(editingReference.id, payload);
      } else {
        await addReference(payload);
      }

      await loadReferences(selectedProject.id);
      closeReferenceModal();
    } catch (err: any) {
      alert(err.message || "Failed to save reference");
    } finally {
      setIsSavingRef(false);
    }
  }

  function openEditReference(ref: any) {
    setEditingReference(ref);
    setRefType(ref.reference_type);
    setRefTitle(ref.title || "");
    setRefUrl(ref.url || "");
    setRefAuthor(ref.author || "");
    setRefPage(ref.page_number || "");
    setRefIsbn(ref.isbn || "");
    setRefNotes(ref.notes || "");
    setShowReferenceModal(true);
  }

  function closeReferenceModal() {
    setShowReferenceModal(false);
    setEditingReference(null);
    setRefType("link");
    setRefTitle("");
    setRefUrl("");
    setRefAuthor("");
    setRefPage("");
    setRefIsbn("");
    setRefNotes("");
  }

  async function handleDeleteReference(id: string) {
    if (!confirm("Delete this reference?")) return;

    try {
      await deleteReference(id);
      if (selectedProject) {
        await loadReferences(selectedProject.id);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete reference");
    }
  }

  function openEditProject() {
    if (!selectedProject) return;

    setEditProjectName(selectedProject.name);
    setEditProjectStatus(selectedProject.status);
    setEditConceivedDate(selectedProject.conceived_date || "");
    setEditStartDate(selectedProject.start_date || "");
    setEditTargetDate(selectedProject.target_date || "");
    setEditCompletedDate(selectedProject.completed_date || "");
    setEditProgress(selectedProject.progress_percent || 0);
    setShowEditProjectModal(true);
  }

  async function handleSaveProject() {
    if (!selectedProject) return;

    setIsSavingProject(true);

    try {
      await updateProject(selectedProject.id, {
        name: editProjectName.trim(),
        status: editProjectStatus,
        conceived_date: editConceivedDate || null,
        start_date: editStartDate || null,
        target_date: editTargetDate || null,
        completed_date: editCompletedDate || null,
        progress_percent: editProgress,
      });

      await loadProjects();

      setSelectedProject(prev => prev ? {
        ...prev,
        name: editProjectName.trim(),
        status: editProjectStatus,
        conceived_date: editConceivedDate || null,
        start_date: editStartDate || null,
        target_date: editTargetDate || null,
        completed_date: editCompletedDate || null,
        progress_percent: editProgress,
      } : null);

      setShowEditProjectModal(false);
    } catch (err: any) {
      alert(err.message || "Failed to save project");
    } finally {
      setIsSavingProject(false);
    }
  }

  async function handleDeleteProject() {
    if (!selectedProject) return;

    if (!confirm(`Delete project "${selectedProject.name}"? This will also remove all its allocations, needed items, references, and notes. This cannot be undone.`)) {
      return;
    }

    try {
      await deleteProject(selectedProject.id);
      setSelectedProject(null);
      await loadProjects();
    } catch (err: any) {
      alert(err.message || "Failed to delete project");
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function createProject() {
    if (!newProjectName.trim()) return;

    const { error } = await supabase.from("projects").insert({
      user_id: userId,
      name: newProjectName.trim(),
      status: newStatus,
      conceived_date: newConceivedDate || null,
      start_date: newStartDate || null,
      target_date: newTargetDate || null,
    });

    if (!error) {
      setNewProjectName("");
      setNewConceivedDate("");
      setNewStartDate("");
      setNewTargetDate("");
      setNewStatus("planning");
      setShowNewModal(false);
      setFilterStatus("all");
      loadProjects();
    } else {
      console.error("Create project error:", error);
      alert(`Failed to create project: ${error.message}`);
    }
  }

  // Simple inventory search for allocation (searches parts + kits + paints)
  async function searchInventory(term: string) {
    if (!term || term.length < 2) {
      setAllocateResults([]);
      return;
    }

    const searchTerm = `%${term}%`;

    const [partsRes, kitsRes, paintsRes] = await Promise.all([
      supabase
        .from("aftermarket_parts")
        .select(`id, name, quantity_owned, quantity_allocated, quantity_used, manufacturer:manufacturers(name), scale:scales(name)`)
        .eq("user_id", userId)
        .ilike("name", searchTerm)
        .limit(15),
      supabase
        .from("kits")
        .select(`id, name, quantity_owned, quantity_allocated, quantity_used, manufacturer:manufacturers(name), scale:scales(name)`)
        .eq("user_id", userId)
        .ilike("name", searchTerm)
        .limit(15),
      supabase
        .from("paints")
        .select(`id, color_name, quantity_owned, quantity_allocated, quantity_used, paint_brand:paint_brands(name)`)
        .eq("user_id", userId)
        .ilike("color_name", searchTerm)
        .limit(10),
    ]);

    const results: any[] = [];

    (partsRes.data || []).forEach((p: any) => {
      const available = (p.quantity_owned || 0) - (p.quantity_allocated || 0) - (p.quantity_used || 0);
      results.push({
        id: p.id,
        type: "part",
        name: p.name,
        manufacturer: p.manufacturer?.name,
        scale: p.scale?.name,
        available,
      });
    });

    (kitsRes.data || []).forEach((k: any) => {
      const available = (k.quantity_owned || 0) - (k.quantity_allocated || 0) - (k.quantity_used || 0);
      results.push({
        id: k.id,
        type: "kit",
        name: k.name,
        manufacturer: k.manufacturer?.name,
        scale: k.scale?.name,
        available,
      });
    });

    (paintsRes.data || []).forEach((p: any) => {
      const available = (p.quantity_owned || 0) - (p.quantity_allocated || 0) - (p.quantity_used || 0);
      results.push({
        id: p.id,
        type: "paint",
        name: p.color_name,
        manufacturer: p.paint_brand?.name,
        available,
      });
    });

    // Only show items that actually have something available to allocate
    const filtered = results.filter(r => (r.available ?? 0) > 0);
    setAllocateResults(filtered);
  }

  async function confirmAllocation() {
    if (!selectedProject || !selectedItemForAllocation || allocateQuantity <= 0) return;

    setIsAllocating(true);

    try {
      await allocateToProject(
        selectedProject.id,
        selectedItemForAllocation.id,
        selectedItemForAllocation.type,
        allocateQuantity
      );

      // Refresh allocated items in the project detail
      await loadAllocatedItems(selectedProject.id);

      // Reset allocation modal state
      setShowAllocateModal(false);
      setAllocateSearch("");
      setAllocateResults([]);
      setSelectedItemForAllocation(null);
      setAllocateQuantity(1);

      alert(`Allocated ${allocateQuantity} × ${selectedItemForAllocation.name} to the project.`);
    } catch (err: any) {
      console.error("Allocation failed:", err);
      alert(err.message || "Failed to allocate item to project");
    } finally {
      setIsAllocating(false);
    }
  }

  async function handleRemoveAllocation(allocation: AllocatedItem) {
    if (!confirm(`Remove ${allocation.quantity} × ${allocation.name} from this project?`)) {
      return;
    }

    try {
      await removeAllocation(allocation.id);
      // Refresh the lists inside the open project modal
      if (selectedProject) {
        await loadAllocatedItems(selectedProject.id);
        await loadUsedItems(selectedProject.id);
      }
    } catch (err: any) {
      console.error("Failed to remove allocation:", err);
      alert(err.message || "Failed to remove allocation");
    }
  }

  function handleMarkUsed(allocation: AllocatedItem) {
    setMarkUsedItem(allocation);
    setMarkUsedQtyInput(allocation.quantity);
    setShowMarkUsedModal(true);
  }

  async function confirmMarkUsed() {
    if (!markUsedItem || !selectedProject) return;

    const qtyToMark = Math.max(1, Math.min(markUsedItem.quantity, markUsedQtyInput || 1));

    setShowMarkUsedModal(false);

    try {
      await markAllocationUsed(markUsedItem.id, qtyToMark);
      await loadAllocatedItems(selectedProject.id);
      await loadUsedItems(selectedProject.id);
    } catch (err: any) {
      console.error("Failed to mark as used:", err);
      alert(err.message || "Failed to mark item as used");
    } finally {
      setMarkUsedItem(null);
      setMarkUsedQtyInput(1);
    }
  }

  function closeMarkUsedModal() {
    setShowMarkUsedModal(false);
    setMarkUsedItem(null);
    setMarkUsedQtyInput(1);
  }

  async function handleAddNeededItem() {
    if (!selectedProject || !neededItemName.trim()) return;

    setIsSavingNeeded(true);

    try {
      await addNeededItem({
        projectId: selectedProject.id,
        itemType: neededItemType,
        name: neededItemName.trim(),
        quantityNeeded: neededItemQuantity,
        notes: neededItemNotes.trim() || null,
      });

      // Refresh list
      await loadNeededItems(selectedProject.id);

      // Reset form
      setNeededItemName("");
      setNeededItemQuantity(1);
      setNeededItemNotes("");
      setNeededItemType("other");
      setShowAddNeededModal(false);
    } catch (err: any) {
      alert(err.message || "Failed to add item");
    } finally {
      setIsSavingNeeded(false);
    }
  }

  async function handleDeleteNeededItem(id: string) {
    if (!confirm("Remove this item from the list?")) return;

    try {
      await deleteNeededItem(id);
      if (selectedProject) {
        await loadNeededItems(selectedProject.id);
      }
    } catch (err: any) {
      alert(err.message || "Failed to remove item");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-zinc-400">Your active and completed builds</p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>+ New Project</Button>
      </div>

      {/* Simple status filter */}
      <div className="mt-4 flex gap-2 flex-wrap text-sm">
        {['all', 'planning', 'in_progress', 'on_hold', 'completed', 'cancelled'].map(s => (
          <Button 
            key={s} 
            variant={filterStatus === s ? "default" : "outline"} 
            size="sm"
            onClick={() => setFilterStatus(s)}
            className="capitalize text-xs h-7"
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </Button>
        ))}
        {filterStatus !== 'all' && (
          <span className="text-xs text-zinc-500 self-center ml-2">
            (showing { (projects.filter(p => p.status === filterStatus)).length } of {projects.length})
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-8 text-zinc-400">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="mt-8 text-zinc-400">
          No projects yet. Click "New Project" to start tracking a build.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(filterStatus === "all" ? projects : projects.filter(p => p.status === filterStatus)).map((project) => (
            <div 
              key={project.id} 
              className="card p-5 hover:border-amber-500/50 transition-colors cursor-pointer"
              onClick={() => {
                setSelectedProject(project);
                loadAllocatedItems(project.id);
                loadUsedItems(project.id);
                loadNeededItems(project.id);
                loadProgressNotes(project.id);
                loadReferences(project.id);
              }}
            >
              <div className="flex justify-between items-start">
                <div className="font-semibold text-lg">{project.name}</div>
                <div className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 capitalize whitespace-nowrap">
                  {project.status}
                </div>
              </div>
              <div className="text-xs text-zinc-500 mt-3 space-y-0.5">
                <div>Conceived: {project.conceived_date || "—"}</div>
                {project.start_date && <div>Started: {project.start_date}</div>}
                {project.target_date && <div>Target: {project.target_date}</div>}
              </div>
              {(project.progress_percent ?? 0) > 0 && (
                <div className="mt-3">
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all" 
                      style={{ width: `${project.progress_percent}%` }}
                    />
                  </div>
                  <div className="text-xs text-emerald-400 mt-1">{project.progress_percent}% complete</div>
                </div>
              )}
              <div className="mt-3 flex justify-between items-center">
                <div className="text-xs text-amber-400">Click to open →</div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-red-400/70 hover:text-red-400 h-auto p-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
                      (async () => {
                        try {
                          await deleteProject(project.id);
                          await loadProjects();
                        } catch (e: any) {
                          alert(e.message || "Failed to delete");
                        }
                      })();
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-3xl border border-zinc-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold">{selectedProject.name}</h2>
                  <Button variant="outline" size="sm" onClick={openEditProject} className="text-xs">Edit</Button>
                </div>
                <div className="text-sm text-zinc-400 capitalize mt-0.5">{selectedProject.status}</div>
              </div>
              <Button variant="outline" onClick={() => {
                setSelectedProject(null);
                setShowAllocateModal(false);
                setAllocateSearch("");
                setAllocateResults([]);
                setSelectedItemForAllocation(null);
                setAllocateQuantity(1);
                setNeededItems([]);
                setProgressNotes([]);
                setNewNoteText("");
                setReferences([]);
                setUsedItems([]);
                closeReferenceModal();
                setShowEditProjectModal(false);
                closeMarkUsedModal();
              }}>Close</Button>
            </div>

            <div className="text-sm text-zinc-400 mb-6 space-y-1">
              <div>
                Conceived: {selectedProject.conceived_date || "—"} 
                {selectedProject.start_date && <> &nbsp;&nbsp;|&nbsp;&nbsp; Started: {selectedProject.start_date}</>}
              </div>
              {(selectedProject.target_date || selectedProject.completed_date) && (
                <div>
                  {selectedProject.target_date && <>Target: {selectedProject.target_date}</>}
                  {selectedProject.target_date && selectedProject.completed_date && <> &nbsp;&nbsp;|&nbsp;&nbsp; </>}
                  {selectedProject.completed_date && <>Completed: {selectedProject.completed_date}</>}
                </div>
              )}
              <div className="text-xs">
                Progress: <span className="font-medium text-white">{selectedProject.progress_percent || 0}%</span>
              </div>
            </div>

            {/* Value Rollup */}
            {(() => {
              let totalPaid = 0;
              let totalCurrent = 0;

              allocatedItems.forEach((item) => {
                const qty = item.quantity || 0;
                const paid = item.price_paid ?? 0;
                const current = item.current_value ?? item.price_paid ?? 0;
                totalPaid += paid * qty;
                totalCurrent += current * qty;
              });

              if (totalPaid === 0 && totalCurrent === 0) return null;

              const delta = totalCurrent - totalPaid;
              const deltaPercent = totalPaid > 0 ? ((delta / totalPaid) * 100) : 0;

              return (
                <div className="mb-6 p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                  <div className="text-xs text-zinc-400 mb-2">Value of Allocated Items</div>
                  <div className="flex flex-wrap gap-x-8 gap-y-1">
                    <div>
                      <span className="text-sm text-zinc-400">Total Paid:</span>{" "}
                      <span className="font-semibold tabular-nums">${totalPaid.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-sm text-zinc-400">Current Value:</span>{" "}
                      <span className="font-semibold tabular-nums">${totalCurrent.toFixed(2)}</span>
                    </div>
                    {totalPaid > 0 && (
                      <div>
                        <span className="text-sm text-zinc-400">Change:</span>{" "}
                        <span className={`font-semibold tabular-nums ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {delta >= 0 ? "+" : ""}${delta.toFixed(2)} ({deltaPercent.toFixed(1)}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Allocated Items */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Allocated to this Project</h3>
                <Button size="sm" onClick={() => {
                  setShowAllocateModal(true);
                  setAllocateSearch("");
                  setAllocateResults([]);
                  setSelectedItemForAllocation(null);
                  setAllocateQuantity(1);
                }}>
                  + Allocate from Inventory
                </Button>
              </div>

              {allocatedItems.length === 0 ? (
                <div className="text-sm text-zinc-400 border border-zinc-800 rounded-xl p-4">
                  No items allocated yet.<br /><br />
                  Use the button above to allocate specific kits, parts, or paints (with quantity) to this project.
                </div>
              ) : (
                <div className="space-y-2">
                  {allocatedItems.map((item) => (
                    <div key={item.id} className="border border-zinc-700 rounded-lg p-3 text-sm flex justify-between items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium capitalize">{item.item_type}</span>: {item.name}
                        {item.manufacturer && ` • ${item.manufacturer}`}
                        {item.scale && ` • ${item.scale}`}
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          Qty: <span className="font-semibold">{item.quantity}</span>
                          <div className="text-xs text-zinc-500">
                            Allocated {item.allocated_at ? new Date(item.allocated_at).toLocaleDateString() : '—'}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkUsed(item)}
                            className="text-xs"
                          >
                            Mark Used
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveAllocation(item)}
                            className="text-xs"
                          >
                            Remove
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); viewInInventory(item); }}
                            className="text-xs"
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Used in this Project */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Used in this Project</h3>

              {usedItems.length === 0 ? (
                <div className="text-sm text-zinc-400 border border-zinc-800 rounded-xl p-4">
                  No items marked used yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {usedItems.map((item) => (
                    <div key={item.id} className="border border-zinc-700 rounded-lg p-3 text-sm flex justify-between items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium capitalize">{item.item_type}</span>: {item.name}
                        {item.manufacturer && ` • ${item.manufacturer}`}
                        {item.scale && ` • ${item.scale}`}
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          Qty: <span className="font-semibold">{item.quantity}</span>
                          <div className="text-xs text-zinc-500">
                            {(() => {
                              const d = item.used_at || item.allocated_at;
                              return d ? `Used ${new Date(d).toLocaleDateString()}` : 'Used —';
                            })()}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveAllocation(item)}
                            className="text-xs"
                          >
                            Remove
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); viewInInventory(item); }}
                            className="text-xs"
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stuff I Still Need */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Stuff I Still Need</h3>
                <Button 
                  size="sm" 
                  onClick={() => {
                    setShowAddNeededModal(true);
                    setNeededItemName("");
                    setNeededItemQuantity(1);
                    setNeededItemNotes("");
                    setNeededItemType("other");
                  }}
                >
                  + Add Item
                </Button>
              </div>

              {neededItems.length === 0 ? (
                <div className="text-sm text-zinc-400 border border-zinc-800 rounded-xl p-4">
                  No items yet.<br />
                  Add things you still need to buy or find for this build.
                </div>
              ) : (
                <div className="space-y-2">
                  {neededItems.map((item) => (
                    <div key={item.id} className="border border-zinc-700 rounded-lg p-3 text-sm flex justify-between items-start">
                      <div className="flex-1">
                        <div>
                          <span className="font-medium capitalize">{item.item_type}</span>: {item.name}
                          <span className="ml-2 text-xs text-zinc-400">×{item.quantity_needed}</span>
                        </div>
                        {item.notes && (
                          <div className="text-xs text-zinc-400 mt-1">{item.notes}</div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteNeededItem(item.id)}
                        className="text-xs ml-3"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Progress Log */}
            <div>
              <h3 className="font-semibold mb-3">Progress Log</h3>

              {/* Add new note */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="What did you do today on this build?"
                    rows={2}
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm resize-y min-h-[60px]"
                  />
                  <Button
                    onClick={handleAddProgressNote}
                    disabled={!newNoteText.trim() || isAddingNote}
                    className="self-end"
                  >
                    {isAddingNote ? "..." : "Add"}
                  </Button>
                </div>
              </div>

              {/* Notes list */}
              {progressNotes.length === 0 ? (
                <div className="text-sm text-zinc-400 border border-zinc-800 rounded-xl p-4">
                  No progress notes yet. Add updates as you work on the build.
                </div>
              ) : (
                <div className="space-y-3">
                  {progressNotes.map((note) => (
                    <div key={note.id} className="border border-zinc-700 rounded-lg p-3 text-sm group">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 whitespace-pre-wrap text-zinc-200">{note.note}</div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteProgressNote(note.id)}
                          className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Delete
                        </Button>
                      </div>
                      <div className="text-xs text-zinc-500 mt-2">
                        {new Date(note.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* References */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">References</h3>
                <Button size="sm" onClick={() => setShowReferenceModal(true)}>
                  + Add Reference
                </Button>
              </div>

              {references.length === 0 ? (
                <div className="text-sm text-zinc-400 border border-zinc-800 rounded-xl p-4">
                  No references yet. Add links, books, or notes for this build.
                </div>
              ) : (
                <div className="space-y-2">
                  {references.map((ref) => (
                    <div key={ref.id} className="border border-zinc-700 rounded-lg p-3 text-sm group">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                              {ref.reference_type}
                            </span>
                            {ref.title && <span className="font-medium">{ref.title}</span>}
                          </div>

                          {ref.reference_type === 'link' && ref.url && (
                            <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline break-all text-xs">
                              {ref.url}
                            </a>
                          )}

                          {ref.reference_type === 'book' && (
                            <div className="text-xs text-zinc-400 mt-1">
                              {ref.author && <span>{ref.author}</span>}
                              {ref.page_number && <span> • p.{ref.page_number}</span>}
                              {ref.isbn && <span> • {ref.isbn}</span>}
                            </div>
                          )}

                          {ref.notes && (
                            <div className="text-xs text-zinc-300 mt-1 whitespace-pre-wrap">{ref.notes}</div>
                          )}
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => openEditReference(ref)}>
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => handleDeleteReference(ref.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Allocation Modal */}
      {showAllocateModal && selectedProject && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-2xl border border-zinc-800 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-semibold">Allocate to {selectedProject.name}</h3>
                <p className="text-sm text-zinc-400">Search your inventory and allocate a specific quantity</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                setShowAllocateModal(false);
                setAllocateSearch("");
                setAllocateResults([]);
                setSelectedItemForAllocation(null);
                setAllocateQuantity(1);
              }}>
                Close
              </Button>
            </div>

            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search parts, kits, or paints..."
                value={allocateSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setAllocateSearch(val);
                  searchInventory(val);
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
              />
            </div>

            {/* Results */}
            {allocateResults.length > 0 && !selectedItemForAllocation && (
              <div className="border border-zinc-700 rounded-xl max-h-64 overflow-auto mb-4">
                {allocateResults.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setSelectedItemForAllocation(item);
                      setAllocateQuantity(1);
                    }}
                    className="p-3 hover:bg-zinc-800 cursor-pointer border-b border-zinc-700 last:border-b-0 flex justify-between items-center"
                  >
                    <div>
                      <span className="font-medium capitalize">{item.type}</span>: {item.name}
                      {item.manufacturer && ` • ${item.manufacturer}`}
                      {item.scale && ` • ${item.scale}`}
                    </div>
                    <div className="text-sm text-emerald-400">
                      Available: {item.available}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quantity selector */}
            {selectedItemForAllocation && (
              <div className="border border-zinc-700 rounded-xl p-4 mb-4">
                <div className="mb-3">
                  <div className="text-sm text-zinc-400">Allocating</div>
                  <div className="font-medium">
                    {selectedItemForAllocation.name} ({selectedItemForAllocation.type})
                  </div>
                </div>

                <div>
                  <label className="text-sm text-zinc-400">Quantity to allocate</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedItemForAllocation.available}
                    value={allocateQuantity}
                    onChange={(e) => setAllocateQuantity(Math.max(1, Math.min(selectedItemForAllocation.available, parseInt(e.target.value) || 1)))}
                    className="mt-1 w-32 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  />
                  <div className="text-xs text-zinc-500 mt-1">
                    Max available: {selectedItemForAllocation.available}
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedItemForAllocation(null);
                      setAllocateQuantity(1);
                    }}
                  >
                    Cancel Selection
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={confirmAllocation}
                    disabled={isAllocating || allocateQuantity < 1}
                  >
                    {isAllocating ? "Allocating..." : `Allocate ${allocateQuantity}`}
                  </Button>
                </div>
              </div>
            )}

            {allocateSearch.length >= 2 && allocateResults.length === 0 && !selectedItemForAllocation && (
              <div className="text-sm text-zinc-400 py-4 text-center">
                No matching items found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md border border-zinc-800">
            <h2 className="text-xl font-semibold mb-4">New Project</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400">Project Title *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2"
                  placeholder="e.g. 1/48 Tamiya F-14A Tomcat"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400">Initial Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2"
                >
                  <option value="planning">Planning</option>
                  <option value="in_progress">In Progress</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-zinc-400">Date Conceived</label>
                  <input
                    type="date"
                    value={newConceivedDate}
                    onChange={(e) => setNewConceivedDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400">Date Started (optional)</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-zinc-400">Target Date (optional)</label>
                <input
                  type="date"
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2"
                />
              </div>

              <p className="text-xs text-zinc-500 -mt-2">
                Conceived = when you decided you wanted to build it. Started = when you actually began work (after gathering parts).
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowNewModal(false);
                  setNewProjectName("");
                  setNewConceivedDate("");
                  setNewStartDate("");
                  setNewTargetDate("");
                  setNewStatus("planning");
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={createProject}
                disabled={!newProjectName.trim()}
              >
                Create Project
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Needed Item Modal */}
      {showAddNeededModal && selectedProject && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md border border-zinc-800">
            <h3 className="text-xl font-semibold mb-4">Add to "Stuff I Still Need"</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Type</label>
                <select
                  value={neededItemType}
                  onChange={(e) => setNeededItemType(e.target.value as any)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
                >
                  <option value="other">Other / Custom</option>
                  <option value="kit">Kit</option>
                  <option value="part">Aftermarket Part</option>
                  <option value="paint">Paint</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-zinc-400 block mb-1">Item Name *</label>
                <input
                  type="text"
                  value={neededItemName}
                  onChange={(e) => setNeededItemName(e.target.value)}
                  placeholder="e.g. Tamiya XF-16 Flat Aluminum"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-zinc-400 block mb-1">Quantity Needed</label>
                  <input
                    type="number"
                    min={1}
                    value={neededItemQuantity}
                    onChange={(e) => setNeededItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 block mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={neededItemNotes}
                    onChange={(e) => setNeededItemNotes(e.target.value)}
                    placeholder="e.g. from Squadron"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowAddNeededModal(false);
                  setNeededItemName("");
                  setNeededItemNotes("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddNeededItem}
                disabled={!neededItemName.trim() || isSavingNeeded}
              >
                {isSavingNeeded ? "Adding..." : "Add to List"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Reference Modal */}
      {showReferenceModal && selectedProject && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-lg border border-zinc-800">
            <h3 className="text-xl font-semibold mb-4">
              {editingReference ? "Edit Reference" : "Add Reference"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Type</label>
                <select
                  value={refType}
                  onChange={(e) => setRefType(e.target.value as ReferenceType)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
                >
                  <option value="link">Link</option>
                  <option value="book">Book</option>
                  <option value="note">Note</option>
                  <option value="photo">Photo (URL)</option>
                </select>
              </div>

              {(refType === 'link' || refType === 'book' || refType === 'photo') && (
                <div>
                  <label className="text-sm text-zinc-400 block mb-1">Title</label>
                  <input
                    type="text"
                    value={refTitle}
                    onChange={(e) => setRefTitle(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
                    placeholder={refType === 'book' ? "Book title" : "Reference title"}
                  />
                </div>
              )}

              {(refType === 'link' || refType === 'photo') && (
                <div>
                  <label className="text-sm text-zinc-400 block mb-1">URL</label>
                  <input
                    type="text"
                    value={refUrl}
                    onChange={(e) => setRefUrl(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
                    placeholder="https://..."
                  />
                </div>
              )}

              {refType === 'book' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-zinc-400 block mb-1">Author</label>
                      <input
                        type="text"
                        value={refAuthor}
                        onChange={(e) => setRefAuthor(e.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-zinc-400 block mb-1">Page #</label>
                      <input
                        type="text"
                        value={refPage}
                        onChange={(e) => setRefPage(e.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
                        placeholder="47"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 block mb-1">ISBN (optional)</label>
                    <input
                      type="text"
                      value={refIsbn}
                      onChange={(e) => setRefIsbn(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-sm text-zinc-400 block mb-1">Notes</label>
                <textarea
                  value={refNotes}
                  onChange={(e) => setRefNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm resize-y"
                  placeholder="Additional details..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={closeReferenceModal}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveReference}
                disabled={isSavingRef}
              >
                {isSavingRef ? "Saving..." : editingReference ? "Save Changes" : "Add Reference"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditProjectModal && selectedProject && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md border border-zinc-800">
            <h3 className="text-xl font-semibold mb-4">Edit Project</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400">Project Name</label>
                <input
                  type="text"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400">Status</label>
                <select
                  value={editProjectStatus}
                  onChange={(e) => setEditProjectStatus(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2"
                >
                  <option value="planning">Planning</option>
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-zinc-400">Conceived</label>
                  <input type="date" value={editConceivedDate} onChange={(e) => setEditConceivedDate(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2" />
                </div>
                <div>
                  <label className="text-sm text-zinc-400">Started</label>
                  <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-zinc-400">Target Date</label>
                  <input type="date" value={editTargetDate} onChange={(e) => setEditTargetDate(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2" />
                </div>
                <div>
                  <label className="text-sm text-zinc-400">Completed Date</label>
                  <input type="date" value={editCompletedDate} onChange={(e) => setEditCompletedDate(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2" />
                </div>
              </div>

              <div>
                <label className="text-sm text-zinc-400">Progress: {editProgress}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={editProgress}
                  onChange={(e) => setEditProgress(parseInt(e.target.value))}
                  className="w-full mt-1"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                className="text-red-400 border-red-400/50 hover:bg-red-950/30" 
                onClick={handleDeleteProject}
              >
                Delete Project
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowEditProjectModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSaveProject} disabled={isSavingProject || !editProjectName.trim()}>
                {isSavingProject ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Used Quantity Modal */}
      {showMarkUsedModal && markUsedItem && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border border-zinc-800">
            <h3 className="text-xl font-semibold mb-2">Mark as Used</h3>
            <p className="text-sm text-zinc-400 mb-4">
              {markUsedItem.name} (allocated: {markUsedItem.quantity})
            </p>

            <div className="mb-6">
              <label className="text-sm text-zinc-400">Quantity to mark used</label>
              <input
                type="number"
                min="1"
                max={markUsedItem.quantity}
                value={markUsedQtyInput}
                onChange={(e) => setMarkUsedQtyInput(Math.max(1, Math.min(markUsedItem.quantity, parseInt(e.target.value) || 1)))}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-lg"
              />
              <div className="text-xs text-zinc-500 mt-1">
                1 to {markUsedItem.quantity}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeMarkUsedModal}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={confirmMarkUsed}>
                Mark {markUsedQtyInput} as Used
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
