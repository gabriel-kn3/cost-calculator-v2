import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb } from "../../server/db.js";
import { createSqliteStore } from "../../server/repo/sqlite/index.js";
import { runDataStoreContract } from "./datastore.contract.js";

const tmpFiles: string[] = [];

runDataStoreContract("sqlite", async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "costcalc-")), "test.db");
  tmpFiles.push(file);
  const { db, sqlite } = openDb(file);
  return createSqliteStore(db, sqlite);
});
