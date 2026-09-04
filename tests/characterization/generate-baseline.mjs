// Generates the golden-master baseline for the frozen cost math.
//
// This runs the CURRENT, UNMODIFIED src/utils/calc/*.js against the real
// recovered production data. The output is the contract: the TypeScript port
// in shared/costMath.ts must reproduce this file exactly. Any difference is a
// port bug, not an improvement.
//
//   node tests/characterization/generate-baseline.mjs

import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "./lib/csv.mjs";

import { totalCost, unitCost, lineCost, sumLineCosts, laborCost,
         taxAmount, salePriceFromProfitPercent, profitPercentFromSalePrice,
         calculateProductFees } from "../../src/utils/calc/costMath.js";
import { safeDiv, roundMoney } from "../../src/utils/calc/normalize.js";
import { toNumber, round2, money, qty } from "../../src/utils/ui/formatters.js";

// Verbatim from CalculationProvider.jsx initialState (lines 11-32).
const DEFAULTS = {
  laborRate: 12,
  tax: 7.5,
  profitPercent: 20,
  additionalFees: [
    { serviceName: "Shopify", percentage: 2.9 },
    { serviceName: "Credit Card", percentage: 2.9 },
  ],
};

const root = path.resolve(import.meta.dirname, "../..");
const products = parseCsv(fs.readFileSync(path.join(root, "data/seed/products_rows.csv"), "utf8"));

// ---------------------------------------------------------------- real products
const realProducts = products.map((p) => {
  const bom = JSON.parse(p.materials || "[]");
  const rows = bom.map((m) => ({
    base_cost: m.base_cost,
    base_qty: m.base_qty,
    used_qty: m.used_qty,
  }));

  const input = {
    rows,
    workedHours: p.worked_hours,
    laborRate: p.labor_rate,
    additionalFees: DEFAULTS.additionalFees,
  };
  const opts = { taxPercent: DEFAULTS.tax, taxBasis: "subtotal", salePrice: p.sale_price };

  const totals = totalCost(input, opts);

  // ProfitsCard.jsx:12-23 derives a display price when the stored one is 0.
  const cost = round2(toNumber(totals.total));
  const storedPrice = toNumber(p.sale_price);
  const displayPrice =
    storedPrice === 0 && cost > 0 ? round2(cost * (1 + DEFAULTS.profitPercent / 100)) : storedPrice;

  return {
    id: p.id,
    name: p.name,
    storedCost: p.cost,                 // what the old backend persisted
    workedHours: p.worked_hours,
    laborRate: p.labor_rate,
    bomLines: rows.length,
    totals,
    profitsCard: {
      cost,
      profitPercent: DEFAULTS.profitPercent,
      displayPrice,
      profitAmount: round2(displayPrice - cost),
      isLoss: cost > 0 && displayPrice > 0 && round2(displayPrice - cost) < 0,
    },
  };
});

// ------------------------------------------------------------------- edge grid
const EDGE = [null, undefined, 0, 1, -1, 0.1, 1.005, 1e-9, 1e9, "1,000", "12.5", "abc", "", NaN, Infinity];

const edgeCases = {
  toNumber:  EDGE.map((v) => [String(v), toNumber(v)]),
  round2:    EDGE.map((v) => [String(v), round2(v)]),
  roundMoney:EDGE.map((v) => [String(v), roundMoney(v)]),
  money:     EDGE.map((v) => [String(v), money(v)]),
  qty:       EDGE.map((v) => [String(v), qty(v)]),
  safeDiv:   [[1,0],[0,0],[10,4],[1,3],["1,000","2"],[null,2],[2,null]].map(([a,b]) => [`${a}/${b}`, safeDiv(a,b,0)]),
  unitCost:  [[10,4],[10,0],[0,5],["10","4"],[-10,4]].map(([a,b]) => [`${a}|${b}`, unitCost(a,b)]),
  lineCost:  [
    { base_cost: 10, base_qty: 4, used_qty: 2 },
    { base_cost: 10, base_qty: 0, used_qty: 2 },   // base_qty 0 -> contributes $0
    { base_cost: "1,000", base_qty: "2", used_qty: "3" },
    { base_cost: 3, base_qty: 1, used_qty: null },
  ].map((r) => [JSON.stringify(r), lineCost(r)]),
  laborCost: [[1,12],["2","12.5"],[0,12],[null,12]].map(([h,r]) => [`${h}|${r}`, laborCost(h,r)]),
  taxAmount: [[100,7.5],[0,7.5],[100,0],["1,000",7.5]].map(([s,p]) => [`${s}|${p}`, taxAmount(s,p)]),
  salePriceFromProfitPercent: [[100,20],[0,20],[100,0],[100,-10]].map(([c,p]) => [`${c}|${p}`, salePriceFromProfitPercent(c,p)]),
  profitPercentFromSalePrice: [[100,120],[0,120],[100,0],[100,90]].map(([c,s]) => [`${c}|${s}`, profitPercentFromSalePrice(c,s)]),
  calculateProductFees: [
    [JSON.stringify([]), calculateProductFees([], 100)],
    ["defaults@100", calculateProductFees(DEFAULTS.additionalFees, 100)],
    ["defaults@0", calculateProductFees(DEFAULTS.additionalFees, 0)],
  ],
  sumLineCosts: [["[]", sumLineCosts([])], ["undefined-arg", sumLineCosts()]],
};

