import { describe, it, expect } from "vitest";
import { buildShopifyCsv, toHandle } from "../../client/src/lib/shopifyCsv.js";
import type { WireProduct } from "../../shared/types.js";

function product(over: Partial<WireProduct> = {}): WireProduct {
  return {
    id: "1",
    name: "Mar Keychain",
    materials: [],
    cost: 10.05,
    sale_price: 0,
    photos: [],
    notes: "",
    active: true,
    worked_hours: 0.25,
    labor_rate: 12,
    created_at: "2026-01-23T00:00:00.000Z",
    last_updated: "2026-01-23T00:00:00.000Z",
    tax_percent: 7.5,
    tax_basis: "subtotal",
    profit_percent: 20,
    fees: [],
    totals: { materials: 5.87, labor: 3, subTotal: 8.87, tax: 0.67, productFees: 0.51, total: 10.05 },
    ...over,
  };
}

const rows = (csv: string) => csv.split("\r\n");
const cells = (line: string) => line.split(",");

describe("toHandle", () => {
  it("lowercases and dash-separates", () => {
    expect(toHandle("Mar Keychain")).toBe("mar-keychain");
  });

  it("strips accents rather than dropping the characters", () => {
    // The catalogue is Spanish; "Libélula" must not become "lib-lula".
    expect(toHandle("Libélula Adjustable Necklace")).toBe("libelula-adjustable-necklace");
  });

  it("collapses punctuation and trims stray dashes", () => {
    expect(toHandle("Pantallas (2 tonos) — San Valentín!")).toBe("pantallas-2-tonos-san-valentin");
  });

  it("never returns an empty handle", () => {
    expect(toHandle("!!!")).toBe("product");
  });
});

describe("buildShopifyCsv", () => {
  it("emits a header plus one row per product", () => {
    const csv = buildShopifyCsv([product(), product({ id: "2", name: "Chain Necklace" })]);
    expect(rows(csv)).toHaveLength(3);
    expect(rows(csv)[0]).toContain("Cost per item");
  });

  it("always imports as a draft so nothing goes on sale by accident", () => {
    const csv = buildShopifyCsv([product()]);
    const header = cells(rows(csv)[0]!);
    const row = cells(rows(csv)[1]!);
    expect(row[header.indexOf("Published")]).toBe("FALSE");
    expect(row[header.indexOf("Status")]).toBe("draft");
  });

  it("carries the calculated cost as Cost per item", () => {
    const csv = buildShopifyCsv([product({ cost: 29.51 })]);
    const header = cells(rows(csv)[0]!);
    expect(cells(rows(csv)[1]!)[header.indexOf("Cost per item")]).toBe("29.51");
  });

  it("exports an unpriced product at 0.00 unless the cost fallback is on", () => {
    const header = cells(rows(buildShopifyCsv([product()]))[0]!);
    const priceIdx = header.indexOf("Variant Price");

    const plain = buildShopifyCsv([product({ sale_price: 0, cost: 10.05 })]);
    expect(cells(rows(plain)[1]!)[priceIdx]).toBe("0.00");

    const fallback = buildShopifyCsv([product({ sale_price: 0, cost: 10.05 })], {
      priceFallbackToCost: true,
    });
    expect(cells(rows(fallback)[1]!)[priceIdx]).toBe("10.05");
  });

  it("prefers an explicit sale price over the cost", () => {
    const header = cells(rows(buildShopifyCsv([product()]))[0]!);
    const csv = buildShopifyCsv([product({ sale_price: 24.99, cost: 10.05 })]);
    expect(cells(rows(csv)[1]!)[header.indexOf("Variant Price")]).toBe("24.99");
  });

  it("never exports internal notes into the storefront description", () => {
    const csv = buildShopifyCsv([
      product({ notes: "Use the navy cord, NOT the black one. Reorder from Amazon." }),
    ]);
    expect(csv).not.toContain("navy cord");
    expect(csv).not.toContain("Amazon");
  });

  it("quotes names containing commas or quotes", () => {
    const csv = buildShopifyCsv([product({ name: 'Set of 3, "mini" size' })]);
    expect(rows(csv)[1]).toContain('"Set of 3, ""mini"" size"');
    // The quoted field must not split the row.
    expect(rows(csv)).toHaveLength(2);
  });
});
