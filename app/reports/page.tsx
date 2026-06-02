"use client";

import { useEffect, useState } from "react";
import { exportInventoryData, getAllParts, getAllKits, getAllPaints, getAllProjects, getAllProjectAllocations, getAllNeededItems } from "../inventory/actions";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, AlertTriangle, TrendingUp } from "lucide-react";

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState<any[]>([]);
  const [kits, setKits] = useState<any[]>([]);
  const [paints, setPaints] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [needed, setNeeded] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, k, pa, pr, al, nd] = await Promise.all([
          getAllParts(),
          getAllKits(),
          getAllPaints(),
          getAllProjects(),
          getAllProjectAllocations(),
          getAllNeededItems(),
        ]);
        setParts(p);
        setKits(k);
        setPaints(pa);
        setProjects(pr);
        setAllocations(al);
        setNeeded(nd);
      } catch (e) {
        console.error("Failed to load report data", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleExport = async () => {
    try {
      const result = await exportInventoryData();
      const link = document.createElement("a");
      link.href = `data:application/zip;base64,${result.content}`;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
    }
  };

  // Compute reports data
  const allItems = [...parts, ...kits, ...paints]; // includes kits for value calcs etc.

  const computeAvailable = (item: any) => Math.max(0, (item.quantity_owned || 0) - (item.quantity_allocated || 0) - (item.quantity_used || 0));

  // Out of stock report — exclude kits (user preference: kits are typically single units unless duplicates collected).
  // Threshold is now zero: 1-of is normal; flag only when fully depleted (user may want to replace or not for specialized parts).
  // Items with exclude_from_out_of_stock=true are skipped (for project-specific one-time parts like photoetch for a specific model).
  const outOfStock = [...parts, ...paints]
    .map((item: any) => ({
      type: item.color_name ? "paint" : "part",
      name: item.color_name || item.name,
      available: computeAvailable(item),
      owned: item.quantity_owned || 0,
      location: item.loc?.name || item.location || "—",
      value: (item.current_value ?? item.price_paid ?? 0) * (item.quantity_owned || 0),
      exclude_from_out_of_stock: !!item.exclude_from_out_of_stock,
    }))
    .filter((i) => i.available === 0 && !i.exclude_from_out_of_stock)
    .sort((a, b) => a.available - b.available);

  // Value breakdowns
  const totalCurrentValue = allItems.reduce((sum, item: any) => sum + ((item.current_value ?? item.price_paid ?? 0) * (item.quantity_owned || 0)), 0);

  // By location (simple)
  const valueByLocation: Record<string, number> = {};
  allItems.forEach((item: any) => {
    const loc = item.loc?.name || item.location || "Unassigned";
    const v = (item.current_value ?? item.price_paid ?? 0) * (item.quantity_owned || 0);
    valueByLocation[loc] = (valueByLocation[loc] || 0) + v;
  });

  // By manufacturer / brand rough
  const valueByMfr: Record<string, number> = {};
  allItems.forEach((item: any) => {
    const mfr = item.manufacturer?.name || item.paint_brand?.name || item.brand || "Unknown";
    const v = (item.current_value ?? item.price_paid ?? 0) * (item.quantity_owned || 0);
    valueByMfr[mfr] = (valueByMfr[mfr] || 0) + v;
  });

  // Project value summary (recompute like dashboard)
  const invMap: Record<string, any> = {};
  allItems.forEach((i: any) => { invMap[i.id] = i; });
  const projectValues: Record<string, { current: number; paid: number }> = {};
  allocations.forEach((a: any) => {
    const inv = invMap[a.item_id];
    if (!inv) return;
    const unit = inv.current_value ?? inv.price_paid ?? 0;
    const paid = inv.price_paid ?? 0;
    const q = a.quantity || 0;
    if (!projectValues[a.project_id]) projectValues[a.project_id] = { current: 0, paid: 0 };
    projectValues[a.project_id].current += unit * q;
    projectValues[a.project_id].paid += paid * q;
  });

  const projectReports = projects.map((p: any) => {
    const v = projectValues[p.id] || { current: 0, paid: 0 };
    const nd = needed.filter((n: any) => n.project_id === p.id).length;
    return {
      ...p,
      allocatedCurrent: v.current,
      allocatedPaid: v.paid,
      needed: nd,
    };
  }).sort((a: any, b: any) => (b.allocatedCurrent || 0) - (a.allocatedCurrent || 0));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
          <p className="text-zinc-400 mt-1">Stock levels, value breakdowns, project summaries, and exports.</p>
        </div>
        <Button onClick={handleExport} size="lg" className="gap-2">
          <Download className="h-4 w-4" /> Download Full Export (ZIP)
        </Button>
      </div>

      <div className="text-xs text-zinc-500 mb-6">Export includes complete CSV backup of inventory + lookups. Data below is live from your collection.</div>

      {/* Export reminder */}
      <div className="mb-8 p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm">
        <div className="font-medium flex items-center gap-2 mb-1"><Download className="h-4 w-4" /> Backup your data regularly</div>
        <div className="text-zinc-400">The ZIP contains CSVs for kits, parts, paints, allocations history, projects, and more. Safe for long-term archival.</div>
      </div>

      {loading ? (
        <div className="text-zinc-400">Loading report data...</div>
      ) : (
        <>
          {/* Out of Stock Report */}
          <div className="mb-10">
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-400" /> Out of Stock Report (Parts &amp; Paints — 0 Available)</h2>
            {outOfStock.length === 0 ? (
              <div className="card p-6 text-emerald-400">No out of stock items. Your workbench is well supplied.</div>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="text-left px-4 py-3">Type</th>
                      <th className="text-left px-4 py-3">Item</th>
                      <th className="text-left px-4 py-3">Location</th>
                      <th className="text-right px-4 py-3">Available</th>
                      <th className="text-right px-4 py-3">Owned</th>
                      <th className="text-right px-4 py-3">Est. Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {outOfStock.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 capitalize text-zinc-400">{row.type}</td>
                        <td className="px-4 py-2.5 font-medium">{row.name}</td>
                        <td className="px-4 py-2.5 text-zinc-400">{row.location}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-amber-400 tabular-nums">{row.available}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{row.owned}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">${row.value.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Value Breakdowns */}
          <div className="mb-10">
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Value Breakdowns</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card p-5">
                <div className="text-sm text-zinc-400 mb-2">Total Current Portfolio Value</div>
                <div className="text-4xl font-semibold tabular-nums">${totalCurrentValue.toFixed(0)}</div>
                <div className="mt-4 text-xs text-zinc-500">Sum of (current_value or price_paid) × quantity_owned across all inventory.</div>
              </div>

              <div className="card p-5">
                <div className="text-sm text-zinc-400 mb-2">Value by Location</div>
                <div className="space-y-1 text-sm max-h-48 overflow-auto">
                  {Object.entries(valueByLocation).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([loc, val]) => (
                    <div key={loc} className="flex justify-between py-0.5 border-b border-zinc-900 last:border-0">
                      <span>{loc}</span>
                      <span className="tabular-nums font-medium">${val.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5 md:col-span-2">
                <div className="text-sm text-zinc-400 mb-2">Top Manufacturers / Brands by Value</div>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1 text-sm">
                  {Object.entries(valueByMfr).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([mfr, val]) => (
                    <div key={mfr} className="flex justify-between py-0.5">
                      <span className="truncate">{mfr}</span>
                      <span className="tabular-nums font-medium">${val.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Project Summaries */}
          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Project Value &amp; Status Summaries</h2>
            {projectReports.length === 0 ? (
              <div className="text-sm text-zinc-400">No projects yet.</div>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="text-left px-4 py-3">Project</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-right px-4 py-3">Progress</th>
                      <th className="text-right px-4 py-3">Allocated Value (Current)</th>
                      <th className="text-right px-4 py-3">Needed Items</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {projectReports.map((p: any, i: number) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-medium">{p.name}</td>
                        <td className="px-4 py-2.5 capitalize text-zinc-400">{p.status}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{p.progress_percent ?? 0}%</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">${(p.allocatedCurrent || 0).toFixed(0)}</td>
                        <td className="px-4 py-2.5 text-right text-amber-400">{p.needed || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-2 text-xs text-zinc-500">Allocated value calculated from current item values × allocated quantity in each project.</div>
          </div>
        </>
      )}
    </div>
  );
}
