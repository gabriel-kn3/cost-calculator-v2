/**
 * SQLite connection + migration runner.
 *
 * PRAGMA foreign_keys must be set per CONNECTION, not once at schema time --
 * SQLite defaults it off, and the product_materials -> materials ON DELETE SET
 * NULL rule (which protects product history) is inert without it.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../shared/schema.sqlite.js";

export type Db = BetterSQLite3Database<typeof schema>;

export interface OpenDbResult {
  db: Db;
  sqlite: Database.Database;
  close: () => void;
}

export function openDb(file: string, opts: { migrate?: boolean } = {}): OpenDbResult {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });

  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  if (opts.migrate !== false) {
    migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "../drizzle") });
  }

  return { db, sqlite, close: () => sqlite.close() };
}

export const DEFAULT_DB_PATH = process.env.DATABASE_PATH ?? "./data/app.db";
export { schema };
