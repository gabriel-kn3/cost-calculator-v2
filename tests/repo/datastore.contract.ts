/**
 * The DataStore contract suite.
 *
 * Deliberately written against the INTERFACE, not against SQLite. The Supabase
 * adapter will be handed to this same suite unchanged -- that is the only real
 * proof the second backend works, and the reason the interface exists at all.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DataStore } from "../../server/repo/types.js";

export function runDataStoreContract(name: string, makeStore: () => Promise<DataStore>) {
  describe(`DataStore contract: ${name}`, () => {
    let store: DataStore;

    beforeEach(async () => {
      store = await makeStore();
    });
    afterEach(async () => {
      await store.close();
    });

    // ------------------------------------------------------------- materials

    it("creates a material and derives isCommon from the * convention", async () => {
      const plain = await store.materials.create({ name: "Cordon azul", baseCost: 2.5, baseQty: 1 });
      expect(plain.isCommon).toBe(false);
      expect(plain.id).toBeTruthy();

      const common = await store.materials.create({ name: "Bolsa de entrega*", baseCost: 3, baseQty: 5 });
      expect(common.isCommon).toBe(true);

      expect((await store.materials.listCommon()).map((m) => m.name)).toEqual(["Bolsa de entrega*"]);
    });

    it("re-derives isCommon when a rename adds or removes the *", async () => {
      const m = await store.materials.create({ name: "Charm", baseCost: 1, baseQty: 1 });
      expect(m.isCommon).toBe(false);

      const renamed = await store.materials.update(m.id, { name: "Charm*" });
      expect(renamed?.isCommon).toBe(true);

      const reverted = await store.materials.update(m.id, { name: "Charm" });
      expect(reverted?.isCommon).toBe(false);
    });

    it("preserves a base_qty of 0 rather than coercing it to 1", async () => {
      // Live data contains exactly this (Charm*, id 53). It makes the line
      // contribute $0 via safeDiv. The datastore must not quietly "fix" it --
      // the dashboard surfaces it instead.
      const m = await store.materials.create({ name: "Zero*", baseCost: 0, baseQty: 0 });
      expect(m.baseQty).toBe(0);
      expect((await store.materials.get(m.id))?.baseQty).toBe(0);
    });

    it("reports whether a delete actually removed anything", async () => {
      const m = await store.materials.create({ name: "Temp" });
      expect(await store.materials.delete(m.id)).toBe(true);
      expect(await store.materials.delete(m.id)).toBe(false);
      expect(await store.materials.get(m.id)).toBeNull();
    });

    it("replaces all materials in one transaction", async () => {
      await store.materials.create({ name: "old one" });
      await store.materials.create({ name: "old two" });

      const res = await store.materials.replaceAll([
        { name: "new one", baseCost: 1, baseQty: 2 },
        { name: "new two*", baseCost: 3, baseQty: 4 },
      ]);
      expect(res.deleted).toBe(2);
      expect(res.created).toBe(2);

      const all = await store.materials.list();
      expect(all.map((m) => m.name).sort()).toEqual(["new one", "new two*"]);
      expect(all.find((m) => m.name === "new two*")?.isCommon).toBe(true);
    });

    // -------------------------------------------------------------- products

    it("computes cost from rows using the frozen math", async () => {
      await store.settings.update({ taxPercent: 7.5, laborRate: 12 });

      const p = await store.products.create({
        name: "Test Necklace",
        workedHours: 1,
        laborRate: 12,
        taxPercent: 7.5,
        fees: [{ serviceName: "Shopify", percentage: 2.9 }, { serviceName: "Credit Card", percentage: 2.9 }],
        rows: [
          { name: "Cordon", baseCost: 2.5, baseQty: 1, usedQty: 1 },
          { name: "Campanas", baseCost: 10, baseQty: 40, usedQty: 4 },
        ],
      });

      // materials 2.5 + 1.0 = 3.5, labor 12 -> subtotal 15.5
      // fees 5.8% = 0.899, tax 7.5% = 1.1625 -> total 17.56
      expect(p.totals.materials).toBe(3.5);
      expect(p.totals.labor).toBe(12);
      expect(p.totals.subTotal).toBe(15.5);
      expect(p.cost).toBe(17.56);
      expect(p.rows).toHaveLength(2);
      expect(p.rows.map((r) => r.position)).toEqual([0, 1]);
    });

    it("honours an explicit cost so imports can preserve history", async () => {
      // The oldest real product was saved before platform fees existed; its
      // stored cost is not reproducible under today's defaults.
      const p = await store.products.create({
        name: "Historical",
        cost: 29.51,
        rows: [{ name: "x", baseCost: 1, baseQty: 1, usedQty: 1 }],
      });
      expect(p.cost).toBe(29.51);
    });

    it("persists sale_price (v2 silently dropped it)", async () => {
      const p = await store.products.create({
        name: "Priced",
        salePrice: 42.5,
        rows: [{ name: "x", baseCost: 1, baseQty: 1, usedQty: 1 }],
      });
      expect(p.salePrice).toBe(42.5);
      expect((await store.products.get(p.id))?.salePrice).toBe(42.5);
    });

    it("keeps the full totals breakdown (v2 kept only the total)", async () => {
      const p = await store.products.create({
        name: "Breakdown",
        workedHours: 1,
        laborRate: 10,
        taxPercent: 10,
        fees: [],
        rows: [{ name: "x", baseCost: 10, baseQty: 1, usedQty: 1 }],
      });
      const back = await store.products.get(p.id);
      expect(back?.totals).toMatchObject({ materials: 10, labor: 10, subTotal: 20, tax: 2, total: 22 });
    });

    it("upserts by normalised name rather than duplicating", async () => {
      const a = await store.products.create({ name: "Mi Isla Choker", rows: [] });
      const b = await store.products.upsertByName({ name: "  mi   isla   CHOKER  ", rows: [] });

      expect(b.id).toBe(a.id);
      expect(await store.products.list()).toHaveLength(1);
    });

    it("stores a per-product pricing snapshot that later settings cannot move", async () => {
      const p = await store.products.create({
        name: "Snapshotted",
        workedHours: 0,
        laborRate: 0,
        taxPercent: 7.5,
        fees: [{ serviceName: "Shopify", percentage: 2.9 }],
        rows: [{ name: "x", baseCost: 100, baseQty: 1, usedQty: 1 }],
      });
      const before = p.cost;

      await store.settings.update({ taxPercent: 99 });

      const after = await store.products.get(p.id);
      expect(after?.cost).toBe(before);
      expect(after?.taxPercent).toBe(7.5);
      expect(after?.fees).toHaveLength(1);
    });

    it("reprices on update while leaving other products alone", async () => {
      const a = await store.products.create({
        name: "A", taxPercent: 0, fees: [], laborRate: 0, workedHours: 0,
        rows: [{ name: "x", baseCost: 10, baseQty: 1, usedQty: 1 }],
      });
      const b = await store.products.create({
        name: "B", taxPercent: 0, fees: [], laborRate: 0, workedHours: 0,
        rows: [{ name: "y", baseCost: 5, baseQty: 1, usedQty: 1 }],
      });

      const updated = await store.products.update(a.id, {
        rows: [{ name: "x", baseCost: 10, baseQty: 1, usedQty: 3 }],
      });
      expect(updated?.cost).toBe(30);
      expect((await store.products.get(b.id))?.cost).toBe(b.cost);
    });

    it("keeps product history when a referenced material is deleted", async () => {
      const m = await store.materials.create({ name: "Doomed", baseCost: 4, baseQty: 1 });
      const p = await store.products.create({
        name: "Survivor", taxPercent: 0, fees: [], laborRate: 0, workedHours: 0,
        rows: [{ materialId: m.id, name: "Doomed", baseCost: 4, baseQty: 1, usedQty: 2 }],
      });
      expect(p.cost).toBe(8);

      await store.materials.delete(m.id);

      const after = await store.products.get(p.id);
      expect(after).not.toBeNull();
      expect(after!.rows).toHaveLength(1);
      expect(after!.rows[0]!.materialId).toBeNull();   // ON DELETE SET NULL
      expect(after!.rows[0]!.name).toBe("Doomed");     // snapshot survives
      expect(after!.rows[0]!.baseCost).toBe(4);
      expect(after!.cost).toBe(8);
    });

    it("cascades BOM rows when a product is deleted", async () => {
      const p = await store.products.create({
        name: "Gone", rows: [{ name: "x", baseCost: 1, baseQty: 1, usedQty: 1 }],
      });
      expect(await store.products.delete(p.id)).toBe(true);
      expect(await store.products.get(p.id)).toBeNull();
      expect(await store.products.delete(p.id)).toBe(false);
    });

    it("upsert leaves omitted fields alone instead of resetting them", async () => {
      // Regression: the route used to fill defaults before calling the store,
      // so a save that sent only a name wiped sale_price and the whole BOM.
      const created = await store.products.create({
        name: "Patchy",
        salePrice: 99.99,
        taxPercent: 0, fees: [], laborRate: 0, workedHours: 0,
        rows: [{ name: "Cordon", baseCost: 2.5, baseQty: 1, usedQty: 2 }],
      });
      expect(created.salePrice).toBe(99.99);

      const upserted = await store.products.upsertByName({ name: "  patchy  " });

      expect(upserted.id).toBe(created.id);
      expect(upserted.salePrice).toBe(99.99);
      expect(upserted.rows).toHaveLength(1);
      expect(upserted.cost).toBe(5);
    });

    it("applies an explicit zero rather than treating it as absent", async () => {
      const p = await store.products.create({
        name: "Zeroable", salePrice: 50,
        taxPercent: 0, fees: [], laborRate: 0, workedHours: 0,
        rows: [{ name: "x", baseCost: 1, baseQty: 1, usedQty: 1 }],
      });
      const updated = await store.products.update(p.id, { salePrice: 0 });
      expect(updated?.salePrice).toBe(0);
    });

    it("upsert creates when nothing matches, defaulting rows to empty", async () => {
      const p = await store.products.upsertByName({ name: "Brand New" });
      expect(p.rows).toEqual([]);
      expect(p.cost).toBe(0);
    });

    // -------------------------------------------------------------- settings

    it("treats settings as a singleton", async () => {
      const a = await store.settings.get();
      const b = await store.settings.get();
      expect(a.id).toBe("default");
      expect(b.id).toBe("default");

      const updated = await store.settings.update({ laborRate: 20 });
      expect(updated.laborRate).toBe(20);
      expect((await store.settings.get()).laborRate).toBe(20);
    });

    it("manages the fee list", async () => {
      const fee = await store.settings.saveFee({ label: "Etsy", percentage: 6.5 });
      expect(fee.id).toBeTruthy();
      expect(fee.percentage).toBe(6.5);

      const edited = await store.settings.saveFee({ id: fee.id, label: "Etsy", percentage: 7 });
      expect(edited.id).toBe(fee.id);
      expect(edited.percentage).toBe(7);

      expect(await store.settings.deleteFee(fee.id)).toBe(true);
      expect(await store.settings.deleteFee(fee.id)).toBe(false);
    });

    // ---------------------------------------------------------------- backup

    it("round-trips a backup including BOM rows", async () => {
      const m = await store.materials.create({ name: "Kept*", baseCost: 2, baseQty: 4 });
      await store.products.create({
        name: "WithRows", taxPercent: 0, fees: [], laborRate: 0, workedHours: 0,
        rows: [
          { materialId: m.id, name: "Kept*", baseCost: 2, baseQty: 4, usedQty: 8 },
          { name: "Loose", baseCost: 1, baseQty: 1, usedQty: 1 },
        ],
      });

      const bundle = await store.backup.dump();
      expect(bundle.product_materials).toHaveLength(2);

      await store.materials.replaceAll([]);
      await store.products.replaceAll([]);
      expect(await store.products.list()).toHaveLength(0);

      const res = await store.backup.restore(bundle);
      expect(res.materials).toBe(1);
      expect(res.products).toBe(1);

      const restored = (await store.products.list())[0]!;
      expect(restored.rows).toHaveLength(2);
      expect(restored.rows[0]!.name).toBe("Kept*");
      expect(restored.rows[0]!.usedQty).toBe(8);
      expect(restored.cost).toBe(5); // (2/4)*8 + 1
    });

    it("rejects a bundle that is not a backup", async () => {
      await expect(store.backup.restore({ kind: "nope" } as never)).rejects.toThrow();
    });

    // ---------------------------------------------------------------- health

    it("reports health", async () => {
      const h = await store.health();
      expect(h.ok).toBe(true);
      expect(typeof h.latencyMs).toBe("number");
    });
  });
}
