/**
 * Dashboard: needs-attention first, then the numbers, then quick actions.
 *
 * The attention block is hidden entirely when there is nothing wrong. A
 * permanent "0 issues" banner trains you to stop reading it, so it only
 * appears when it has something to say.
 *
 * Every item below is computed from real data, not a placeholder. The
 * base-qty-of-zero check in particular catches a live condition: a common
 * material priced at 0/0 contributes exactly $0.00 to every product that
 * uses it, silently, via safeDiv.
 */
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Package,
  Plus,
  Settings,
} from "lucide-react";
import { useMaterials, useProducts } from "@/lib/queries";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { money } from "@shared/money";
import { totalCost, type Fee } from "@shared/costMath";
import type { WireMaterial, WireProduct } from "@shared/types";

type Severity = "warn" | "urgent";

interface AttentionItem {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  to: string;
}

/** Recompute each product against TODAY's material prices to find drift. */
function findRepricedProducts(products: WireProduct[], materials: WireMaterial[]) {
  const byId = new Map(materials.map((m) => [String(m.id), m]));
  const drifted: Array<{ product: WireProduct; now: number; delta: number }> = [];

  for (const p of products) {
    // Only meaningful if every line still points at a live material.
    const rows = p.materials.map((r) => {
      const current = r.material_id ? byId.get(String(r.material_id)) : undefined;
      return {
        base_cost: current ? current.base_cost : r.base_cost,
        base_qty: current ? current.base_qty : r.base_qty,
        used_qty: r.used_qty,
      };
    });
    const now = totalCost(
      { rows, workedHours: p.worked_hours, laborRate: p.labor_rate, additionalFees: (p.fees ?? []) as Fee[] },
      { taxPercent: p.tax_percent, taxBasis: p.tax_basis },
    ).total;
    const delta = now - p.cost;
    if (delta > 0.01) drifted.push({ product: p, now, delta });
  }
  return drifted.sort((a, b) => b.delta - a.delta);
}

function buildAttention(materials: WireMaterial[], products: WireProduct[]): AttentionItem[] {
  const items: AttentionItem[] = [];

  const zeroQty = materials.filter((m) => m.base_qty === 0);
  if (zeroQty.length) {
    items.push({
      id: "zero-qty",
      severity: "urgent",
      title: `${zeroQty.length} material${zeroQty.length > 1 ? "s have" : " has"} a base qty of 0`,
      detail: `${zeroQty.map((m) => m.name).join(", ")} — adds $0.00 to every product that uses it.`,
      to: "/inventory?filter=zero-qty",
    });
  }

  const zeroCost = materials.filter((m) => m.base_cost === 0 && m.base_qty !== 0);
  if (zeroCost.length) {
    items.push({
      id: "zero-cost",
      severity: "warn",
      title: `${zeroCost.length} material${zeroCost.length > 1 ? "s have" : " has"} no cost yet`,
      detail: zeroCost.map((m) => m.name).join(", "),
      to: "/inventory?filter=zero-cost",
    });
  }

  const drifted = findRepricedProducts(products, materials);
  if (drifted.length) {
    items.push({
      id: "drift",
      severity: "warn",
      title: `${drifted.length} product${drifted.length > 1 ? "s cost" : " costs"} more than when you saved ${drifted.length > 1 ? "them" : "it"}`,
      detail: `Biggest change: ${drifted[0]!.product.name}, up ${money(drifted[0]!.delta)}.`,
      to: "/products?filter=drift",
    });
  }

  const noPrice = products.filter((p) => p.sale_price === 0);
  if (noPrice.length) {
    items.push({
      id: "no-price",
      severity: "warn",
      title: `${noPrice.length} product${noPrice.length > 1 ? "s have" : " has"} no sale price`,
      detail: "Set a price so profit can be tracked.",
      to: "/products?filter=no-price",
    });
  }

  return items;
}

