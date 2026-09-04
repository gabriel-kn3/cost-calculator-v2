/**
 * FROZEN SEMANTICS -- the business logic of the whole application.
 *
 * Ported 1:1 from src/utils/calc/costMath.js. Verified byte-identical against
 * tests/characterization/baseline.json, which was generated from the ORIGINAL
 * JavaScript run over 17 real recovered products.
 *
 * Deliberately preserved quirks (all pinned by tests):
 *   - `productFees` is returned UNROUNDED while its siblings are rounded, so
 *     the displayed line items can sum to +/-$0.01 off the displayed Total.
 *     It feeds `total`, which IS rounded; rounding it early shifts the total.
 *   - base_qty === 0 makes a line contribute exactly $0 (via safeDiv), rather
 *     than erroring. One material in live data is in this state.
 *   - Profit is MARKUP ON COST, not gross margin: 20% on $100 gives $120,
 *     which is a 16.7% margin. Label it clearly in UI; do not change the math.
 *   - calculateProductFees() throws if `feesArray` is undefined. Callers must
 *     always pass an array.
 *
 * Any change here reprices the operator's catalogue. Don't.
 */

import { safeDiv, roundMoney, toNumber } from "./money.js";

export interface CostRow {
  base_cost: number | string | null | undefined;
  base_qty: number | string | null | undefined;
  used_qty: number | string | null | undefined;
}

export interface Fee {
  /** Display name, e.g. "Shopify". */
  serviceName?: string;
  /** Percent, e.g. 2.9 means 2.9%. */
  percentage: number | string;
}

export interface TotalCostInput {
  rows: CostRow[];
  workedHours: number | string | null | undefined;
  laborRate: number | string | null | undefined;
  additionalFees: Fee[];
}

export type TaxBasis = "subtotal" | "sale_price";

export interface TotalCostOptions {
  /** e.g. 7.5 means 7.5%. */
  taxPercent?: number | string;
  taxBasis?: TaxBasis;
  /** Only consulted when taxBasis === "sale_price". */
  salePrice?: number | string;
}

export interface Totals {
  materials: number;
  labor: number;
  subTotal: number;
  tax: number;
  /** NOT rounded -- see the note at the top of this file. */
  productFees: number;
  total: number;
}

/** Cost of a single unit of a material. base_qty of 0 yields 0, not Infinity. */
export function unitCost(baseCost: unknown, baseQty: unknown): number {
  return safeDiv(baseCost, baseQty, 0);
}

export function lineCost({ base_cost, base_qty, used_qty }: CostRow): number {
  const u = unitCost(base_cost, base_qty);
  return u * toNumber(used_qty, 0);
}

export function sumLineCosts(rows: CostRow[] = []): number {
  return rows.reduce((acc, r) => acc + lineCost(r), 0);
}

export function laborCost(workedHours: unknown, laborRate: unknown): number {
  return toNumber(workedHours, 0) * toNumber(laborRate, 0);
}

/** taxPercent: e.g. 7.5 means 7.5%. */
export function taxAmount(subtotal: unknown, taxPercent: unknown): number {
  const sub = toNumber(subtotal, 0);
  const pct = toNumber(taxPercent, 0);
  return sub * (pct / 100);
}

/** MARKUP on cost, not margin. 20% on 100 -> 120. */
export function salePriceFromProfitPercent(totalCost: unknown, profitPercent: unknown): number {
  const cost = toNumber(totalCost, 0);
  const pct = toNumber(profitPercent, 0);
  return cost * (1 + pct / 100);
}

/** Inverse of salePriceFromProfitPercent. Zero-or-negative cost yields 0. */
export function profitPercentFromSalePrice(totalCost: unknown, salePrice: unknown): number {
  const cost = toNumber(totalCost, 0);
  const price = toNumber(salePrice, 0);
  if (cost <= 0) return 0;
  return ((price - cost) / cost) * 100;
}

export function profitDollars(totalCost: unknown, salePrice: unknown): number {
  const cost = toNumber(totalCost, 0);
  const price = toNumber(salePrice, 0);
  return price - cost;
}

/** Percentage-based platform fees, applied to the SUBTOTAL. */
export function calculateProductFees(feesArray: Fee[], subTotal: number): number {
  return feesArray.reduce((acc, fee) => {
    const calculatedFee = toNumber(subTotal * (toNumber(fee.percentage, 0) / 100), 0);
    return acc + calculatedFee;
  }, 0);
}

export function totalCost(
  { rows, workedHours, laborRate, additionalFees }: TotalCostInput,
  { taxPercent = 0, taxBasis = "subtotal", salePrice = 0 }: TotalCostOptions = {},
): Totals {
  const materials = sumLineCosts(rows);
  const labor = laborCost(workedHours, laborRate);
  const subtotal = materials + labor;
  const fees = calculateProductFees(additionalFees, subtotal);

  const taxBase = taxBasis === "sale_price" ? toNumber(salePrice, 0) : subtotal;

  const tax = taxAmount(taxBase, taxPercent);

  return {
    materials: roundMoney(materials),
    labor: roundMoney(labor),
    subTotal: roundMoney(subtotal),
    tax: roundMoney(tax),
    productFees: fees,
    total: roundMoney(subtotal + tax + fees),
  };
}
