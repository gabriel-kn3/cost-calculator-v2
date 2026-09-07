/** Applies pending migrations to the configured database. */
import { openDb, DEFAULT_DB_PATH } from "../db.js";

const { close } = openDb(DEFAULT_DB_PATH);
close();
console.log(`migrations applied to ${DEFAULT_DB_PATH}`);
