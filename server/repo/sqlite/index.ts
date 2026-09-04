/**
 * SQLite implementation of the DataStore contract.
 *
 * better-sqlite3 is synchronous, so every method here is really immediate;
 * the async signatures exist so the Supabase adapter can satisfy the same
 * interface. Transactions are therefore trivially atomic -- which is what
 * makes replaceAll() a real bulk operation rather than v2's N+1 loop.
 */
import { eq, asc, desc } from "drizzle-orm";
import type Database from "better-sqlite3";
import type { Db } from "../../db.js";
import { schema } from "../../db.js";
import { normalizeName, isCommonName } from "../../../shared/normalize.js";
import { totalCost, type Fee } from "../../../shared/costMath.js";
import { toNumber } from "../../../shared/money.js";
import type {
  Material, MaterialInput, Product, ProductInput, ProductMaterial,
  Settings, FeeRecord, Totals, TaxBasis,
} from "../../../shared/types.js";
import type {
  DataStore, MaterialsRepo, ProductsRepo, SettingsRepo, BackupRepo,
  BulkResult, BackupBundle,
} from "../types.js";

const nowIso = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

type MaterialRow = typeof schema.materials.$inferSelect;
type ProductRow = typeof schema.products.$inferSelect;
type PmRow = typeof schema.productMaterials.$inferSelect;
type SettingsRow = typeof schema.settings.$inferSelect;
type FeeRow = typeof schema.fees.$inferSelect;

// ------------------------------------------------------------- row -> domain