function AttentionCard({ item, index }: { item: AttentionItem; index: number }) {
  const urgent = item.severity === "urgent";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link
        to={item.to}
        className={cn(
          "group flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
          urgent
            ? "border-urgent-border bg-urgent-muted hover:bg-urgent-muted/70"
            : "border-warning-border bg-warning-muted hover:bg-warning-muted/70",
        )}
      >
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg",
            urgent ? "bg-urgent/15 text-urgent" : "bg-warning/15 text-warning",
          )}
        >
          <AlertTriangle className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{item.title}</span>
          <span className="mt-0.5 block truncate text-xs text-foreground/70">{item.detail}</span>
        </span>
        <ArrowRight className="mt-2 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
      </Link>
    </motion.div>
  );
}

function StatTile({
  label,
  value,
  sub,
  to,
  index,
}: {
  label: string;
  value: string;
  sub?: string;
  to: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={to} className="group block">
        <Card className="p-5 transition-shadow hover:shadow-md">
          <div className="section-label">{label}</div>
          <div className="mt-2 text-2xl font-semibold tabular">{value}</div>
          {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
          <div className="mt-2 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
            View →
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

const QUICK_ACTIONS = [
  { to: "/calculator", icon: Calculator, title: "Price a new product", desc: "Build a draft and compute totals" },
  { to: "/inventory?new=1", icon: Plus, title: "Add a material", desc: "Base cost and base quantity" },
  { to: "/products", icon: Package, title: "Open saved products", desc: "Load one back into the calculator" },
  { to: "/settings", icon: Settings, title: "Pricing settings", desc: "Labor rate, tax, fees, profit" },
] as const;

export default function DashboardPage() {
  const materials = useMaterials();
  const products = useProducts();

  const loading = materials.isLoading || products.isLoading;
  const mats = materials.data ?? [];
  const prods = products.data ?? [];

  const attention = loading ? [] : buildAttention(mats, prods);
  const activeMats = mats.filter((m) => m.active).length;
  const avgCost = prods.length ? prods.reduce((a, p) => a + p.cost, 0) / prods.length : 0;
  const inventoryValue = mats.reduce((a, m) => a + m.base_cost, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Handmade by Bet tool for calculating product costs and warehousing materials."
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          {attention.length > 0 ? (
            <section className="mb-8">
              <h2 className="section-label mb-3">Needs attention</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {attention.map((item, i) => (
                  <AttentionCard key={item.id} item={item} index={i} />
                ))}
              </div>
            </section>
          ) : (
            <section className="mb-8">
              <div className="flex items-center gap-3 rounded-xl border border-success-border bg-success-muted px-4 py-3">
                <CheckCircle2 className="size-4 text-success" />
                <span className="text-sm">Everything looks good.</span>
              </div>
            </section>
          )}

          <section className="mb-8">
            <h2 className="section-label mb-3">Your shop</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile
                index={0}
                label="Materials"
                value={String(mats.length)}
                sub={`${activeMats} active`}
                to="/inventory"
              />
              <StatTile
                index={1}
                label="Saved products"
                value={String(prods.length)}
                sub="ready to load"
                to="/products"
              />
              <StatTile
                index={2}
                label="Average cost"
                value={money(avgCost)}
                sub="per saved product"
                to="/products"
              />
              <StatTile
                index={3}
                label="Catalogue value"
                value={money(inventoryValue)}
                sub="sum of base costs"
                to="/inventory"
              />
            </div>
          </section>

          <section>
            <h2 className="section-label mb-3">Quick actions</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {QUICK_ACTIONS.map(({ to, icon: Icon, title, desc }, i) => (
                <motion.div
                  key={to}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link to={to} className="group block h-full">
                    <Card className="flex h-full items-start gap-3 p-4 transition-shadow hover:shadow-md">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blush-bg text-blush-fg">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
                      </span>
                      <ArrowRight className="mt-1 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
