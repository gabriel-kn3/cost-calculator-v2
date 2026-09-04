import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./shared/schema.sqlite.ts",
  out: "./drizzle",
  dbCredentials: { url: "./data/app.db" },
  strict: true,
  verbose: true,
});
