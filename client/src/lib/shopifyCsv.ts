/**
 * Shopify product CSV export.
 *
 * An EXPORT, not a backup. It is lossy by design: it carries only what
 * Shopify's product importer understands. Backups are a separate thing and
 * must contain everything.
 *
 * The column that earns this feature is `Cost per item`. Shopify stores it on
 * the variant and then shows real margin in its own admin -- computed from the
 * material math in this app rather than guessed.
 *
 * `Published` is FALSE and `Status` is draft on every row, deliberately:
 * importing should never put something on sale by accident.
 *
 * Product notes are NOT exported. They are internal working notes -- material
 * substitutions, assembly steps, reminders -- and have no business appearing in
 * a storefront description.
 */
import type { WireProduct } from "@shared/types";

/** Shopify handles are lowercase, alphanumeric and dash-separated. */
export function toHandle(name: string): string {
  return (
    name
      .normalize("NFD")
      // Strip accents so "Libélula" becomes "libelula" rather than dropping out.
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "product"
  );
}

const COLUMNS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Variant SKU",
  "Variant Inventory Tracker",
  "Variant Inventory Qty",
  "Variant Inventory Policy",
  "Variant Fulfillment Service",
  "Variant Price",
  "Variant Requires Shipping",
  "Variant Taxable",
  "Cost per item",
  "Status",
] as const;

function escapeCell(value: string): string {
  // RFC 4180: quote when the value contains a comma, quote or newline.
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export interface ShopifyExportOptions {
  vendor?: string;
  /** Fall back to the calculated cost when no sale price has been set. */
  priceFallbackToCost?: boolean;
}

export function buildShopifyCsv(
  products: WireProduct[],
  { vendor = "Handmade by Bet", priceFallbackToCost = false }: ShopifyExportOptions = {},
): string {
  const rows = products.map((p) => {
    const price = p.sale_price > 0 ? p.sale_price : priceFallbackToCost ? p.cost : 0;
    const cell: Record<(typeof COLUMNS)[number], string> = {
      Handle: toHandle(p.name),
      Title: p.name,
      "Body (HTML)": "", // internal notes deliberately excluded
      Vendor: vendor,
      Type: "",
      Tags: "",
      Published: "FALSE",
      "Option1 Name": "Title",
      "Option1 Value": "Default Title",
      "Variant SKU": "",
      "Variant Inventory Tracker": "",
      "Variant Inventory Qty": "0",
      "Variant Inventory Policy": "deny",
      "Variant Fulfillment Service": "manual",
      "Variant Price": price.toFixed(2),
      "Variant Requires Shipping": "TRUE",
      "Variant Taxable": "TRUE",
      "Cost per item": p.cost.toFixed(2),
      Status: "draft",
    };
    return COLUMNS.map((c) => escapeCell(cell[c])).join(",");
  });

  return [COLUMNS.join(","), ...rows].join("\r\n");
}

export function downloadShopifyCsv(products: WireProduct[], options?: ShopifyExportOptions) {
  const csv = buildShopifyCsv(products, options);
  // BOM so Excel opens the Spanish material names correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shopify_products_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
