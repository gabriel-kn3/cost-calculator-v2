/**
 * Content fingerprint of a cost-calculator database, for proving a deploy or
 * migration did not change the operator's data.
 *
 *   node scripts/db-fingerprint.mjs "<folder containing app.db>"
 *
 * Never opens the live file: app.db, app.db-wal and app.db-shm are copied to a
 * temp folder first, and only the copy is opened. That matters because opening
 * a WAL-mode database can checkpoint it, and because most recent work may live
 * only in the -wal file -- the three files are only meaningful together.
 *
 * Hashes the columns that existed before any migration, so a fingerprint taken
 * before a schema change compares cleanly with one taken after it.
 */
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, "app.db"))) {
  console.error("usage: node scripts/db-fingerprint.mjs <folder containing app.db>");
  process.exit(2);
}

const tmp = mkdtempSync(join(tmpdir(), "costcalc-fp-"));
try {
  for (const f of ["app.db", "app.db-wal", "app.db-shm"]) {
    if (existsSync(join(dir, f))) copyFileSync(join(dir, f), join(tmp, f));
  }
  const db = new Database(join(tmp, "app.db"));

  const tables = {
    materials:
      "select id,name,base_cost,base_qty,unit,supplier,description,active,is_common,created_at,updated_at from materials order by id",
    products:
      "select id,name,name_norm,notes,worked_hours,labor_rate,tax_percent,tax_basis,profit_percent,fees_json,sale_price,cost,totals_json,photos_json,active,qty,created_at,updated_at from products order by id",
    product_materials:
      "select product_id,material_id,position,name,supplier,base_cost,base_qty,used_qty from product_materials order by product_id,position",
    fees: "select id,label,percentage,basis,position,enabled from fees order by id",
    settings:
      "select labor_rate,tax_percent,tax_basis,profit_percent,currency,currency_symbol,locale,timezone,theme from settings",
  };

  const out = { integrity: db.pragma("integrity_check", { simple: true }) };
  const all = createHash("sha256");
  for (const [name, sql] of Object.entries(tables)) {
    const rows = db.prepare(sql).all();
    const h = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    all.update(h);
    out[name] = { rows: rows.length, sha256: h.slice(0, 16) };
  }
  out.fingerprint = all.digest("hex");
  db.close();
  console.log(JSON.stringify(out, null, 2));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
