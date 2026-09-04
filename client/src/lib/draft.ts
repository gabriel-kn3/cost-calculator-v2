/**
 * The calculator draft.
 *
 * A tiny external store rather than a context, because two screens need it
 * (Products loads into it; Calculator edits it) and it is genuinely global.
 *
 * Editable numeric fields are held as STRINGS, exactly as v2 did: they come
 * from text inputs and are coerced by the frozen toNumber() at calculation
 * time, which is what makes "1,000" work. Coercing on every keystroke would
 * fight the user mid-typing.
 *
 * Unlike v2, the draft survives a refresh (localStorage autosave).
 */
import { useSyncExternalStore } from "react";
import type { Fee } from "@shared/costMath";
import type { WireProduct } from "@shared/types";

export interface DraftRow {
  rowId: string;
  materialId: string | null;
  name: string;
  base_cost: string;
  base_qty: string;
  used_qty: string;
}

export interface DraftState {
  /** Binds the draft to a saved product so re-saving updates rather than duplicating. */
  activeProductId: string | null;
  name: string;
  notes: string;
  workedHours: string;
  laborRate: string;
  taxPercent: string;
  salePrice: string;
  profitPercent: string;
  fees: Fee[];
  rowsById: Record<string, DraftRow>;
  rowOrder: string[];
}

const STORAGE_KEY = "costcalc.draft.v1";

/** Matches v2's initialState. Overridden by server settings once they load. */
export const INITIAL: DraftState = {
  activeProductId: null,
  name: "Untitled Product",
  notes: "",
  workedHours: "0",
  laborRate: "12",
  taxPercent: "7.5",
  salePrice: "0",
  profitPercent: "20",
  fees: [
    { serviceName: "Shopify", percentage: 2.9 },
    { serviceName: "Credit Card", percentage: 2.9 },
  ],
  rowsById: {},
  rowOrder: [],
};

function uid(prefix = "row") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function load(): DraftState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...INITIAL };
    const parsed = JSON.parse(raw) as Partial<DraftState>;
    return { ...INITIAL, ...parsed };
  } catch {
    return { ...INITIAL };
  }
}

let state: DraftState = load();
const listeners = new Set<() => void>();

function emit() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode: the draft just will not survive a refresh */
  }
  listeners.forEach((l) => l());
}

function set(patch: Partial<DraftState>) {
  state = { ...state, ...patch };
  emit();
}

export const draft = {
  get: () => state,

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setField<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    set({ [key]: value } as Pick<DraftState, K>);
  },

  /** Rows in display order. */
  rows(): DraftRow[] {
    return state.rowOrder.map((id) => state.rowsById[id]).filter(Boolean) as DraftRow[];
  },

  addRow(partial: Partial<DraftRow> = {}) {
    const rowId = uid();
    const row: DraftRow = {
      rowId,
      materialId: null,
      name: "Material",
      base_cost: "0",
      base_qty: "1",
      // v2 defaults used_qty to 1, not 0 -- "default to 1 per user request".
      used_qty: "1",
      ...partial,
    };
    set({ rowsById: { ...state.rowsById, [rowId]: row }, rowOrder: [...state.rowOrder, rowId] });
    return rowId;
  },

  patchRow(rowId: string, patch: Partial<DraftRow>) {
    const existing = state.rowsById[rowId];
    if (!existing) return;
    set({ rowsById: { ...state.rowsById, [rowId]: { ...existing, ...patch } } });
  },

  removeRow(rowId: string) {
    const next = { ...state.rowsById };
    delete next[rowId];
    set({ rowsById: next, rowOrder: state.rowOrder.filter((id) => id !== rowId) });
  },

  /**
   * Adds every common ("*") material, SKIPPING any already present by
   * materialId -- matching v2, so pressing it twice does not duplicate.
   */
  addCommon(materials: Array<{ id: string; name: string; base_cost: number; base_qty: number }>) {
    const present = new Set(draft.rows().map((r) => r.materialId).filter(Boolean));
    const toAdd = materials.filter((m) => !present.has(String(m.id)));
    if (!toAdd.length) return 0;

    const rowsById = { ...state.rowsById };
    const rowOrder = [...state.rowOrder];
    for (const m of toAdd) {
      const rowId = uid();
      rowsById[rowId] = {
        rowId,
        materialId: String(m.id),
        name: m.name,
        base_cost: String(m.base_cost),
        base_qty: String(m.base_qty),
        used_qty: "1",
      };
      rowOrder.push(rowId);
    }
    set({ rowsById, rowOrder });
    return toAdd.length;
  },

  /**
   * True when there is anything worth protecting. Same rule as v2:
   * any rows, or a name that is no longer the placeholder.
   */
  isDirty(): boolean {
    return state.rowOrder.length > 0 || (!!state.name && state.name !== INITIAL.name);
  },

  /**
   * Loads a saved product. Unlike v2 -- which reset tax, fees, profit and
   * sale price to defaults -- this restores the product's own snapshot, so
   * reopening shows what it was actually priced with. Signed off as a
   * deliberate behaviour change.
   */
  loadFromProduct(p: WireProduct) {
    const rowsById: Record<string, DraftRow> = {};
    const rowOrder: string[] = [];
    for (const m of p.materials ?? []) {
      const rowId = uid();
      rowsById[rowId] = {
        rowId,
        materialId: m.material_id != null ? String(m.material_id) : null,
        name: m.name ?? "Material",
        base_cost: String(m.base_cost ?? 0),
        base_qty: String(m.base_qty ?? 1),
        used_qty: String(m.used_qty ?? 0),
      };
      rowOrder.push(rowId);
    }
    state = {
      activeProductId: String(p.id),
      name: p.name ?? "Untitled Product",
      notes: p.notes ?? "",
      workedHours: String(p.worked_hours ?? 0),
      laborRate: String(p.labor_rate ?? INITIAL.laborRate),
      taxPercent: String(p.tax_percent ?? INITIAL.taxPercent),
      salePrice: String(p.sale_price ?? 0),
      profitPercent: String(p.profit_percent ?? INITIAL.profitPercent),
      fees: p.fees ?? INITIAL.fees,
      rowsById,
      rowOrder,
    };
    emit();
  },

  /** Full reset, including detaching from any saved product. */
  clear() {
    state = { ...INITIAL, rowsById: {}, rowOrder: [] };
    emit();
  },

  /** Replaces the draft wholesale (used by Import Draft). */
  replace(next: Partial<DraftState>) {
    state = { ...INITIAL, ...next };
    emit();
  },

  /** Applies server defaults to a pristine draft only -- never clobbers work. */
  applyDefaults(d: { laborRate: number; taxPercent: number; profitPercent: number; fees: Fee[] }) {
    if (draft.isDirty() || state.activeProductId) return;
    set({
      laborRate: String(d.laborRate),
      taxPercent: String(d.taxPercent),
      profitPercent: String(d.profitPercent),
      fees: d.fees,
    });
  },
};

export function useDraft(): DraftState {
  return useSyncExternalStore(draft.subscribe, draft.get, draft.get);
}
