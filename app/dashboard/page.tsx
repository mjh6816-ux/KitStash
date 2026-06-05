import Link from "next/link";
import { getAllParts, getAllKits, getAllPaints, getAllProjects, getAllProjectAllocations, getAllNeededItems } from "../inventory/actions";

export const dynamic = "force-dynamic";
import { Button } from "@/components/ui/button";
import { Package, Wrench, AlertTriangle, TrendingUp, ArrowRight } from "lucide-react";
import ScanKitButton from "@/components/ScanKitButton";

/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic joined data from Supabase; pragmatic for this inventory app */

export default async function DashboardPage() {
  // Fetch all data server-side (service role)
  const [parts, kits, paints, projects, allocations, neededItems] = await Promise.all([
    getAllParts(),
    getAllKits(),
    getAllPaints(),
    getAllProjects(),
    getAllProjectAllocations(),
    getAllNeededItems(),
  ]);

  // Inventory stats
  const totalPartsOwned = parts.reduce((sum: number, p: any) => sum + (p.quantity_owned || 0), 0);
  const totalKitsOwned = kits.reduce((sum: number, k: any) => sum + (k.quantity_owned || 0), 0);
  const totalPaintsOwned = paints.reduce((sum: number, p: any) => sum + (p.quantity_owned || 0), 0);
  const totalOwned = totalPartsOwned + totalKitsOwned + totalPaintsOwned;

  const totalAllocated = [...parts, ...kits, ...paints].reduce((sum: number, item: any) => sum + (item.quantity_allocated || 0), 0);
  const totalUsed = [...parts, ...kits, ...paints].reduce((sum: number, item: any) => sum + (item.quantity_used || 0), 0);

  const currentValue = [...parts, ...kits, ...paints].reduce((sum: number, item: any) => {
    const val = (item.current_value ?? item.price_paid ?? 0) * (item.quantity_owned || 0);
    return sum + (val || 0);
  }, 0);

  // Out of stock (available === 0) — exclude kits per user preference (kits are typically 1-of unless duplicates collected).
  // Threshold is now zero because 1-of is normal; user may want to replace after using the last one (or not, for specialized parts).
  // Additionally, items with exclude_from_out_of_stock=true are skipped (for project-specific one-time parts like photoetch for a specific model).
  const outOfStockItems: any[] = [];
  const computeAvailable = (item: any) => {
    const owned = item.quantity_owned || 0;
    const alloc = item.quantity_allocated || 0;
    const used = item.quantity_used || 0;
    return Math.max(0, owned - alloc - used);
  };

  [...parts, ...paints].forEach((item: any) => {
    const avail = computeAvailable(item);
    const isExcluded = !!item.exclude_from_out_of_stock;
    if (avail === 0 && !isExcluded) {
      outOfStockItems.push({
        id: item.id,
        type: item.color_name ? "paint" : "part",
        name: item.color_name || item.name,
        available: avail,
        location: item.loc?.name || item.location || "—",
      });
    }
  });
  outOfStockItems.sort((a, b) => a.available - b.available);
  const outOfStockCount = outOfStockItems.length;

  // Projects
  const activeProjects = projects.filter((p: any) => p.status !== "completed" && p.status !== "cancelled");
  const completedProjects = projects.filter((p: any) => p.status === "completed").length;

  // Compute allocated value per project (match allocations to inventory current values)
  const inventoryById: Record<string, any> = {};
  [...parts, ...kits, ...paints].forEach((item: any) => {
    inventoryById[item.id] = item;
  });

  const projectValueMap: Record<string, { paid: number; current: number }> = {};
  allocations.forEach((alloc: any) => {
    const inv = inventoryById[alloc.item_id];
    if (!inv) return;
    const unitCurrent = inv.current_value ?? inv.price_paid ?? 0;
    const unitPaid = inv.price_paid ?? 0;
    const qty = alloc.quantity || 0;
    if (!projectValueMap[alloc.project_id]) projectValueMap[alloc.project_id] = { paid: 0, current: 0 };
    projectValueMap[alloc.project_id].paid += unitPaid * qty;
    projectValueMap[alloc.project_id].current += unitCurrent * qty;
  });

  // Active projects enriched
  const activeProjectsDisplay = activeProjects.slice(0, 6).map((p: any) => {
    const vals = projectValueMap[p.id] || { paid: 0, current: 0 };
    const delta = vals.current - vals.paid;
    return {
      ...p,
      allocatedValue: vals.current,
      valueChange: delta,
      neededCount: neededItems.filter((n: any) => n.project_id === p.id).length,
    };
  });

  // Total value locked in projects
  const projectLockedValue = Object.values(projectValueMap).reduce((sum, v) => sum + v.current, 0);

  // Needed items summary
  const totalNeeded = neededItems.length;
  const neededByProject = neededItems.reduce((acc: any, n: any) => {
    acc[n.project_id] = (acc[n.project_id] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Overview of your stash, projects, and workbench activity.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory">
            <Button variant="outline" size="sm">Inventory <Package className="ml-1.5 h-4 w-4" /></Button>
          </Link>
          <Link href="/projects">
            <Button variant="outline" size="sm">Projects <Wrench className="ml-1.5 h-4 w-4" /></Button>
          </Link>
          <Link href="/reports">
            <Button size="sm">Reports <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
          </Link>
          <ScanKitButton />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 mb-8">
        <div className="card p-5">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> TOTAL OWNED</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums">{totalOwned}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Kits {totalKitsOwned} • Parts {totalPartsOwned} • Paints {totalPaintsOwned}</div>
        </div>

        <div className="card p-5">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> CURRENT VALUE</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums">${currentValue.toFixed(0)}</div>
          <div className="text-[10px] text-emerald-400 mt-0.5">Portfolio value of owned stock</div>
        </div>

        <div className="card p-5">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5">IN PROJECTS</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums">${projectLockedValue.toFixed(0)}</div>
          <div className="text-[10px] text-violet-400 mt-0.5">{totalAllocated} units allocated • {totalUsed} used</div>
        </div>

        <div className="card p-5">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> OUT OF STOCK (PARTS & PAINTS)</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums text-amber-400">{outOfStockCount}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">0 available (may need replacement)</div>
        </div>

        <div className="card p-5">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> ACTIVE PROJECTS</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums">{activeProjects.length}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">{completedProjects} completed • {projects.length} total</div>
        </div>

        <div className="card p-5">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5">STUFF STILL NEEDED</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums">{totalNeeded}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Across {Object.keys(neededByProject).length} projects</div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Out of Stock (Parts & Paints) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" /> Out of Stock (Parts &amp; Paints)
            </h2>
            <Link href="/inventory" className="text-xs text-zinc-400 hover:text-white">View all in Inventory →</Link>
          </div>
          {outOfStockItems.length === 0 ? (
            <div className="card p-6 text-sm text-emerald-400">All good — no out of stock items right now.</div>
          ) : (
            <div className="card divide-y divide-zinc-800 text-sm">
              {outOfStockItems.slice(0, 8).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="font-medium capitalize">{item.type}</span>: {item.name}
                    <span className="ml-2 text-xs text-zinc-500">{item.location}</span>
                  </div>
                  <div className="font-semibold tabular-nums text-amber-400">Out of stock</div>
                </div>
              ))}
              {outOfStockItems.length > 8 && (
                <div className="px-4 py-2 text-xs text-zinc-500">+{outOfStockItems.length - 8} more</div>
              )}
            </div>
          )}
        </div>

        {/* Active Projects */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Wrench className="h-5 w-5" /> Active Projects
            </h2>
            <Link href="/projects" className="text-xs text-zinc-400 hover:text-white">All projects →</Link>
          </div>
          {activeProjectsDisplay.length === 0 ? (
            <div className="card p-6 text-sm text-zinc-400">No active projects. Start a new build in Projects.</div>
          ) : (
            <div className="space-y-3">
              {activeProjectsDisplay.map((p: any) => (
                <Link key={p.id} href={`/projects`} className="card p-4 block hover:border-amber-500/40 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-zinc-400 capitalize mt-0.5">{p.status} {p.target_date && `• target ${p.target_date}`}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold tabular-nums">{p.progress_percent ?? 0}%</div>
                      {p.allocatedValue > 0 && <div className="text-emerald-400">${p.allocatedValue.toFixed(0)}</div>}
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 bg-zinc-800 rounded">
                    <div className="h-1.5 bg-amber-500 rounded" style={{ width: `${Math.min(100, p.progress_percent ?? 0)}%` }} />
                  </div>
                  <div className="mt-1.5 flex gap-3 text-[10px] text-zinc-500">
                    {p.neededCount > 0 && <span>{p.neededCount} needed</span>}
                    {p.allocatedValue > 0 && <span>Value: ${p.allocatedValue.toFixed(0)}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Needed Items & Quick Stats */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">Stuff I Still Need</h2>
        {neededItems.length === 0 ? (
          <div className="text-sm text-zinc-400">Nothing on the list — nice!</div>
        ) : (
          <div className="card p-4 text-sm grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {neededItems.slice(0, 9).map((n: any, i: number) => (
              <div key={i} className="flex justify-between border-b border-zinc-800 pb-1 last:border-0">
                <span>{n.name} <span className="text-xs text-zinc-500">({n.item_type})</span></span>
                <span className="tabular-nums text-zinc-400">×{n.quantity_needed}</span>
              </div>
            ))}
            {neededItems.length > 9 && <div className="text-xs text-zinc-500">+{neededItems.length - 9} more across projects</div>}
          </div>
        )}
      </div>

      <div className="mt-10 text-xs text-zinc-500 flex items-center gap-2">
        Data as of {new Date().toLocaleString()} • <Link href="/reports" className="underline">Full reports &amp; export →</Link>
      </div>
    </div>
  );
}
