/**
 * Labor, Totals and Profits.
 *
 * All copy is carried over VERBATIM from v2 -- including the Spanish subtitle
 * "Costos del producto sin profit**" and the em-dash in the Profits subtitle.
 * The operator set this wording; it is data to migrate, not text to rewrite.
 *
 * The Profits two-way sync reproduces v2's ProfitsCard exactly, round2 and
 * all: typing a percent derives the price, typing a price derives the percent,
 * and while the stored sale price is 0 the displayed price is derived but not
 * persisted.
 */
import { Card } from "@/components/ui/card";
import { NumericInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { draft, type DraftState } from "@/lib/draft";
import { money, round2, toNumber } from "@shared/money";
import type { Totals } from "@shared/types";
import { cn } from "@/lib/utils";

export function LaborCard({ state }: { state: DraftState }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold">Labor</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Optional: worked hours and labor rate</p>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="worked-hours">Worked Hours</Label>
          <NumericInput
            id="worked-hours"
            value={state.workedHours}
            onChange={(e) => draft.setField("workedHours", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="labor-rate">Labor Rate (per hour)</Label>
          <NumericInput
            id="labor-rate"
            value={state.laborRate}
            onChange={(e) => draft.setField("laborRate", e.target.value)}
          />
        </div>
      </div>
    </Card>
  );
}

function Line({
  label,
  value,
  strong,
  underline,
}: {
  label: string;
  value: string;
  strong?: boolean;
  underline?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-sm", strong ? "font-semibold" : "text-muted-foreground")}>
        {label}
      </span>
      <span className={cn("text-sm tabular", strong && "font-semibold", underline && "underline")}>
        {value}
      </span>
    </div>
  );
}

export function TotalsCard({ totals, taxPercent }: { totals: Totals; taxPercent: string }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold">Totals</h3>
      {/* Verbatim from v2. Do not translate or "fix" the trailing asterisks. */}
      <p className="mt-0.5 text-xs text-muted-foreground">Costos del producto sin profit**</p>
      <div className="mt-4 flex flex-col gap-2">
        <Line label="Materials" value={money(totals.materials)} />
        <Line label="Labor" value={money(totals.labor)} />
        <div className="mt-1 border-t border-card-border pt-2">
          <Line label="Sub-Total" value={money(totals.subTotal)} strong />
        </div>
        <Line label="Product Fees" value={money(totals.productFees)} strong />
        <Line label={`Tax (${taxPercent}%)`} value={money(totals.tax)} strong />
        <Line label="Total" value={money(totals.total)} strong underline />
      </div>
    </Card>
  );
}

export function ProfitsCard({ state, totals }: { state: DraftState; totals: Totals }) {
  // Reproduces ProfitsCard.jsx:12-23 exactly, including its use of round2
  // rather than roundMoney.
  const cost = round2(toNumber(totals.total));
  const pct = toNumber(state.profitPercent);
  const storedPrice = toNumber(state.salePrice);
  const displayPrice = storedPrice === 0 && cost > 0 ? round2(cost * (1 + pct / 100)) : storedPrice;
  const profitAmt = round2(displayPrice - cost);
  const isLoss = cost > 0 && displayPrice > 0 && profitAmt < 0;

  const onPercent = (raw: string) => {
    draft.setField("profitPercent", raw);
    const nextPct = toNumber(raw);
    const nextSale = cost > 0 ? round2(cost * (1 + nextPct / 100)) : 0;
    draft.setField("salePrice", String(nextSale));
  };

  const onPrice = (raw: string) => {
    draft.setField("salePrice", raw);
    const nextSale = toNumber(raw);
    const nextPct = cost > 0 ? round2(((nextSale - cost) / cost) * 100) : 0;
    draft.setField("profitPercent", String(nextPct));
  };

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold">Profits</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Adjust margin or target price — they stay in sync
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profit-pct">Profit %</Label>
          <NumericInput
            id="profit-pct"
            value={state.profitPercent}
            onChange={(e) => onPercent(e.target.value)}
            placeholder="e.g. 25"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sale-price">Suggested Price</Label>
          <NumericInput
            id="sale-price"
            value={storedPrice === 0 ? String(displayPrice) : state.salePrice}
            onChange={(e) => onPrice(e.target.value)}
            placeholder="e.g. 149.99"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-card-border pt-3">
        <div>
          <div className="section-label">Product Cost</div>
          <div className="mt-1 text-sm font-semibold tabular">{money(cost)}</div>
        </div>
        <div className="text-right">
          <div className="section-label">Profit</div>
          <div
            className={cn(
              "mt-1 text-sm font-semibold tabular",
              isLoss ? "text-destructive" : "text-success",
            )}
          >
            {money(profitAmt)}
          </div>
        </div>
      </div>

      {/* Markup on cost, not gross margin -- worth stating, since the
          difference is the classic pricing footgun. */}
      {cost > 0 && displayPrice > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {pct}% markup on {money(cost)} prices at {money(displayPrice)} — you keep{" "}
          {money(profitAmt)}, which is {round2((profitAmt / displayPrice) * 100)}% of the sale.
        </p>
      ) : null}
    </Card>
  );
}
