/**
 * Inventory (the Materials screen).
 *
 * Behaviour is held at parity with v2: the title counts ALL materials rather
 * than the filtered set, search matches name OR supplier, the "*" convention
 * shows a (common) tag, and pagination steps 14 rows at a time on desktop.
 * The JSON export envelope is byte-compatible with v2's, so the backups
 * already sitting in Downloads still import.
 *
 * Mobile gets a card list instead of a table -- a 6-column grid is unusable
 * at 375px, which is the width this is actually used at in the shop.
 */
import { useMemo, useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Search, Upload, Download, Pencil, Trash2, MoreVertical } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { MaterialDialog } from "@/components/inventory/MaterialDialog";
import { useMaterials, useDeleteMaterial } from "@/lib/queries";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/queries";
import { money, qty } from "@shared/money";
import { cn } from "@/lib/utils";
import type { WireMaterial } from "@shared/types";

const PAGE_STEP = 14; // v2 used paginate step={14}

/** Filters the Dashboard's attention cards link into. */
type Filter = "all" | "zero-qty" | "zero-cost" | "common";

const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  "zero-qty": "Base qty 0",
  "zero-cost": "No cost",
  common: "Common (*)",
};

function MaterialRowActions({
  material,
  onEdit,
  onDelete,
}: {
  material: WireMaterial;
  onEdit: (m: WireMaterial) => void;
  onDelete: (m: WireMaterial) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => onEdit(material)} aria-label={`Edit ${material.name}`}>
        <Pencil className="size-3.5" />
        <span className="max-lg:hidden">Edit</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(material)}
        aria-label={`Delete ${material.name}`}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
        <span className="max-lg:hidden">Delete</span>
      </Button>
    </div>
  );
}

export default function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const { data, isLoading } = useMaterials();
  const del = useDeleteMaterial();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE_STEP);
  const [editing, setEditing] = useState<WireMaterial | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WireMaterial | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const filter = (params.get("filter") as Filter | null) ?? "all";

  // The dashboard's "Add a material" quick action deep-links here.
  useEffect(() => {
    if (params.get("new") === "1") {
      setEditing(null);
      setDialogOpen(true);
      params.delete("new");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const all = data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((m) => {
      if (filter === "zero-qty" && m.base_qty !== 0) return false;
      if (filter === "zero-cost" && !(m.base_cost === 0 && m.base_qty !== 0)) return false;
      if (filter === "common" && !m.name.includes("*")) return false;
      if (!q) return true;
      // v2 matched name OR supplier.
      return (
        m.name.toLowerCase().includes(q) || (m.supplier ?? "").toLowerCase().includes(q)
      );
    });
  }, [all, search, filter]);

  const shown = filtered.slice(0, visible);

  const setFilter = (f: Filter) => {
    if (f === "all") params.delete("filter");
    else params.set("filter", f);
    setParams(params, { replace: true });
    setVisible(PAGE_STEP);
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (m: WireMaterial) => {
    setEditing(m);
    setDialogOpen(true);
  };

  const confirmDelete = () => {
    const m = pendingDelete;
    if (!m) return;
    setPendingDelete(null);
    del.mutate(String(m.id), {
      onSuccess: (res) => toast.success(res.message ?? `Deleted ${m.name}`),
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Could not delete material"),
    });
  };

  const exportJson = () => {
    // Envelope kept byte-compatible with v2's ioAdapters so existing backup
    // files remain valid in both directions.
    const payload = {
      kind: "materials",
      version: 1,
      exported_at: new Date().toISOString(),
      data: all,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `costcalc_materials_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${all.length} materials`);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { kind?: string; data?: WireMaterial[] };
      if (parsed.kind !== "materials" || !Array.isArray(parsed.data)) {
        toast.error("That file is not a materials export.");
        return;
      }
      const res = await api.materials.replaceAll(parsed.data);
      await qc.invalidateQueries({ queryKey: keys.materials });
      toast.success(`Imported ${res.created} materials`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that file");
    }
  };

  return (
    <>
      <PageHeader
        // Total, not the filtered count -- matching v2.
        title={`Inventory (${all.length})`}
        subtitle="Base cost & base quantity. Use * in name for common items."
        actions={
          <>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Add
            </Button>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" /> Import
            </Button>
            <Button variant="outline" onClick={exportJson}>
              <Download className="size-4" /> Export
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJson(f);
                e.target.value = "";
              }}
            />
          </>
        }
      />

      <Card className="overflow-hidden">
        {/* Search + filters */}
        <div className="flex flex-col gap-3 border-b border-card-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisible(PAGE_STEP);
              }}
              placeholder="Search by name or supplier…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === f
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {FILTER_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {search || filter !== "all"
              ? "No materials match that search."
              : "No materials yet. Add your first one."}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="max-md:hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
                      Base Cost
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
                      Base Qty
                    </th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Supplier</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m) => (
                    <tr key={m.id} className="warm-row border-t border-card-border">
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{m.name}</span>
                        {m.name.includes("*") ? (
                          <span className="badge-blush ml-2">common</span>
                        ) : null}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-right tabular",
                          m.base_cost === 0 && "text-urgent",
                        )}
                      >
                        {money(m.base_cost)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-right tabular",
                          m.base_qty === 0 && "font-medium text-urgent",
                        )}
                      >
                        {qty(m.base_qty)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m.supplier || "–"}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn("text-xs", m.active ? "text-success" : "text-muted-foreground")}>
                          {m.active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <MaterialRowActions material={m} onEdit={openEdit} onDelete={setPendingDelete} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="flex flex-col md:hidden">
              {shown.map((m) => (
                <li key={m.id} className="warm-row border-t border-card-border px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        {m.name.includes("*") ? <span className="badge-blush">common</span> : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className={cn("tabular", m.base_cost === 0 && "text-urgent")}>
                          {money(m.base_cost)}
                        </span>
                        <span className={cn("tabular", m.base_qty === 0 && "font-medium text-urgent")}>
                          per {qty(m.base_qty)}
                        </span>
                        {m.supplier ? <span>{m.supplier}</span> : null}
                        {!m.active ? <span>Disabled</span> : null}
                      </div>
                    </div>
                    <MaterialRowActions material={m} onEdit={openEdit} onDelete={setPendingDelete} />
                  </div>
                </li>
              ))}
            </ul>

            {visible < filtered.length ? (
              <div className="flex items-center justify-between gap-3 border-t border-card-border p-4">
                <span className="text-xs text-muted-foreground">
                  Showing {shown.length} of {filtered.length}
                </span>
                <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE_STEP)}>
                  Load more
                </Button>
              </div>
            ) : (
              <div className="border-t border-card-border p-4 text-xs text-muted-foreground">
                Showing all {filtered.length}
                {filtered.length !== all.length ? ` of ${all.length}` : ""}
              </div>
            )}
          </>
        )}
      </Card>

      <MaterialDialog open={dialogOpen} onOpenChange={setDialogOpen} material={editing} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete material: ${pendingDelete?.name}?`}
        description="Products that already use it keep their saved line item and cost."
        onConfirm={confirmDelete}
      />
    </>
  );
}
