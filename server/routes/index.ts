/**
 * The API surface, mounted at /api.
 *
 * Every handler is a thin, zod-validated wrapper over a DataStore method. That
 * shape is deliberate: it keeps the routes boring, and it means the same
 * operations can later be exposed as agent tools without rewriting anything.
 *
 * The wire format is byte-compatible with what the v2 Grommet client already
 * sends and expects (snake_case, `materials` for the BOM, `last_updated`).
 * That is what lets the existing UI drive this server unchanged.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import type { DataStore } from "../repo/types.js";
import type { Auth } from "../auth.js";
import { describeUser, isTrustedLocal, isUnconfigured } from "../auth.js";
import { env } from "../env.js";
import { materialToWire, productToWire } from "../../shared/types.js";
import type { MaterialInput, ProductInput } from "../../shared/types.js";

/** Numbers arrive from text inputs, so accept numeric strings everywhere. */
const num = z.union([z.number(), z.string()]).transform((v) => {
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
});

const materialBody = z
  .object({
    name: z.string().min(1, "name is required"),
    base_cost: num.optional(),
    baseCost: num.optional(),
    base_qty: num.optional(),
    baseQty: num.optional(),
    supplier: z.string().nullish(),
    description: z.string().nullish(),
    unit: z.string().nullish(),
    active: z.boolean().optional(),
  })
  .passthrough();

/**
 * Maps wire -> input WITHOUT inventing defaults. Absent stays undefined so
 * that update() can distinguish "not sent" from "explicitly zero"; filling
 * defaults here would make every PUT silently clear whatever it omitted.
 * Defaults are applied by the datastore on create.
 */
function toMaterialPatch(body: z.infer<typeof materialBody>): Partial<MaterialInput> & { name: string } {
  const patch: Partial<MaterialInput> & { name: string } = { name: body.name };
  const baseCost = body.base_cost ?? body.baseCost;
  const baseQty = body.base_qty ?? body.baseQty;
  if (baseCost !== undefined) patch.baseCost = baseCost;
  if (baseQty !== undefined) patch.baseQty = baseQty;
  if (body.supplier !== undefined) patch.supplier = body.supplier ?? null;
  if (body.description !== undefined) patch.description = body.description ?? null;
  if (body.unit !== undefined) patch.unit = body.unit ?? null;
  if (body.active !== undefined) patch.active = body.active;
  return patch;
}

const rowBody = z
  .object({
    material_id: z.union([z.string(), z.number()]).nullish(),
    materialId: z.union([z.string(), z.number()]).nullish(),
    name: z.string().default("Material"),
    supplier: z.string().nullish(),
    base_cost: num.optional(),
    baseCost: num.optional(),
    base_qty: num.optional(),
    baseQty: num.optional(),
    used_qty: num.optional(),
    usedQty: num.optional(),
  })
  .passthrough();

const productBody = z
  .object({
    name: z.string().min(1, "name is required"),
    materials: z.array(rowBody).optional(),
    rows: z.array(rowBody).optional(),
    notes: z.string().nullish(),
    cost: num.optional(),
    sale_price: num.optional(),
    salePrice: num.optional(),
    worked_hours: num.optional(),
    workedHours: num.optional(),
    labor_rate: num.optional(),
    laborRate: num.optional(),
    tax_percent: num.optional(),
    taxPercent: num.optional(),
    tax_basis: z.enum(["subtotal", "sale_price"]).optional(),
    profit_percent: num.optional(),
    profitPercent: num.optional(),
    fees: z.array(z.object({ serviceName: z.string().optional(), percentage: num })).optional(),
    photos: z.array(z.unknown()).optional(),
    active: z.boolean().optional(),
    qty: num.optional(),
  })
  .passthrough();

/** Same patch semantics as toMaterialPatch: absent means "leave alone". */
function toProductPatch(body: z.infer<typeof productBody>): Partial<ProductInput> & { name: string } {
  const patch: Partial<ProductInput> & { name: string } = { name: body.name };
  const rawRows = body.rows ?? body.materials;
  if (rawRows !== undefined) {
    patch.rows = rawRows.map((r) => ({
      materialId:
        r.material_id != null ? String(r.material_id) : r.materialId != null ? String(r.materialId) : null,
      name: r.name,
      supplier: r.supplier ?? null,
      baseCost: r.base_cost ?? r.baseCost ?? 0,
      baseQty: r.base_qty ?? r.baseQty ?? 1,
      usedQty: r.used_qty ?? r.usedQty ?? 0,
    }));
  }
  if (body.notes !== undefined && body.notes !== null) patch.notes = body.notes;
  const workedHours = body.worked_hours ?? body.workedHours;
  const laborRate = body.labor_rate ?? body.laborRate;
  const taxPercent = body.tax_percent ?? body.taxPercent;
  const profitPercent = body.profit_percent ?? body.profitPercent;
  const salePrice = body.sale_price ?? body.salePrice;
  if (workedHours !== undefined) patch.workedHours = workedHours;
  if (laborRate !== undefined) patch.laborRate = laborRate;
  if (taxPercent !== undefined) patch.taxPercent = taxPercent;
  if (body.tax_basis !== undefined) patch.taxBasis = body.tax_basis;
  if (profitPercent !== undefined) patch.profitPercent = profitPercent;
  if (body.fees !== undefined) patch.fees = body.fees;
  if (salePrice !== undefined) patch.salePrice = salePrice;
  // Only honoured when explicitly supplied -- lets an import preserve a
  // historical cost that today's settings would not reproduce.
  if (body.cost !== undefined) patch.cost = body.cost;
  if (body.photos !== undefined) patch.photos = body.photos;
  if (body.active !== undefined) patch.active = body.active;
  if (body.qty !== undefined) patch.qty = body.qty;
  return patch;
}

