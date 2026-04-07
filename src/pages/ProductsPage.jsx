import React, { useState, useMemo } from "react";
import { Box, Button, Select, Text, TextInput } from "grommet";
import { useNavigate } from "react-router-dom";

import PageContainer from "../components/layout/PageContainer.jsx";
import Toolbar from "../components/layout/Toolbar.jsx";
import ProductsGrid from "../components/products/ProductsGrid.jsx";

import { useApp } from "../hooks/app/AppProvider.jsx";
import { useProducts } from "../hooks/products/ProductsProvider.jsx";
import { useCalculation } from "../hooks/calculation/CalculationProvider.jsx";
import { IO_KINDS, exportJSON } from "../utils/io/ioAdapters.js";

const SORT_OPTIONS = [
  { label: "Newest first", value: "date_desc" },
  { label: "Oldest first", value: "date_asc" },
  { label: "Name A–Z", value: "name_asc" },
  { label: "Name Z–A", value: "name_desc" },
  { label: "Cost: high–low", value: "cost_desc" },
  { label: "Cost: low–high", value: "cost_asc" },
];

export default function ProductsPage() {
  const app = useApp();
  const products = useProducts();
  const calc = useCalculation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("date_desc");

  // Filter by name, then sort
  const displayedProducts = useMemo(() => {
    let result = [...products.products];

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((p) =>
        (p.name || "").toLowerCase().includes(q)
      );
    }

    switch (sort) {
      case "name_asc":
        result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      case "name_desc":
        result.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
        break;
      case "cost_desc":
        result.sort((a, b) => (b.totals?.total ?? 0) - (a.totals?.total ?? 0));
        break;
      case "cost_asc":
        result.sort((a, b) => (a.totals?.total ?? 0) - (b.totals?.total ?? 0));
        break;
      case "date_asc":
        result.sort((a, b) => new Date(a.lastUpdated) - new Date(b.lastUpdated));
        break;
      case "date_desc":
      default:
        result.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
        break;
    }

    return result;
  }, [products.products, search, sort]);

  // Guard against silently wiping an in-progress draft
  const handleLoad = (p) => {
    const isDirty =
      calc.rows.length > 0 ||
      (calc.state.name && calc.state.name !== "Untitled Product");

    if (isDirty) {
      const ok = window.confirm(
        `The calculator has unsaved changes.\nLoad "${p.name}" and discard them?`
      );
      if (!ok) return;
    }

    calc.loadFromProduct(p);
    navigate("/calculator");
    app.toast("Loaded product into calculator.", "ok");
  };

  return (
    <PageContainer>
      <Toolbar
        left={
          <Text size="xxlarge" weight={700}>
            Saved Products ({products.products.length})
          </Text>
        }
        right={
          <Box direction="row" gap="small" wrap>
            <Button
              label="Import"
              onClick={() =>
                app.openIO({
                  kind: IO_KINDS.PRODUCTS,
                  mode: "import",
                  onComplete: async ({ imported }) => {
                    await products.replaceAll(imported);
                    app.toast(`Imported ${imported.length} products.`, "ok");
                  },
                })
              }
            />
            <Button
              label="Export"
              onClick={() =>
                app.openIO({
                  kind: IO_KINDS.PRODUCTS,
                  mode: "export",
                  onComplete: async () => {
                    exportJSON({
                      kind: IO_KINDS.PRODUCTS,
                      data: products.products,
                    });
                    app.toast("Exported products JSON.", "ok");
                  },
                })
              }
            />
          </Box>
        }
      />

      {/* Search + sort bar */}
      <Box direction="row" gap="small" align="center" pad={"small"}>
        <Box >
          <TextInput
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Box>
        <Box width="180px" flex={false}>
          <Select
            options={SORT_OPTIONS}
            labelKey="label"
            valueKey={{ key: "value", reduce: true }}
            value={sort}
            onChange={({ value }) => setSort(value)}
          />
        </Box>
      </Box>

      {/* No-results state when search is active */}
      {displayedProducts.length === 0 && search.trim() ? (
        <Box pad="medium" align="center">
          <Text color="text-muted">No products match &ldquo;{search}&rdquo;.</Text>
        </Box>
      ) : (
        <ProductsGrid
          products={displayedProducts}
          onLoad={handleLoad}
          onDelete={async (p) => {
            const ok = window.confirm(`Delete product: ${p.name}?`);
            if (!ok) return;
            const { message } = await products.remove(p.id);
            app.toast(message, "ok");
          }}
        />
      )}
    </PageContainer>
  );
}
