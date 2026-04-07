import { safeDiv, roundMoney } from "./normalize.js";
import { toNumber } from "../ui/formatters.js";

export function unitCost(baseCost, baseQty) {
  return safeDiv(baseCost, baseQty, 0);
}

export function lineCost({ base_cost, base_qty, used_qty }) {
  const u = unitCost(base_cost, base_qty);
  return u * toNumber(used_qty, 0);
}

export function sumLineCosts(rows = []) {
  return rows.reduce((acc, r) => acc + lineCost(r), 0);
}

export function laborCost(workedHours, laborRate) {
  return toNumber(workedHours, 0) * toNumber(laborRate, 0);
}

// export function totalCost({ rows, workedHours, laborRate }) {
//   const materials = sumLineCosts(rows);
//   const labor = laborCost(workedHours, laborRate);
//   return {
//     materials: roundMoney(materials),
//     labor: roundMoney(labor),
//     total: roundMoney(materials + labor)
//   };
// }

/**
 * Tax + Profit utils (generic, industry-agnostic)
 */

// taxPercent: e.g. 7.5 means 7.5%
export function taxAmount(subtotal, taxPercent) {
  const sub = toNumber(subtotal, 0);
  const pct = toNumber(taxPercent, 0);
  return sub * (pct / 100);
}

// Given total cost (materials + labor + tax), compute sale price using profit %
export function salePriceFromProfitPercent(totalCost, profitPercent) {
  const cost = toNumber(totalCost, 0);
  const pct = toNumber(profitPercent, 0);
  return cost * (1 + pct / 100);
}

// Given total cost and a sale price, compute the realized profit %
export function profitPercentFromSalePrice(totalCost, salePrice) {
  const cost = toNumber(totalCost, 0);
  const price = toNumber(salePrice, 0);
  if (cost <= 0) return 0;
  return ((price - cost) / cost) * 100;
}

// Given total cost and sale price, compute profit dollars
export function profitDollars(totalCost, salePrice) {
  const cost = toNumber(totalCost, 0);
  const price = toNumber(salePrice, 0);
  return price - cost;
}

/**
 * Given a product's subtotal cost, calculate the total fees based on an array of fee objects.
 * @param {Array<{serviceName: string, percentage: number}>} feesArray
 * @param {number} subTotal
 * @returns {number} The sum of all calculated fees
 */
export function calculateProductFees(feesArray, subTotal) {
  return feesArray.reduce((acc, fee) => {
    // Calculate individual fee: (subTotal * percentage)
    const calculatedFee = toNumber(subTotal * (fee.percentage / 100), 0);
    return acc + calculatedFee;
  }, 0);
}

/**
 * Total cost breakdown
 * - materials + labor -> subtotal
 * - tax can be computed either on subtotal OR on (subtotal + profit) depending on business rules
 *   default: tax on subtotal (common for many use-cases)
 *
 * Options:
 *   taxPercent: number (e.g. 7.5)
 *   taxBasis: "subtotal" | "sale_price"
 *   salePrice: number (required if taxBasis === "sale_price")
 */
export function totalCost(
  { rows, workedHours, laborRate, additionalFees },
  { taxPercent = 0, taxBasis = "subtotal", salePrice = 0 } = {}
) {
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