/** Creation needs a complete input; rows default to empty, nothing else does. */
function toProductInput(body: z.infer<typeof productBody>): ProductInput {
  const patch = toProductPatch(body);
  return { ...patch, rows: patch.rows ?? [] };
}

/** Turns a thrown error into a JSON response instead of an HTML stack trace. */
function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Unexpected error";
      // Unique-constraint violations are a user-facing condition, not a 500.
      const conflict = /UNIQUE constraint failed/i.test(message);
      res.status(conflict ? 409 : 500).json({
        error: conflict ? "A product with that name already exists" : message,
      });
    });
  };
}

function parseOr400<T>(res: Response, schema: z.ZodType<T>, body: unknown): T | null {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  res.status(400).json({
    error: "Invalid request",
    details: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
  });
  return null;
}

export function createApiRouter(store: DataStore, auth: Auth): Router {
  const api = Router();

  // ------------------------------------------------------------------ health
  // Unauthenticated on purpose: the header status pill polls it, and a health
  // check that requires a session cannot report that the session expired.
  api.get(
    "/health",
    wrap(async (_req, res) => {
      const h = await store.health();
      res.json({ status: h.ok ? "ok" : "degraded", db: store.mode, latencyMs: h.latencyMs });
    }),
  );

  // -------------------------------------------------------------------- auth
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Try again in 15 minutes." },
  });

  api.post(
    "/auth/login",
    loginLimiter,
    wrap(async (req, res) => {
      const body = parseOr400(res, z.object({ password: z.string().optional(), email: z.string().optional() }), req.body);
      if (!body) return;

      if (isUnconfigured()) {
        // No password set yet: allow in, but say so plainly rather than
        // pretending a credential was checked.
        auth.issueSession(req, res);
        res.json({ user: describeUser(req), warning: "No password is configured." });
        return;
      }
      const ok = await auth.checkPassword(body.password ?? "");
      // Constant-ish delay so failures are not trivially timeable.
      if (!ok) {
        await new Promise((r) => setTimeout(r, 250));
        res.status(401).json({ error: "Invalid credentials." });
        return;
      }
      auth.issueSession(req, res);
      res.json({ user: describeUser(req) });
    }),
  );

  api.post(
    "/auth/logout",
    wrap(async (req, res) => {
      auth.clearSession(req, res);
      res.json({ message: "Signed out" });
    }),
  );

  api.get(
    "/auth/me",
    wrap(async (req, res) => {
      if (isTrustedLocal(req) || isUnconfigured()) {
        res.json({ user: describeUser(req) });
        return;
      }
      const session = auth.readSession(req);
      if (!session) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      auth.touchSession(req, res, session.token); // sliding expiration, as in v2
      res.json({ user: describeUser(req) });
    }),
  );

  api.post(
    "/auth/sign-out-everywhere",
    auth.requireAuth,
    wrap(async (req, res) => {
      const n = auth.signOutEverywhere();
      auth.clearSession(req, res);
      res.json({ message: `Signed out ${n} session(s)` });
    }),
  );

  // Everything below requires a session (or trusted loopback).
  api.use(auth.requireAuth);

  // --------------------------------------------------------------- materials

  api.get(
    "/materials",
    wrap(async (_req, res) => {
      res.json((await store.materials.list()).map(materialToWire));
    }),
  );

  api.get(
    "/materials/common",
    wrap(async (_req, res) => {
      res.json((await store.materials.listCommon()).map(materialToWire));
    }),
  );

  api.get(
    "/materials/:id",
    wrap(async (req, res) => {
      const m = await store.materials.get(String(req.params.id));
      if (!m) {
        res.status(404).json({ error: "Material not found" });
        return;
      }
      res.json(materialToWire(m));
    }),
  );

  api.post(
    "/materials",
    wrap(async (req, res) => {
      const body = parseOr400(res, materialBody, req.body);
      if (!body) return;
      res.status(201).json(materialToWire(await store.materials.create(toMaterialPatch(body))));
    }),
  );

  api.put(
    "/materials/:id",
    wrap(async (req, res) => {
      const body = parseOr400(res, materialBody, req.body);
      if (!body) return;
      const updated = await store.materials.update(String(req.params.id), toMaterialPatch(body));
      if (!updated) {
        res.status(404).json({ error: "Material not found" });
        return;
      }
      res.json(materialToWire(updated));
    }),
  );

  api.delete(
    "/materials/:id",
    wrap(async (req, res) => {
      const ok = await store.materials.delete(String(req.params.id));
      if (!ok) {
        res.status(404).json({ error: "Material not found" });
        return;
      }
      // v2's InventoryPage destructures { message } from this response, and
      // v2's own deleteMaterial returned undefined -- the live TypeError.
      res.json({ message: "Material deleted" });
    }),
  );

  api.post(
    "/materials/bulk",
    wrap(async (req, res) => {
      const body = parseOr400(res, z.array(materialBody), req.body);
      if (!body) return;
      res.json(await store.materials.replaceAll(body.map(toMaterialPatch)));
    }),
  );

  // ---------------------------------------------------------------- products

  api.get(
    "/products",
    wrap(async (_req, res) => {
      res.json((await store.products.list()).map(productToWire));
    }),
  );

  api.get(
    "/products/:id",
    wrap(async (req, res) => {
      const p = await store.products.get(String(req.params.id));
      if (!p) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      res.json(productToWire(p));
    }),
  );

  api.post(
    "/products",
    wrap(async (req, res) => {
      const body = parseOr400(res, productBody, req.body);
      if (!body) return;
      // upsertByName preserves v2's "no duplicates by name" behaviour, which
      // it enforced client-side against only the loaded list.
      res.status(201).json(productToWire(await store.products.upsertByName(toProductPatch(body))));
    }),
  );

  api.put(
    "/products/:id",
    wrap(async (req, res) => {
      const body = parseOr400(res, productBody, req.body);
      if (!body) return;
      const updated = await store.products.update(String(req.params.id), toProductPatch(body));
      if (!updated) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      res.json(productToWire(updated));
    }),
  );

  api.delete(
    "/products/:id",
    wrap(async (req, res) => {
      const ok = await store.products.delete(String(req.params.id));
      if (!ok) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      res.json({ message: "Product deleted" });
    }),
  );

  api.post(
    "/products/bulk",
    wrap(async (req, res) => {
      const body = parseOr400(res, z.array(productBody), req.body);
      if (!body) return;
      res.json(await store.products.replaceAll(body.map(toProductInput)));
    }),
  );

  // ---------------------------------------------------------------- settings

  api.get(
    "/settings",
    wrap(async (_req, res) => {
      res.json({ settings: await store.settings.get(), fees: await store.settings.listFees() });
    }),
  );

  api.put(
    "/settings",
    wrap(async (req, res) => {
      const body = parseOr400(
        res,
        z
          .object({
            laborRate: num.optional(),
            taxPercent: num.optional(),
            taxBasis: z.enum(["subtotal", "sale_price"]).optional(),
            profitPercent: num.optional(),
            currency: z.string().optional(),
            currencySymbol: z.string().optional(),
            locale: z.string().optional(),
            timezone: z.string().optional(),
            theme: z.enum(["light", "dark", "system"]).optional(),
            sessionMinutes: num.optional(),
          })
          .strict(),
        req.body,
      );
      if (!body) return;
      res.json(await store.settings.update(body));
    }),
  );

  api.post(
    "/settings/fees",
    wrap(async (req, res) => {
      const body = parseOr400(
        res,
        z.object({
          id: z.string().optional(),
          label: z.string().min(1),
          percentage: num.optional(),
          basis: z.enum(["subtotal", "sale_price"]).optional(),
          position: num.optional(),
          enabled: z.boolean().optional(),
        }),
        req.body,
      );
      if (!body) return;
      res.json(await store.settings.saveFee(body));
    }),
  );

  api.delete(
    "/settings/fees/:id",
    wrap(async (req, res) => {
      const ok = await store.settings.deleteFee(String(req.params.id));
      if (!ok) {
        res.status(404).json({ error: "Fee not found" });
        return;
      }
      res.json({ message: "Fee deleted" });
    }),
  );

  // ------------------------------------------------------------------ backup

  api.get(
    "/backup",
    wrap(async (_req, res) => {
      res.json(await store.backup.dump());
    }),
  );

  api.post(
    "/backup/restore",
    wrap(async (req, res) => {
      res.json(await store.backup.restore(req.body));
    }),
  );

  // Anything else under /api is a genuine 404, not the SPA shell.
  api.use((_req, res) => {
    res.status(404).json({ error: "Unknown endpoint" });
  });

  return api;
}

export { env };
