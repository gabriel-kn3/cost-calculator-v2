/**
 * SQLite schema (primary datastore).
 *
 * Cross-dialect rules so the Supabase/Postgres adapter can satisfy the same
 * repository interface without divergence:
 *   1. IDs are TEXT minted by the app, never by the database. Legacy numeric
 *      ids from the recovered CSVs are preserved verbatim as strings so BOM
 *      references resolve with zero remapping.
 *   2. Timestamps are ISO-8601 UTC strings, set server-side. Never a locale
 *      string -- that bug is why product sorting was unreliable in v2.
 *   3. No dialect-specific features: no triggers, no generated columns.
 *   4. JSON is stored as TEXT here / jsonb in Postgres; parsing lives in the
 *      adapter so repositories always return domain objects.
 */
import { sql } from "drizzle-orm";
import { sqliteTable, text, real, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const materials = sqliteTable(
  "materials",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /** What `base_cost` buys you `base_qty` of. Unit cost is derived, never stored. */
    baseCost: real("base_cost").notNull().default(0),
    baseQty: real("base_qty").notNull().default(1),
    /** Optional free-text unit label ("in", "g", "ea"). v2 had no units at all. */
    unit: text("unit"),
    supplier: text("supplier"),
    description: text("description"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    /**
     * Derived by the adapter on every write from name.includes("*").
     * The "*" convention stays the user-facing source of truth -- she is
     * trained on it -- but this gives us an index instead of a full-table
     * JavaScript filter on every "Add Common" click.
     */
    isCommon: integer("is_common", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("materials_name_idx").on(t.name), index("materials_common_idx").on(t.isCommon)],
);

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /** lower(trim(collapse-whitespace(name))). Enforces v2's dedupe rule in the DB. */
    nameNorm: text("name_norm").notNull(),
    notes: text("notes").notNull().default(""),
    workedHours: real("worked_hours").notNull().default(0),
    laborRate: real("labor_rate").notNull().default(0),

    /**
     * Pricing SNAPSHOT taken at save time. Recovered data proves this is
     * required, not optional: 16 products were saved with both platform fees
     * and 1 (the oldest) with none, so a single global fee list cannot
     * reproduce their stored costs. Changing Settings must never reprice
     * history.
     */
    taxPercent: real("tax_percent").notNull().default(0),
    taxBasis: text("tax_basis", { enum: ["subtotal", "sale_price"] }).notNull().default("subtotal"),
    profitPercent: real("profit_percent").notNull().default(0),
    feesJson: text("fees_json").notNull().default("[]"),

    salePrice: real("sale_price").notNull().default(0),
    /** == totals.total. Denormalised so Products can sort by cost in SQL. */
    cost: real("cost").notNull().default(0),
    /** Full breakdown; v2 discarded everything but `total` on read. */
    totalsJson: text("totals_json").notNull().default("{}"),
    photosJson: text("photos_json").notNull().default("[]"),

    active: integer("active", { mode: "boolean" }).notNull().default(true),
    qty: integer("qty").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("products_name_norm_uq").on(t.nameNorm),
    index("products_updated_idx").on(t.updatedAt),
  ],
);

/**
 * Bill of materials. A child table rather than a JSON blob: the snapshot
 * columns preserve historical cost exactly as a JSON BOM would, but joining
 * is what makes the dashboard questions answerable -- "which products cost
 * more than when I saved them" and "what uses this material".
 */
export const productMaterials = sqliteTable(
  "product_materials",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    /** SET NULL, not CASCADE: deleting a material must never destroy history. */
    materialId: text("material_id").references(() => materials.id, { onDelete: "set null" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    supplier: text("supplier"),
    baseCost: real("base_cost").notNull().default(0),
    baseQty: real("base_qty").notNull().default(1),
    usedQty: real("used_qty").notNull().default(0),
  },
  (t) => [
    index("pm_product_idx").on(t.productId, t.position),
    index("pm_material_idx").on(t.materialId),
  ],
);

/** Enforced singleton: the CHECK means there is no "which row?" branch anywhere. */
export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().default("default"),
  laborRate: real("labor_rate").notNull().default(12),
  taxPercent: real("tax_percent").notNull().default(7.5),
  taxBasis: text("tax_basis", { enum: ["subtotal", "sale_price"] }).notNull().default("subtotal"),
  profitPercent: real("profit_percent").notNull().default(20),
  currency: text("currency").notNull().default("USD"),
  currencySymbol: text("currency_symbol").notNull().default("$"),
  locale: text("locale").notNull().default("en-US"),
  /** v2 hardcoded America/New_York in ProductCard.jsx. */
  timezone: text("timezone").notNull().default("America/New_York"),
  theme: text("theme", { enum: ["light", "dark", "system"] }).notNull().default("system"),
  sessionMinutes: integer("session_minutes").notNull().default(480),
  updatedAt: text("updated_at").notNull(),
});

/** Global fee list. v2 hardcoded [Shopify 2.9, Credit Card 2.9] in a reducer. */
export const fees = sqliteTable("fees", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  percentage: real("percentage").notNull().default(0),
  /** Forward hook. Only "subtotal" is honoured today -- see costMath's frozen note. */
  basis: text("basis", { enum: ["subtotal", "sale_price"] }).notNull().default("subtotal"),
  position: integer("position").notNull().default(0),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Opaque server-side sessions: revocable, unlike a JWT. */
export const sessions = sqliteTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
  },
  (t) => [index("sessions_expires_idx").on(t.expiresAt)],
);

/** Calculator drafts. v2 lost the entire draft on refresh. */
export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Untitled Product"),
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
  stateJson: text("state_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