const toMaterial = (r: MaterialRow): Material => ({
  id: r.id,
  name: r.name,
  baseCost: r.baseCost,
  baseQty: r.baseQty,
  unit: r.unit,
  supplier: r.supplier,
  description: r.description,
  active: r.active,
  isCommon: r.isCommon,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const toProductMaterial = (r: PmRow): ProductMaterial => ({
  id: r.id,
  productId: r.productId,
  materialId: r.materialId,
  position: r.position,
  name: r.name,
  supplier: r.supplier,
  baseCost: r.baseCost,
  baseQty: r.baseQty,
  usedQty: r.usedQty,
});

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const toProduct = (r: ProductRow, rows: PmRow[]): Product => ({
  id: r.id,
  name: r.name,
  nameNorm: r.nameNorm,
  notes: r.notes,
  workedHours: r.workedHours,
  laborRate: r.laborRate,
  taxPercent: r.taxPercent,
  taxBasis: r.taxBasis,
  profitPercent: r.profitPercent,
  fees: safeJson<Fee[]>(r.feesJson, []),
  salePrice: r.salePrice,
  cost: r.cost,
  totals: safeJson<Totals>(r.totalsJson, {
    materials: 0, labor: 0, subTotal: 0, tax: 0, productFees: 0, total: r.cost,
  }),
  photos: safeJson<unknown[]>(r.photosJson, []),
  active: r.active,
  qty: r.qty,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  rows: rows.sort((a, b) => a.position - b.position).map(toProductMaterial),
});

const toSettings = (r: SettingsRow): Settings => ({ ...r });
const toFeeRecord = (r: FeeRow): FeeRecord => ({ ...r });

// ------------------------------------------------------------------ factory

export function createSqliteStore(db: Db, sqlite: Database.Database): DataStore {
  /** Current global pricing defaults, used when an input omits them. */
  function currentDefaults() {
    const s = db.select().from(schema.settings).where(eq(schema.settings.id, "default")).get();
    const feeRows = db.select().from(schema.fees).orderBy(asc(schema.fees.position)).all();
    const fees: Fee[] = feeRows
      .filter((f) => f.enabled)
      .map((f) => ({ serviceName: f.label, percentage: f.percentage }));
    return {
      laborRate: s?.laborRate ?? 12,
      taxPercent: s?.taxPercent ?? 7.5,
      taxBasis: (s?.taxBasis ?? "subtotal") as TaxBasis,
      profitPercent: s?.profitPercent ?? 20,
      fees,
    };
  }

  /** Applies the frozen math. The server is authoritative for cost. */
  function price(input: ProductInput) {
    const d = currentDefaults();
    const fees = input.fees ?? d.fees;
    const taxPercent = input.taxPercent ?? d.taxPercent;
    const taxBasis = input.taxBasis ?? d.taxBasis;
    const rows = input.rows.map((r) => ({
      base_cost: r.baseCost ?? 0,
      base_qty: r.baseQty ?? 1,
      used_qty: r.usedQty ?? 0,
    }));
    const totals = totalCost(
      {
        rows,
        workedHours: input.workedHours ?? 0,
        laborRate: input.laborRate ?? d.laborRate,
        additionalFees: fees,
      },
      { taxPercent, taxBasis, salePrice: input.salePrice ?? 0 },
    );
    return {
      fees, taxPercent, taxBasis,
      profitPercent: input.profitPercent ?? d.profitPercent,
      laborRate: input.laborRate ?? d.laborRate,
      totals,
      // An explicit cost wins so imports can preserve historical values that
      // today's settings would not reproduce.
      cost: input.cost ?? totals.total,
    };
  }

  function loadProduct(id: string): Product | null {
    const r = db.select().from(schema.products).where(eq(schema.products.id, id)).get();
    if (!r) return null;
    const rows = db
      .select()
      .from(schema.productMaterials)
      .where(eq(schema.productMaterials.productId, id))
      .all();
    return toProduct(r, rows);
  }

  function writeRows(productId: string, rows: ProductInput["rows"]) {
    db.delete(schema.productMaterials)
      .where(eq(schema.productMaterials.productId, productId))
      .run();
    rows.forEach((r, i) => {
      db.insert(schema.productMaterials)
        .values({
          id: newId(),
          productId,
          materialId: r.materialId ?? null,
          position: i,
          name: r.name ?? "",
          supplier: r.supplier ?? null,
          baseCost: toNumber(r.baseCost, 0),
          baseQty: toNumber(r.baseQty, 1),
          usedQty: toNumber(r.usedQty, 0),
        })
        .run();
    });
  }

  // ----------------------------------------------------------------- materials

  const materials: MaterialsRepo = {
    async list() {
      return db.select().from(schema.materials).orderBy(asc(schema.materials.name)).all().map(toMaterial);
    },

    async get(id) {
      const r = db.select().from(schema.materials).where(eq(schema.materials.id, id)).get();
      return r ? toMaterial(r) : null;
    },

    async create(input) {
      const ts = nowIso();
      const row = {
        id: newId(),
        name: input.name,
        baseCost: toNumber(input.baseCost, 0),
        baseQty: toNumber(input.baseQty, 1),
        unit: input.unit ?? null,
        supplier: input.supplier ?? null,
        description: input.description ?? null,
        active: input.active ?? true,
        isCommon: isCommonName(input.name),
        createdAt: ts,
        updatedAt: ts,
      };
      db.insert(schema.materials).values(row).run();
      return toMaterial(row);
    },

    async update(id, patch) {
      const existing = db.select().from(schema.materials).where(eq(schema.materials.id, id)).get();
      if (!existing) return null;
      const name = patch.name ?? existing.name;
      const next = {
        name,
        baseCost: patch.baseCost === undefined ? existing.baseCost : toNumber(patch.baseCost, 0),
        baseQty: patch.baseQty === undefined ? existing.baseQty : toNumber(patch.baseQty, 1),
        unit: patch.unit === undefined ? existing.unit : patch.unit,
        supplier: patch.supplier === undefined ? existing.supplier : patch.supplier,
        description: patch.description === undefined ? existing.description : patch.description,
        active: patch.active ?? existing.active,
        // Always re-derived: renaming a material can change its "common" status.
        isCommon: isCommonName(name),
        updatedAt: nowIso(),
      };
      db.update(schema.materials).set(next).where(eq(schema.materials.id, id)).run();
      return toMaterial({ ...existing, ...next });
    },

    async delete(id) {
      const res = db.delete(schema.materials).where(eq(schema.materials.id, id)).run();
      return res.changes > 0;
    },

    async listCommon() {
      return db
        .select()
        .from(schema.materials)
        .where(eq(schema.materials.isCommon, true))
        .orderBy(asc(schema.materials.name))
        .all()
        .map(toMaterial);
    },

    async replaceAll(items) {
      let created = 0;
      const deleted = db.select().from(schema.materials).all().length;
      sqlite.transaction(() => {
        db.delete(schema.materials).run();
        const ts = nowIso();
        for (const input of items) {
          db.insert(schema.materials)
            .values({
              id: newId(),
              name: input.name,
              baseCost: toNumber(input.baseCost, 0),
              baseQty: toNumber(input.baseQty, 1),
              unit: input.unit ?? null,
              supplier: input.supplier ?? null,
              description: input.description ?? null,
              active: input.active ?? true,
              isCommon: isCommonName(input.name),
              createdAt: ts,
              updatedAt: ts,
            })
            .run();
          created++;
        }
      })();
      return { created, updated: 0, deleted };
    },
  };

  // ------------------------------------------------------------------ products

  const products: ProductsRepo = {
    async list() {
      const rows = db.select().from(schema.products).orderBy(desc(schema.products.updatedAt)).all();
      const all = db.select().from(schema.productMaterials).all();
      const byProduct = new Map<string, PmRow[]>();
      for (const r of all) {
        const list = byProduct.get(r.productId);
        if (list) list.push(r);
        else byProduct.set(r.productId, [r]);
      }
      return rows.map((r) => toProduct(r, byProduct.get(r.id) ?? []));
    },

    async get(id) {
      return loadProduct(id);
    },

    async create(input) {
      const ts = nowIso();
      const p = price(input);
      const id = newId();
      sqlite.transaction(() => {
        db.insert(schema.products)
          .values({
            id,
            name: input.name,
            nameNorm: normalizeName(input.name),
            notes: input.notes ?? "",
            workedHours: toNumber(input.workedHours, 0),
            laborRate: p.laborRate,
            taxPercent: p.taxPercent,
            taxBasis: p.taxBasis,
            profitPercent: p.profitPercent,
            feesJson: JSON.stringify(p.fees),
            salePrice: toNumber(input.salePrice, 0),
            cost: p.cost,
            totalsJson: JSON.stringify(p.totals),
            photosJson: JSON.stringify(input.photos ?? []),
            active: input.active ?? true,
            qty: toNumber(input.qty, 0),
            createdAt: ts,
            updatedAt: ts,
          })
          .run();
        writeRows(id, input.rows);
      })();
      return loadProduct(id)!;
    },

    async update(id, patch) {
      const existing = loadProduct(id);
      if (!existing) return null;

      const merged: ProductInput = {
        name: patch.name ?? existing.name,
        notes: patch.notes ?? existing.notes,
        workedHours: patch.workedHours ?? existing.workedHours,
        laborRate: patch.laborRate ?? existing.laborRate,
        taxPercent: patch.taxPercent ?? existing.taxPercent,
        taxBasis: patch.taxBasis ?? existing.taxBasis,
        profitPercent: patch.profitPercent ?? existing.profitPercent,
        fees: patch.fees ?? existing.fees,
        salePrice: patch.salePrice ?? existing.salePrice,
        cost: patch.cost,
        photos: patch.photos ?? existing.photos,
        active: patch.active ?? existing.active,
        qty: patch.qty ?? existing.qty,
        rows:
          patch.rows ??
          existing.rows.map((r) => ({
            materialId: r.materialId,
            name: r.name,
            supplier: r.supplier,
            baseCost: r.baseCost,
            baseQty: r.baseQty,
            usedQty: r.usedQty,
          })),
      };
      const p = price(merged);

      sqlite.transaction(() => {
        db.update(schema.products)
          .set({
            name: merged.name,
            nameNorm: normalizeName(merged.name),
            notes: merged.notes ?? "",
            workedHours: toNumber(merged.workedHours, 0),
            laborRate: p.laborRate,
            taxPercent: p.taxPercent,
            taxBasis: p.taxBasis,
            profitPercent: p.profitPercent,
            feesJson: JSON.stringify(p.fees),
            salePrice: toNumber(merged.salePrice, 0),
            cost: p.cost,
            totalsJson: JSON.stringify(p.totals),
            photosJson: JSON.stringify(merged.photos ?? []),
            active: merged.active ?? true,
            qty: toNumber(merged.qty, 0),
            updatedAt: nowIso(),
          })
          .where(eq(schema.products.id, id))
          .run();
        writeRows(id, merged.rows);
      })();
      return loadProduct(id);
    },

    async delete(id) {
      const res = db.delete(schema.products).where(eq(schema.products.id, id)).run();
      return res.changes > 0;
    },

    async upsertByName(input) {
      const norm = normalizeName(input.name);
      const match = db
        .select()
        .from(schema.products)
        .where(eq(schema.products.nameNorm, norm))
        .get();
      if (match) return (await products.update(match.id, input))!;
      return products.create(input);
    },

    async replaceAll(items) {
      let created = 0;
      const deleted = db.select().from(schema.products).all().length;
      sqlite.transaction(() => {
        db.delete(schema.products).run(); // BOM rows cascade
        for (const input of items) {
          const ts = nowIso();
          const p = price(input);
          const id = newId();
          db.insert(schema.products)
            .values({
              id,
              name: input.name,
              nameNorm: normalizeName(input.name),
              notes: input.notes ?? "",
              workedHours: toNumber(input.workedHours, 0),
              laborRate: p.laborRate,
              taxPercent: p.taxPercent,
              taxBasis: p.taxBasis,
              profitPercent: p.profitPercent,
              feesJson: JSON.stringify(p.fees),
              salePrice: toNumber(input.salePrice, 0),
              cost: p.cost,
              totalsJson: JSON.stringify(p.totals),
              photosJson: JSON.stringify(input.photos ?? []),
              active: input.active ?? true,
              qty: toNumber(input.qty, 0),
              createdAt: ts,
              updatedAt: ts,
            })
            .run();
          writeRows(id, input.rows);
          created++;
        }
      })();
      return { created, updated: 0, deleted };
    },
  };

  // ------------------------------------------------------------------ settings

  const settings: SettingsRepo = {
    async get() {
      const r = db.select().from(schema.settings).where(eq(schema.settings.id, "default")).get();
      if (r) return toSettings(r);
      const seeded = { id: "default", updatedAt: nowIso() };
      db.insert(schema.settings).values(seeded).run();
      return toSettings(
        db.select().from(schema.settings).where(eq(schema.settings.id, "default")).get()!,
      );
    },

    async update(patch) {
      await settings.get(); // guarantee the singleton exists
      const { id: _ignored, ...rest } = patch;
      db.update(schema.settings)
        .set({ ...rest, updatedAt: nowIso() })
        .where(eq(schema.settings.id, "default"))
        .run();
      return settings.get();
    },

    async listFees() {
      return db.select().from(schema.fees).orderBy(asc(schema.fees.position)).all().map(toFeeRecord);
    },

    async saveFee(fee) {
      const ts = nowIso();
      if (fee.id) {
        const existing = db.select().from(schema.fees).where(eq(schema.fees.id, fee.id)).get();
        if (existing) {
          const next = {
            label: fee.label ?? existing.label,
            percentage: fee.percentage === undefined ? existing.percentage : toNumber(fee.percentage, 0),
            basis: fee.basis ?? existing.basis,
            position: fee.position ?? existing.position,
            enabled: fee.enabled ?? existing.enabled,
            updatedAt: ts,
          };
          db.update(schema.fees).set(next).where(eq(schema.fees.id, fee.id)).run();
          return toFeeRecord({ ...existing, ...next });
        }
      }
      const count = db.select().from(schema.fees).all().length;
      const row = {
        id: fee.id ?? newId(),
        label: fee.label,
        percentage: toNumber(fee.percentage, 0),
        basis: fee.basis ?? ("subtotal" as TaxBasis),
        position: fee.position ?? count,
        enabled: fee.enabled ?? true,
        createdAt: ts,
        updatedAt: ts,
      };
      db.insert(schema.fees).values(row).run();
      return toFeeRecord(row);
    },

    async deleteFee(id) {
      const res = db.delete(schema.fees).where(eq(schema.fees.id, id)).run();
      return res.changes > 0;
    },
  };

  // -------------------------------------------------------------------- backup

  const backup: BackupRepo = {
    async dump() {
      return {
        kind: "backup",
        version: 1,
        exported_at: nowIso(),
        materials: db.select().from(schema.materials).all(),
        products: db.select().from(schema.products).all(),
        product_materials: db.select().from(schema.productMaterials).all(),
        settings: db.select().from(schema.settings).all()[0] ?? null,
        fees: db.select().from(schema.fees).all(),
      };
    },

    async restore(bundle) {
      if (bundle?.kind !== "backup") throw new Error("Not a backup bundle");
      let m = 0;
      let p = 0;
      sqlite.transaction(() => {
        db.delete(schema.productMaterials).run();
        db.delete(schema.products).run();
        db.delete(schema.materials).run();
        for (const row of bundle.materials as MaterialRow[]) {
          db.insert(schema.materials).values(row).run();
          m++;
        }
        for (const row of bundle.products as ProductRow[]) {
          db.insert(schema.products).values(row).run();
          p++;
        }
        // BOM rows come from the bundle, not from the database we just
        // cleared -- restoring the old ones would attach the previous line
        // items to the incoming products.
        for (const row of (bundle.product_materials ?? []) as PmRow[]) {
          db.insert(schema.productMaterials).values(row).run();
        }
      })();
      return { materials: m, products: p };
    },
  };

  return {
    mode: "sqlite",
    materials,
    products,
    settings,
    backup,
    async health() {
      const t0 = performance.now();
      sqlite.prepare("select 1").get();
      return { ok: true, latencyMs: Math.round((performance.now() - t0) * 100) / 100 };
    },
    async close() {
      sqlite.close();
    },
  };
}
