/**
 * Domain types, plus the WIRE shapes the v2 client already speaks.
 *
 * The wire format is deliberately snake_case and byte-compatible with what
 * ProductsProvider.jsx / materials.api.js send and expect. That is what lets
 * the existing Grommet UI drive this server unchanged -- the Phase 2
 * de-risking step -- and it keeps the exported JSON envelopes valid against
 * the backup files already sitting on disk.
 *
 * Repositories return DOMAIN objects. Routes convert to WIRE at the edge.
 */

import type { TaxBasis, Fee } from "./costMath.js";

export type { TaxBasis, Fee };

// ---------------------------------------------------------------- domain

export interface Material {
  id: string;
  name: string;
  baseCost: number;
  baseQty: number;
  unit: string | null;
  supplier: string | null;
  description: string | null;
  active: boolean;
  /** Derived from name.includes("*") on every write. */
  isCommon: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductMaterial {
  id: string;
  productId: string;
  /** Null when the source material was deleted -- history survives. */
  materialId: string | null;
  position: number;
  name: string;
  supplier: string | null;
  baseCost: number;
  baseQty: number;
  usedQty: number;
}

export interface Totals {
  materials: number;
  labor: number;
  subTotal: number;
  tax: number;
  productFees: number;
  total: number;
}

export interface Product {
  id: string;
  name: string;
  nameNorm: string;
  notes: string;
  workedHours: number;
  laborRate: number;
  /** Pricing snapshot -- see schema.sqlite.ts for why this is per-product. */
  taxPercent: number;
  taxBasis: TaxBasis;
  profitPercent: number;
  fees: Fee[];
  salePrice: number;
  cost: number;
  totals: Totals;
  photos: unknown[];
  active: boolean;
  qty: number;
  createdAt: string;
  updatedAt: string;
  rows: ProductMaterial[];
}

export interface Settings {
  id: string;
  laborRate: number;
  taxPercent: number;
  taxBasis: TaxBasis;
  profitPercent: number;
  currency: string;
  currencySymbol: string;
  locale: string;
  timezone: string;
  theme: "light" | "dark" | "system";
  baseFontPx: number;
  sessionMinutes: number;
  richNotesEnabled: boolean;
  updatedAt: string;
}

export interface FeeRecord {
  id: string;
  label: string;
  percentage: number;
  basis: TaxBasis;
  position: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------------ wire

export interface WireMaterial {
  id: string;
  name: string;
  base_cost: number;
  base_qty: number;
  supplier: string | null;
  description: string | null;
  active: boolean;
  created_at: string;
  last_updated: string;
}

export interface WireProductMaterial {
  material_id: string | null;
  name: string;
  base_cost: number;
  base_qty: number;
  used_qty: number;
  supplier?: string | null;
}

export interface WireProduct {
  id: string;
  name: string;
  materials: WireProductMaterial[];
  cost: number;
  sale_price: number;
  photos: unknown[];
  notes: string;
  active: boolean;
  worked_hours: number;
  labor_rate: number;
  created_at: string;
  last_updated: string;
  /** Additions v2 ignores harmlessly, but the new client uses. */
  tax_percent: number;
  tax_basis: TaxBasis;
  profit_percent: number;
  fees: Fee[];
  totals: Totals;
}

// --------------------------------------------------------------- mappers

export function materialToWire(m: Material): WireMaterial {
  return {
    id: m.id,
    name: m.name,
    base_cost: m.baseCost,
    base_qty: m.baseQty,
    supplier: m.supplier,
    description: m.description,
    active: m.active,
    created_at: m.createdAt,
    last_updated: m.updatedAt,
  };
}

export function productToWire(p: Product): WireProduct {
  return {
    id: p.id,
    name: p.name,
    materials: p.rows.map((r) => ({
      material_id: r.materialId,
      name: r.name,
      base_cost: r.baseCost,
      base_qty: r.baseQty,
      used_qty: r.usedQty,
      supplier: r.supplier,
    })),
    cost: p.cost,
    sale_price: p.salePrice,
    photos: p.photos,
    notes: p.notes,
    active: p.active,
    worked_hours: p.workedHours,
    labor_rate: p.laborRate,
    created_at: p.createdAt,
    last_updated: p.updatedAt,
    tax_percent: p.taxPercent,
    tax_basis: p.taxBasis,
    profit_percent: p.profitPercent,
    fees: p.fees,
    totals: p.totals,
  };
}

// ------------------------------------------------------------ write DTOs

export interface MaterialInput {
  name: string;
  baseCost?: number;
  baseQty?: number;
  unit?: string | null;
  supplier?: string | null;
  description?: string | null;
  active?: boolean;
}

export interface ProductRowInput {
  materialId?: string | null;
  name: string;
  supplier?: string | null;
  baseCost?: number;
  baseQty?: number;
  usedQty?: number;
}

export interface ProductInput {
  name: string;
  notes?: string;
  workedHours?: number;
  laborRate?: number;
  taxPercent?: number;
  taxBasis?: TaxBasis;
  profitPercent?: number;
  fees?: Fee[];
  salePrice?: number;
  /** When omitted the server computes it from rows via the frozen math. */
  cost?: number;
  photos?: unknown[];
  active?: boolean;
  qty?: number;
  rows: ProductRowInput[];
}
