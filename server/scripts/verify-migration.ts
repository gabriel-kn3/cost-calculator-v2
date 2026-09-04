/**
 * Independent verification of the seed. Deliberately re-derives everything
 * from the source CSVs rather than trusting the seed script's own report --
 * a migration that grades its own homework proves nothing.
 *
 *   npx tsx server/scripts/verify-migration.ts [--db ./data/app.db]
 *
 * Exits non-zero if any check fails.
 */
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "../../tests/characterization/lib/csv.mjs";
import { openDb, DEFAULT_DB_PATH, schema } from "../db.js";
import { normalizeName, isCommonName } from "../../shared/normalize.js";
import { totalCost, type Fee, type CostRow } from "../../shared/costMath.js";
import { toNumber } from "../../shared/money.js";

const argv = process.argv.slice(2);
const dbPath = (() => {
  const i = argv.indexOf("--db");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : DEFAULT_DB_PATH;
})();

const root = path.resolve(import.meta.dirname, "../..");
const seedDir = path.join(root, "data/seed");

let failures = 0;
function check(label: string, actual: unknown, expected: unknown, note = "") {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  const mark = ok ? "PASS" : "FAIL";
  const detail = ok ? String(actual) : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`;
  console.log(`  [${mark}] ${label.padEnd(42)} ${detail}${note ? "  " + note : ""}`);
}

function main() {
  const { db, close } = openDb(dbPath, { migrate: false });

  const csvMaterials = parseCsv(fs.readFileSync(path.join(seedDir, "materials_rows.csv"), "utf8"));
  const csvProducts = parseCsv(fs.readFileSync(path.join(seedDir, "products_rows.csv"), "utf8"));

  const dbMaterials = db.select().from(schema.materials).all();
  const dbProducts = db.select().from(schema.products).all();
  const dbBom = db.select().from(schema.productMaterials).all();
  const dbFees = db.select().from(schema.fees).all();
  const dbSettings = db.select().from(schema.settings).all();

  console.log(`verifying ${dbPath}\n`);

  console.log("row counts");
  check("materials", dbMaterials.length, csvMaterials.length);
  check("products", dbProducts.length, csvProducts.length);
  check(
    "BOM lines",
    dbBom.length,
    csvProducts.reduce((a, p) => a + JSON.parse(p.materials || "[]").length, 0),
  );
  check("settings singleton", dbSettings.length, 1);
  check("fees seeded", dbFees.length, 2);

  console.log("\nvalue checksums (catches string->number coercion errors)");
  const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
  check(
    "sum(base_cost)",
    round4(dbMaterials.reduce((a, m) => a + m.baseCost, 0)),
    round4(csvMaterials.reduce((a, m) => a + toNumber(m.base_cost, 0), 0)),
  );
  check(
    "sum(base_qty)",
    round4(dbMaterials.reduce((a, m) => a + m.baseQty, 0)),
    round4(csvMaterials.reduce((a, m) => a + toNumber(m.base_qty, 1), 0)),
  );
  check(
    "sum(product cost)",
    round4(dbProducts.reduce((a, p) => a + p.cost, 0)),
    round4(csvProducts.reduce((a, p) => a + toNumber(p.cost, 0), 0)),
  );
  check(
    "sum(used_qty) across BOM",
    round4(dbBom.reduce((a, b) => a + b.usedQty, 0)),
    round4(
      csvProducts.reduce(
        (a, p) =>
          a + JSON.parse(p.materials || "[]").reduce((s: number, b: Record<string, unknown>) => s + toNumber(b.used_qty, 0), 0),
        0,
      ),
    ),
  );

  console.log("\nderived columns");
  check(
    "is_common count",
    dbMaterials.filter((m) => m.isCommon).length,
    csvMaterials.filter((m) => isCommonName(m.name)).length,
    "(* in name)",
  );
  check(
    "materials with supplier",
    dbMaterials.filter((m) => m.supplier).length,
    csvMaterials.filter((m) => m.supplier && m.supplier !== "").length,
  );
  check(
    "active materials",
    dbMaterials.filter((m) => m.active).length,
    csvMaterials.filter((m) => m.active !== "false").length,
  );
  check(
    "name_norm all populated",
    dbProducts.every((p) => p.nameNorm === normalizeName(p.name)),
    true,
  );
  check("name_norm unique", new Set(dbProducts.map((p) => p.nameNorm)).size, dbProducts.length);

  console.log("\nreferential integrity");
  const materialIds = new Set(dbMaterials.map((m) => m.id));
  check(
    "every BOM material_id resolves or is NULL",
    dbBom.every((b) => b.materialId === null || materialIds.has(b.materialId)),
    true,
  );
  const productIds = new Set(dbProducts.map((p) => p.id));
  check("every BOM product_id resolves", dbBom.every((b) => productIds.has(b.productId)), true);
  check(
    "BOM positions contiguous per product",
    dbProducts.every((p) => {
      const pos = dbBom.filter((b) => b.productId === p.id).map((b) => b.position).sort((a, b) => a - b);
      return pos.every((v, i) => v === i);
    }),
    true,
  );

  console.log("\ntimestamps");
  const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s);
  check("all material timestamps ISO-8601 UTC", dbMaterials.every((m) => isIso(m.createdAt) && isIso(m.updatedAt)), true);
  check("all product timestamps ISO-8601 UTC", dbProducts.every((p) => isIso(p.createdAt) && isIso(p.updatedAt)), true);

  console.log("\ncost snapshot fidelity (the important one)");
  // Each product must reproduce its OWN stored cost from its OWN persisted
  // tax/fee snapshot, rebuilt from the BOM rows in the database. This proves
  // the snapshot is correct and that history will not reprice.
  let reproduced = 0;
  const drift: string[] = [];
  for (const p of dbProducts) {
    const rows: CostRow[] = dbBom
      .filter((b) => b.productId === p.id)
      .sort((a, b) => a.position - b.position)
      .map((b) => ({ base_cost: b.baseCost, base_qty: b.baseQty, used_qty: b.usedQty }));
    const fees = JSON.parse(p.feesJson) as Fee[];
    const t = totalCost(
      { rows, workedHours: p.workedHours, laborRate: p.laborRate, additionalFees: fees },
      { taxPercent: p.taxPercent, taxBasis: p.taxBasis },
    );
    if (Math.abs(t.total - p.cost) < 0.005) reproduced++;
    else drift.push(`${p.name}: stored ${p.cost.toFixed(2)} vs ${t.total.toFixed(2)}`);
  }
  check("products reproducing their stored cost", reproduced, dbProducts.length);
  for (const d of drift) console.log(`         ${d}`);

  console.log("\nknown data conditions (informational, not failures)");
  console.log(`  products with sale_price = 0 : ${dbProducts.filter((p) => p.salePrice === 0).length}  (v2 never persisted it)`);
  console.log(`  materials with base_cost = 0 : ${dbMaterials.filter((m) => m.baseCost === 0).length}`);
  console.log(`  materials with base_qty  = 0 : ${dbMaterials.filter((m) => m.baseQty === 0).length}  (contribute $0 via safeDiv)`);
  const feeShapes = dbProducts.reduce((acc: Record<string, number>, p) => {
    const k = `tax${p.taxPercent}+${(JSON.parse(p.feesJson) as Fee[]).length}fees`;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  per-product fee snapshots    : ${JSON.stringify(feeShapes)}`);

  close();

  console.log("");
  if (failures) {
    console.error(`MIGRATION VERIFICATION FAILED -- ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("MIGRATION VERIFIED -- all checks passed");
}

main();
