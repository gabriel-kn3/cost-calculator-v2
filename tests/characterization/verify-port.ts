/**
 * The Phase 1 gate: proves shared/costMath.ts reproduces the ORIGINAL
 * JavaScript exactly, using tests/characterization/baseline.json as the
 * contract. Any difference is a port bug, not an improvement.
 *
 *   npx tsx tests/characterization/verify-port.ts
 */
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "./lib/csv.mjs";

import {
  totalCost, unitCost, lineCost, sumLineCosts, laborCost, taxAmount,
  salePriceFromProfitPercent, profitPercentFromSalePrice, calculateProductFees,
  type Fee, type CostRow, type TaxBasis,
} from "../../shared/costMath.js";
import { safeDiv, roundMoney, toNumber, round2, money, qty } from "../../shared/money.js";

const root = path.resolve(import.meta.dirname, "../..");
const baseline = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "baseline.json"), "utf8"),
);
const DEFAULTS = baseline.defaults as { laborRate: number; tax: number; profitPercent: number; additionalFees: Fee[] };
const products = parseCsv(fs.readFileSync(path.join(root, "data/seed/products_rows.csv"), "utf8"));

const failures: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) failures.push(`${label}\n    expected ${b}\n    actual   ${a}`);
};

// ---- real products -------------------------------------------------------
products.forEach((p: Record<string, string>, i: number) => {
  const expected = baseline.realProducts[i];
  const rows: CostRow[] = JSON.parse(p.materials || "[]").map((m: Record<string, unknown>) => ({
    base_cost: m.base_cost as number, base_qty: m.base_qty as number, used_qty: m.used_qty as number,
  }));
  const totals = totalCost(
    { rows, workedHours: p.worked_hours, laborRate: p.labor_rate, additionalFees: DEFAULTS.additionalFees },
    { taxPercent: DEFAULTS.tax, taxBasis: "subtotal", salePrice: p.sale_price },
  );
  eq(`product[${i}] "${p.name}" totals`, totals, expected.totals);

  const cost = round2(toNumber(totals.total));
  const storedPrice = toNumber(p.sale_price);
  const displayPrice = storedPrice === 0 && cost > 0 ? round2(cost * (1 + DEFAULTS.profitPercent / 100)) : storedPrice;
  eq(`product[${i}] "${p.name}" profitsCard`, {
    cost, profitPercent: DEFAULTS.profitPercent, displayPrice,
    profitAmount: round2(displayPrice - cost),
    isLoss: cost > 0 && displayPrice > 0 && round2(displayPrice - cost) < 0,
  }, expected.profitsCard);
});

// ---- totalCost matrix ----------------------------------------------------
const sampleInput = {
  rows: [
    { base_cost: 10, base_qty: 4, used_qty: 2 },
    { base_cost: 2.5, base_qty: 1, used_qty: 1 },
  ] as CostRow[],
  workedHours: 1.5, laborRate: 12, additionalFees: DEFAULTS.additionalFees,
};
const matrix: Array<[string, unknown]> = [
  ["subtotal basis, tax 7.5", totalCost(sampleInput, { taxPercent: 7.5, taxBasis: "subtotal" })],
  ["sale_price basis, tax 7.5, price 100", totalCost(sampleInput, { taxPercent: 7.5, taxBasis: "sale_price" as TaxBasis, salePrice: 100 })],
  ["no options (all defaults)", totalCost(sampleInput)],
  ["zero fees", totalCost({ ...sampleInput, additionalFees: [] }, { taxPercent: 7.5 })],
  ["empty rows", totalCost({ ...sampleInput, rows: [] }, { taxPercent: 7.5 })],
];
eq("totalCostMatrix", matrix, baseline.totalCostMatrix);

// ---- edge grid -----------------------------------------------------------
const EDGE = [null, undefined, 0, 1, -1, 0.1, 1.005, 1e-9, 1e9, "1,000", "12.5", "abc", "", NaN, Infinity];
const edge: Record<string, Array<[string, unknown]>> = {
  toNumber: EDGE.map((v) => [String(v), toNumber(v)]),
  round2: EDGE.map((v) => [String(v), round2(v)]),
  roundMoney: EDGE.map((v) => [String(v), roundMoney(v)]),
  money: EDGE.map((v) => [String(v), money(v)]),
  qty: EDGE.map((v) => [String(v), qty(v)]),
  safeDiv: ([[1,0],[0,0],[10,4],[1,3],["1,000","2"],[null,2],[2,null]] as Array<[unknown,unknown]>)
    .map(([a,b]) => [`${a}/${b}`, safeDiv(a,b,0)]),
  unitCost: ([[10,4],[10,0],[0,5],["10","4"],[-10,4]] as Array<[unknown,unknown]>)
    .map(([a,b]) => [`${a}|${b}`, unitCost(a,b)]),
  lineCost: ([
    { base_cost: 10, base_qty: 4, used_qty: 2 },
    { base_cost: 10, base_qty: 0, used_qty: 2 },
    { base_cost: "1,000", base_qty: "2", used_qty: "3" },
    { base_cost: 3, base_qty: 1, used_qty: null },
  ] as CostRow[]).map((r) => [JSON.stringify(r), lineCost(r)]),
  laborCost: ([[1,12],["2","12.5"],[0,12],[null,12]] as Array<[unknown,unknown]>)
    .map(([h,r]) => [`${h}|${r}`, laborCost(h,r)]),
  taxAmount: ([[100,7.5],[0,7.5],[100,0],["1,000",7.5]] as Array<[unknown,unknown]>)
    .map(([s,p]) => [`${s}|${p}`, taxAmount(s,p)]),
  salePriceFromProfitPercent: ([[100,20],[0,20],[100,0],[100,-10]] as Array<[unknown,unknown]>)
    .map(([c,p]) => [`${c}|${p}`, salePriceFromProfitPercent(c,p)]),
  profitPercentFromSalePrice: ([[100,120],[0,120],[100,0],[100,90]] as Array<[unknown,unknown]>)
    .map(([c,s]) => [`${c}|${s}`, profitPercentFromSalePrice(c,s)]),
  calculateProductFees: [
    [JSON.stringify([]), calculateProductFees([], 100)],
    ["defaults@100", calculateProductFees(DEFAULTS.additionalFees, 100)],
    ["defaults@0", calculateProductFees(DEFAULTS.additionalFees, 0)],
  ],
  sumLineCosts: [["[]", sumLineCosts([])], ["undefined-arg", sumLineCosts()]],
};
for (const k of Object.keys(baseline.edgeCases)) eq(`edgeCases.${k}`, edge[k], baseline.edgeCases[k]);

// ---- report --------------------------------------------------------------
if (failures.length) {
  console.error(`\nPORT MISMATCH -- ${failures.length} difference(s) vs baseline:\n`);
  for (const f of failures) console.error("  " + f + "\n");
  process.exit(1);
}
console.log("shared/costMath.ts reproduces the original JavaScript EXACTLY");
console.log(`  ${baseline.realProducts.length} real products x (totals + profits card)`);
console.log(`  ${baseline.totalCostMatrix.length} totalCost configurations`);
console.log(`  ${Object.keys(baseline.edgeCases).length} edge-case groups`);