// totalCost across both tax bases, incl. the never-exposed "sale_price" branch.
const sampleInput = {
  rows: [
    { base_cost: 10, base_qty: 4, used_qty: 2 },
    { base_cost: 2.5, base_qty: 1, used_qty: 1 },
  ],
  workedHours: 1.5,
  laborRate: 12,
  additionalFees: DEFAULTS.additionalFees,
};
const totalCostMatrix = [
  ["subtotal basis, tax 7.5", totalCost(sampleInput, { taxPercent: 7.5, taxBasis: "subtotal" })],
  ["sale_price basis, tax 7.5, price 100", totalCost(sampleInput, { taxPercent: 7.5, taxBasis: "sale_price", salePrice: 100 })],
  ["no options (all defaults)", totalCost(sampleInput)],
  ["zero fees", totalCost({ ...sampleInput, additionalFees: [] }, { taxPercent: 7.5 })],
  ["empty rows", totalCost({ ...sampleInput, rows: [] }, { taxPercent: 7.5 })],
];

// --------------------------------------------------------------- provenance
// Stored `cost` values were written over time under DIFFERENT fee configs:
// the oldest product predates the product-fees feature. Recording which config
// reproduces each stored cost proves we understand the data, and tells the
// migration what fee snapshot to attach to each product rather than blindly
// recomputing (which would silently reprice history).
const FEE_CONFIGS = [
  ["tax7.5+bothFees", DEFAULTS.additionalFees, 7.5],
  ["tax7.5+shopifyOnly", [DEFAULTS.additionalFees[0]], 7.5],
  ["tax7.5+noFees", [], 7.5],
  ["noTax+bothFees", DEFAULTS.additionalFees, 0],
  ["noTax+noFees", [], 0],
];

const provenance = products.map((p) => {
  const rows = JSON.parse(p.materials || "[]").map((m) => ({
    base_cost: m.base_cost, base_qty: m.base_qty, used_qty: m.used_qty,
  }));
  const stored = toNumber(p.cost);
  let matched = null;
  for (const [label, fees, taxPct] of FEE_CONFIGS) {
    const t = totalCost(
      { rows, workedHours: p.worked_hours, laborRate: p.labor_rate, additionalFees: fees },
      { taxPercent: taxPct, taxBasis: "subtotal" }
    );
    if (Math.abs(t.total - stored) < 0.005) { matched = { label, fees, taxPercent: taxPct, total: t.total }; break; }
  }
  return { id: p.id, name: p.name, storedCost: stored, reproducedBy: matched?.label ?? null,
           taxPercent: matched?.taxPercent ?? null, fees: matched?.fees ?? null };
});

const provenanceSummary = provenance.reduce((acc, r) => {
  const k = r.reproducedBy ?? "UNEXPLAINED";
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});

const baseline = {
  _README:
    "Golden master for the frozen cost math. Generated from the UNMODIFIED " +
    "src/utils/calc/*.js against real recovered production data. The TypeScript " +
    "port must reproduce this exactly; any diff is a port bug, not an improvement.",
  // No timestamp: the baseline must be byte-stable so `git diff` only ever
  // shows a real change in the math.
  source: "data/seed/products_rows.csv",
  defaults: DEFAULTS,
  productCount: realProducts.length,
  realProducts,
  provenance,
  provenanceSummary,
  totalCostMatrix,
  edgeCases,
};

const out = path.join(import.meta.dirname, "baseline.json");
fs.writeFileSync(out, JSON.stringify(baseline, null, 2) + "\n");
console.log(`baseline written: ${path.relative(root, out)}`);
console.log(`  products: ${realProducts.length}`);
console.log(`  BOM lines: ${realProducts.reduce((a, p) => a + p.bomLines, 0)}`);
