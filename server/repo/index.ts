/**
 * Datastore factory. The TypeScript descendant of hmbb-backend's
 * models/base.py:
 *
 *     def get_backend_repo(supabase_cls, local_cls):
 *         if settings.db_mode.lower() == "local": return local_cls()
 *         return supabase_cls()
 *
 * Same idea, with the default flipped: SQLite is primary and Supabase is the
 * opt-in, because the app must work with no network.
 */
import { openDb } from "../db.js";
import { env } from "../env.js";
import { createSqliteStore } from "./sqlite/index.js";
import type { DataStore } from "./types.js";

export function createDataStore(): DataStore {
  if (env.DB_MODE === "supabase") {
    // Phase 8. Deliberately a hard failure rather than a silent fallback to
    // SQLite -- quietly writing to the wrong database is far worse than a
    // refusal to boot.
    throw new Error(
      "DB_MODE=supabase is not implemented yet (Phase 8). Unset DB_MODE or set it to 'sqlite'.",
    );
  }
  const { db, sqlite } = openDb(env.DATABASE_PATH);
  return createSqliteStore(db, sqlite);
}

export type { DataStore } from "./types.js";
