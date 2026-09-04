/**
 * One-time restore of the recovered business data into SQLite.
 *
 *   npx tsx server/scripts/seed-from-csv.ts [--force] [--db ./data/app.db]
 *
 * Source: data/seed/*.csv -- Supabase dashboard exports. The Supabase project
 * they came from (odzgvdvuvhpdxqaokozp) has been DELETED, so these files are
 * the only surviving copy of the operator's catalogue. Treat them as read-only.
 *
 * Two rules drive the design:
 *   1. Never recompute a product's stored `cost`. Costs were written over time
 *      under different fee configurations (16 products with both platform fees,
 *      1 older one with none). Recomputing would silently reprice history.
 *      Instead we detect which configuration reproduces each stored cost and
 *      persist that as the product's snapshot.
 *   2. Preserve legacy ids verbatim as TEXT so BOM material_id references
 *      resolve with no remapping.
 */
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "../../tests/characterization/lib/csv.mjs";
import { openDb, DEFAULT_DB_PATH, schema } from "../db.js";
import { normalizeName, isCommonName } from "../../shared/normalize.js";
import { totalCost, type Fee, type CostRow, type TaxBasis } from "../../shared/costMath.js";
import { toNumber } from "../../shared/money.js";

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const dbPath = (() => {
  const i = argv.indexOf("--db");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : DEFAULT_DB_PATH;
})();

const root = path.resolve(import.meta.dirname, "../..");
const seedDir = path.join(root, "data/seed");
const nowIso = () => new Date().toISOString();

/**
 * The recovered exports carry three timestamp shapes:
 *   2026-01-09T01:49:57.828957+00:00   ISO with offset
 *   2026-01-24 23:48:58.219613+00      space separator, short offset
 *   2026-01-19T04:35:18.058702         no zone at all -> treat as UTC
 * and v2 could also write a bare locale date via toLocaleDateString().
 * Parsed explicitly rather than handed to new Date(), which is locale-dependent
 * and would silently misread a D/M/YYYY export as M/D/YYYY.
 */
function toIso(raw: string | undefined, fallback: string): { iso: string; ok: boolean } {
  const s = (raw ?? "").trim();
  if (!s) return { iso: fallback, ok: false };

  const locale = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (locale) {
    const [, m, d, y] = locale;
    return { iso: new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).toISOString(), ok: true };
  }

  let t = s.replace(" ", "T");
  if (/[+-]\d{2}$/.test(t)) t += ":00";
  if (!/[zZ]$|[+-]\d{2}:\d{2}$/.test(t)) t += "Z";
  const dt = new Date(t);
  if (Number.isNaN(dt.getTime())) return { iso: fallback, ok: false };
  return { iso: dt.toISOString(), ok: true };
}

// v2's hardcoded constants (CalculationProvider.jsx initialState).
const DEFAULT_FEES: Fee[] = [
  { serviceName: "Shopify", percentage: 2.9 },
  { serviceName: "Credit Card", percentage: 2.9 },
];
const DEFAULT_TAX = 7.5;

/** Configurations tried, newest-first, when reproducing a stored cost. */
const FEE_CONFIGS: Array<{ label: string; fees: Fee[]; taxPercent: number }> = [
  { label: "tax7.5+bothFees", fees: DEFAULT_FEES, taxPercent: DEFAULT_TAX },
  { label: "tax7.5+shopifyOnly", fees: [DEFAULT_FEES[0]!], taxPercent: DEFAULT_TAX },
  { label: "tax7.5+noFees", fees: [], taxPercent: DEFAULT_TAX },
  { label: "noTax+bothFees", fees: DEFAULT_FEES, taxPercent: 0 },
  { label: "noTax+noFees", fees: [], taxPercent: 0 },
];

