/**
 * Shopify export.
 *
 * Deliberately a dialog rather than a one-click button: the choice of WHICH
 * products go out matters, and unpriced products would otherwise import at
 * $0.00 without anyone noticing.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadShopifyCsv } from "@/lib/shopifyCsv";
import { money } from "@shared/money";
import { cn } from "@/lib/utils";
import type { WireProduct } from "@shared/types";

type Scope = "priced" | "all";

export function ShopifyExportDialog({
  open,
  onOpenChange,
  products,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: WireProduct[];
}) {
  const [scope, setScope] = useState<Scope>("priced");
  const [vendor, setVendor] = useState("Handmade by Bet");
  const [fallback, setFallback] = useState(false);

  const priced = useMemo(() => products.filter((p) => p.sale_price > 0), [products]);
  const unpriced = products.length - priced.length;
  const selected = scope === "priced" ? priced : products;

  const doExport = () => {
    if (selected.length === 0) {
      toast.error("Nothing to export with those options.");
      return;
    }
    downloadShopifyCsv(selected, { vendor, priceFallbackToCost: fallback });
    onOpenChange(false);
    toast.success(`Exported ${selected.length} products for Shopify`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export for Shopify</DialogTitle>
          <DialogDescription>
            A CSV you can import in Shopify under Products → Import. Everything arrives as a{" "}
            <strong>draft</strong>, so nothing goes on sale by accident.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Which products</Label>
            {(
              [
                ["priced", `Only products with a sale price (${priced.length})`],
                ["all", `All products (${products.length})`],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  scope === value ? "border-primary bg-primary/10" : "border-border",
                )}
              >
                <input
                  type="radio"
                  name="scope"
                  className="accent-primary"
                  checked={scope === value}
                  onChange={() => setScope(value)}
                />
                {label}
              </label>
            ))}
            {scope === "all" && unpriced > 0 ? (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-warning-border bg-warning-muted px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={fallback}
                  onChange={(e) => setFallback(e.target.checked)}
                />
                <span>
                  {unpriced} product{unpriced > 1 ? "s have" : " has"} no sale price and would
                  import at {money(0)}. Use the calculated cost as the price instead?
                </span>
              </label>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vendor">Vendor</Label>
            <Input id="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </div>

          <p className="rounded-md border border-card-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Each row carries <strong>Cost per item</strong>, so Shopify shows real margin computed
            from your material costs. Product notes are not exported — they are internal working
            notes, not storefront copy. This is an export, not a backup: use{" "}
            <strong>Settings → Data</strong> to back everything up.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={doExport}>
            <FileSpreadsheet className="size-4" /> Export {selected.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
