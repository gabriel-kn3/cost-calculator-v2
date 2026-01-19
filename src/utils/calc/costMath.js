import { safeDiv, roundMoney } from './normalize.js';
import { toNumber } from '../ui/formatters.js';

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

export function totalCost({ rows, workedHours, laborRate }) {
  const materials = sumLineCosts(rows);
  const labor = laborCost(workedHours, laborRate);
  return {
    materials: roundMoney(materials),
    labor: roundMoney(labor),
    total: roundMoney(materials + labor)
  };
}