function main() {
  const { db, sqlite, close } = openDb(dbPath);

  const existing =
    db.select().from(schema.materials).all().length +
    db.select().from(schema.products).all().length;
  if (existing > 0 && !FORCE) {
    console.error(`Refusing to seed: ${dbPath} already holds ${existing} rows. Re-run with --force.`);
    close();
    process.exit(1);
  }

  const materialRows = parseCsv(fs.readFileSync(path.join(seedDir, "materials_rows.csv"), "utf8"));
  const productRows = parseCsv(fs.readFileSync(path.join(seedDir, "products_rows.csv"), "utf8"));

  const report = {
    materials: 0,
    products: 0,
    bomLines: 0,
    badDates: 0,
    unresolvedMaterialRefs: 0,
    zeroSalePrice: 0,
    provenance: {} as Record<string, number>,
  };

  const seed = sqlite.transaction(() => {
    if (FORCE) {
      db.delete(schema.productMaterials).run();
      db.delete(schema.products).run();
      db.delete(schema.materials).run();
      db.delete(schema.fees).run();
      db.delete(schema.settings).run();
    }

    // ---- materials -------------------------------------------------------
    for (const m of materialRows) {
      const created = toIso(m.created_at, nowIso());
      const updated = toIso(m.last_updated, created.iso);
      if (!created.ok || !updated.ok) report.badDates++;

      db.insert(schema.materials)
        .values({
          id: String(m.id),
          name: m.name ?? "",
          baseCost: toNumber(m.base_cost, 0),
          baseQty: toNumber(m.base_qty, 1),
          unit: null,
          supplier: m.supplier || null,
          description: m.description || null,
          active: m.active !== "false",
          isCommon: isCommonName(m.name),
          createdAt: created.iso,
          updatedAt: updated.iso,
        })
        .run();
      report.materials++;
    }

    const knownMaterialIds = new Set(materialRows.map((m) => String(m.id)));

    // ---- fees + settings -------------------------------------------------
    DEFAULT_FEES.forEach((f, i) => {
      db.insert(schema.fees)
        .values({
          id: crypto.randomUUID(),
          label: f.serviceName ?? `Fee ${i + 1}`,
          percentage: toNumber(f.percentage, 0),
          basis: "subtotal",
          position: i,
          enabled: true,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })
        .run();
    });

    db.insert(schema.settings)
      .values({
        id: "default",
        laborRate: 12,
        taxPercent: DEFAULT_TAX,
        taxBasis: "subtotal",
        profitPercent: 20,
        updatedAt: nowIso(),
      })
      .run();

    // ---- products + BOM --------------------------------------------------
    for (const p of productRows) {
      const bom = JSON.parse(p.materials || "[]") as Array<Record<string, unknown>>;
      const rows: CostRow[] = bom.map((b) => ({
        base_cost: b.base_cost as number,
        base_qty: b.base_qty as number,
        used_qty: b.used_qty as number,
      }));

      const storedCost = toNumber(p.cost, 0);
      const match = FEE_CONFIGS.find((cfg) => {
        const t = totalCost(
          { rows, workedHours: p.worked_hours, laborRate: p.labor_rate, additionalFees: cfg.fees },
          { taxPercent: cfg.taxPercent, taxBasis: "subtotal" },
        );
        return Math.abs(t.total - storedCost) < 0.005;
      });
      const cfg = match ?? FEE_CONFIGS[0]!;
      const label = match ? match.label : "UNEXPLAINED";
      report.provenance[label] = (report.provenance[label] ?? 0) + 1;

      // Full breakdown under the config that reproduces the stored cost.
      // v2 discarded everything but `total` on read; we keep all of it.
      const totals = totalCost(
        { rows, workedHours: p.worked_hours, laborRate: p.labor_rate, additionalFees: cfg.fees },
        { taxPercent: cfg.taxPercent, taxBasis: "subtotal" },
      );

      const created = toIso(p.created_at, nowIso());
      const updated = toIso(p.last_updated, created.iso);
      if (!created.ok || !updated.ok) report.badDates++;
      if (toNumber(p.sale_price, 0) === 0) report.zeroSalePrice++;

      db.insert(schema.products)
        .values({
          id: String(p.id),
          name: p.name ?? "Untitled Product",
          nameNorm: normalizeName(p.name),
          notes: p.notes || "",
          workedHours: toNumber(p.worked_hours, 0),
          laborRate: toNumber(p.labor_rate, 0),
          taxPercent: cfg.taxPercent,
          taxBasis: "subtotal" as TaxBasis,
          profitPercent: 20,
          feesJson: JSON.stringify(cfg.fees),
          salePrice: toNumber(p.sale_price, 0),
          cost: storedCost, // preserved, never recomputed
          totalsJson: JSON.stringify(totals),
          photosJson: p.photos || "[]",
          active: p.active !== "false",
          qty: 0,
          createdAt: created.iso,
          updatedAt: updated.iso,
        })
        .run();
      report.products++;

      bom.forEach((b, i) => {
        const rawId = b.material_id == null ? null : String(b.material_id);
        const resolved = rawId && knownMaterialIds.has(rawId) ? rawId : null;
        if (rawId && !resolved) report.unresolvedMaterialRefs++;

        db.insert(schema.productMaterials)
          .values({
            id: crypto.randomUUID(),
            productId: String(p.id),
            materialId: resolved,
            position: i,
            name: String(b.name ?? ""),
            supplier: (b.supplier as string) || null,
            baseCost: toNumber(b.base_cost, 0),
            baseQty: toNumber(b.base_qty, 1),
            usedQty: toNumber(b.used_qty, 0),
          })
          .run();
        report.bomLines++;
      });
    }
  });

  seed();
  close();

  console.log(`seeded ${dbPath}`);
  console.log(`  materials                ${report.materials}`);
  console.log(`  products                 ${report.products}`);
  console.log(`  BOM lines                ${report.bomLines}`);
  console.log(`  unparseable dates        ${report.badDates}`);
  console.log(`  unresolved BOM refs      ${report.unresolvedMaterialRefs}`);
  console.log(`  products @ sale_price 0  ${report.zeroSalePrice}  (v2 never persisted sale_price)`);
  console.log(`  cost provenance          ${JSON.stringify(report.provenance)}`);
}

main();
