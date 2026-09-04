/**
 * Calculator line items.
 *
 * Desktop keeps v2's six-column layout but drops its `minWidth: 1040`, which
 * forced a horizontal scrollbar on any laptop narrower than that. The grid is
 * fluid instead.
 *
 * Below md each row becomes a card: name and line cost on top, then base cost
 * / base qty / used qty as a 3-up grid editable IN PLACE. Adjusting used_qty
 * is the single most frequent action in this app and must never cost an extra
 * tap, so it is never hidden behind a drawer.
 */
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaterialPicker } from "./MaterialPicker";
import { draft, type DraftRow } from "@/lib/draft";
import { unitCost, lineCost } from "@shared/costMath";
import { money } from "@shared/money";
import { cn } from "@/lib/utils";
import type { WireMaterial } from "@shared/types";

/**
 * Selecting a material patches identity and base values but deliberately
 * NOT used_qty -- v2 behaved the same way, so swapping a material keeps the
 * quantity you already typed.
 */
function applyMaterial(rowId: string, m: WireMaterial) {
  draft.patchRow(rowId, {
    materialId: String(m.id),
    name: m.name,
    base_cost: String(m.base_cost),
    base_qty: String(m.base_qty),
  });
}

function RowNumbers({ row }: { row: DraftRow }) {
  return (
    <>
      <NumericInput
        aria-label="Base cost"
        value={row.base_cost}
        onChange={(e) => draft.patchRow(row.rowId, { base_cost: e.target.value })}
      />
      <NumericInput
        aria-label="Base quantity"
        value={row.base_qty}
        onChange={(e) => draft.patchRow(row.rowId, { base_qty: e.target.value })}
        className={cn(Number(row.base_qty) === 0 && "border-urgent text-urgent")}
      />
      <NumericInput
        aria-label="Used quantity"
        value={row.used_qty}
        onChange={(e) => draft.patchRow(row.rowId, { used_qty: e.target.value })}
      />
    </>
  );
}

export function LineItems({ rows }: { rows: DraftRow[] }) {
  return (
    <div>
      {/* Desktop */}
      <div className="max-md:hidden">
        <div className="grid grid-cols-[minmax(200px,1fr)_110px_110px_110px_100px_110px_44px] items-center gap-2 border-b border-card-border px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>Material</span>
          <span className="text-right">Base Cost</span>
          <span className="text-right">Base Qty</span>
          <span className="text-right">Used Qty</span>
          <span className="text-right">Unit</span>
          <span className="text-right">Line Cost</span>
          <span />
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No line items yet. Add a material to start.
          </p>
        ) : (
          rows.map((row) => {
            const unit = unitCost(row.base_cost, row.base_qty);
            const cost = lineCost(row);
            return (
              <div
                key={row.rowId}
                className="grid grid-cols-[minmax(200px,1fr)_110px_110px_110px_100px_110px_44px] items-center gap-2 border-b border-card-border px-4 py-2"
              >
                <MaterialPicker
                  value={row.name}
                  onSelect={(m) => applyMaterial(row.rowId, m)}
                />
                <RowNumbers row={row} />
                <span className="text-right text-xs tabular text-muted-foreground">
                  {money(unit)} / u
                </span>
                <span className="text-right text-sm font-medium tabular">{money(cost)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${row.name}`}
                  className="text-destructive hover:text-destructive"
                  onClick={() => draft.removeRow(row.rowId)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No line items yet. Add a material to start.
          </p>
        ) : (
          rows.map((row) => {
            const unit = unitCost(row.base_cost, row.base_qty);
            const cost = lineCost(row);
            return (
              <div key={row.rowId} className="border-b border-card-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <MaterialPicker value={row.name} onSelect={(m) => applyMaterial(row.rowId, m)} />
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular">{money(cost)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.name}`}
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => draft.removeRow(row.rowId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label>Base cost</Label>
                    <NumericInput
                      aria-label="Base cost"
                      value={row.base_cost}
                      onChange={(e) => draft.patchRow(row.rowId, { base_cost: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Base qty</Label>
                    <NumericInput
                      aria-label="Base quantity"
                      value={row.base_qty}
                      onChange={(e) => draft.patchRow(row.rowId, { base_qty: e.target.value })}
                      className={cn(Number(row.base_qty) === 0 && "border-urgent text-urgent")}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Used qty</Label>
                    <NumericInput
                      aria-label="Used quantity"
                      value={row.used_qty}
                      onChange={(e) => draft.patchRow(row.rowId, { used_qty: e.target.value })}
                    />
                  </div>
                </div>

                <p className="mt-1.5 text-xs text-muted-foreground">{money(unit)} per unit</p>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4">
        <Button variant="outline" size="sm" onClick={() => draft.addRow()}>
          <Plus className="size-4" /> Add Material
        </Button>
      </div>
    </div>
  );
}
