/**
 * Saved Products.
 *
 * Parity with v2: total count in the title, search on NAME only (not
 * supplier -- that is the Inventory screen), the same six sort orders with
 * date_desc default, and a dirty-draft guard before loading over unsaved work.
 *
 * Dates now sort correctly. v2 wrote last_updated as a locale string via
 * toLocaleDateString() and then sorted with new Date(...) on it, which was
 * locale-dependent; the server now sets ISO timestamps.
 */
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Upload, Download, Trash2, FolderOpen, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { useProducts, useDeleteProduct, useSettings, keys } from "@/lib/queries";
import { api } from "@/lib/api";
import { draft } from "@/lib/draft";
import { ShopifyExportDialog } from "@/components/products/ShopifyExportDialog";
import { money } from "@shared/money";
import type { WireProduct } from "@shared/types";

const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "cost_desc", label: "Cost high → low" },
  { value: "cost_asc", label: "Cost low → high" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

function formatUpdated(iso: string, timezone: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString(locale, { timeZone: timezone, dateStyle: "short" });
  } catch {
    return d.toLocaleDateString();
  }
}

export default function ProductsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useProducts();
  const settings = useSettings();
  const del = useDeleteProduct();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortValue>("date_desc");
  const [pendingDelete, setPendingDelete] = useState<WireProduct | null>(null);
  const [pendingLoad, setPendingLoad] = useState<WireProduct | null>(null);
  const [shopifyOpen, setShopifyOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const all = data ?? [];
  const tz = settings.data?.settings.timezone ?? "America/New_York";
  const locale = settings.data?.settings.locale ?? "en-US";

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? all.filter((p) => (p.name ?? "").toLowerCase().includes(q)) : [...all];

    return list.sort((a, b) => {
      switch (sort) {
        case "date_asc":
          return new Date(a.last_updated).getTime() - new Date(b.last_updated).getTime();
        case "name_asc":
          return (a.name ?? "").localeCompare(b.name ?? "");
        case "name_desc":
          return (b.name ?? "").localeCompare(a.name ?? "");
        case "cost_desc":
          return b.cost - a.cost;
        case "cost_asc":
          return a.cost - b.cost;
        case "date_desc":
        default:
          return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
      }
    });
  }, [all, search, sort]);

  /** Guards unsaved work before overwriting the draft, as v2 did. */
  const requestLoad = (p: WireProduct) => {
    if (draft.isDirty()) setPendingLoad(p);
    else doLoad(p);
  };

  const doLoad = (p: WireProduct) => {
    draft.loadFromProduct(p);
    setPendingLoad(null);
    toast.success("Loaded product into calculator.");
    navigate("/calculator");
  };

  const confirmDelete = () => {
    const p = pendingDelete;
    if (!p) return;
    setPendingDelete(null);
    del.mutate(String(p.id), {
      onSuccess: (res) => toast.success(res.message ?? `Deleted ${p.name}`),
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Could not delete product"),
    });
  };

  const exportJson = () => {
    const payload = {
      kind: "products",
      version: 1,
      exported_at: new Date().toISOString(),
      data: all,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `costcalc_products_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${all.length} products`);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { kind?: string; data?: WireProduct[] };
      if (parsed.kind !== "products" || !Array.isArray(parsed.data)) {
        toast.error("That file is not a products export.");
        return;
      }
      const res = await api.products.replaceAll(parsed.data);
      await qc.invalidateQueries({ queryKey: keys.products });
      toast.success(`Imported ${res.created} products`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that file");
    }
  };

  return (
    <>
      <PageHeader
        title={`Saved Products (${all.length})`}
        subtitle="Load one back into the calculator, or keep it as a record."
        actions={
          <>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" /> Import
            </Button>
            <Button variant="outline" onClick={exportJson}>
              <Download className="size-4" /> Export
            </Button>
            <Button variant="outline" onClick={() => setShopifyOpen(true)}>
              <FileSpreadsheet className="size-4" /> Shopify CSV
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

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="pl-9"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortValue)}
          aria-label="Sort products"
          className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-48"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {search ? `No products match "${search}".` : "No saved products yet."}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <Card key={p.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 text-sm font-medium">{p.name || "Unnamed"}</h3>
                <span className="shrink-0 text-base font-semibold tabular">{money(p.cost)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Updated: {formatUpdated(p.last_updated, tz, locale)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Materials: {p.materials?.length ?? 0} | Worked hours: {p.worked_hours}
              </p>
              {p.sale_price === 0 ? (
                <p className="mt-2 text-xs text-warning">No sale price set</p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Sells for <span className="tabular">{money(p.sale_price)}</span>
                </p>
              )}
              <div className="mt-4 flex items-center gap-2 border-t border-card-border pt-3">
                <Button size="sm" onClick={() => requestLoad(p)}>
                  <FolderOpen className="size-3.5" /> Load
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-destructive hover:text-destructive"
                  onClick={() => setPendingDelete(p)}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ShopifyExportDialog open={shopifyOpen} onOpenChange={setShopifyOpen} products={all} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name}?`}
        description="This removes the saved product and its line items. Materials are untouched."
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={pendingLoad !== null}
        onOpenChange={(o) => !o && setPendingLoad(null)}
        title="Replace your current draft?"
        description="You have unsaved work in the calculator. Loading this product will overwrite it."
        confirmLabel="Load anyway"
        destructive={false}
        onConfirm={() => pendingLoad && doLoad(pendingLoad)}
      />
    </>
  );
}
