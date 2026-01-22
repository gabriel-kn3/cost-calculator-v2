import React, { useEffect } from "react";
import { Box } from "grommet";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import AppHeader from "./AppHeader.jsx";
import AppDock from "./AppDock/AppDock.jsx";
import ChatBubbleButton from "./ChatBubble/ChatBubbleButton.jsx";
import GlobalModalsHost from "../io/GlobalModalsHost.jsx";
import Toasts from "../feedback/Toasts.jsx";

import { useApp } from "../../hooks/app/AppProvider.jsx";
import { useMaterials } from "../../hooks/materials/MaterialsProvider.jsx";
import { useProducts } from "../../hooks/products/ProductsProvider.jsx";
import { useCalculation } from "../../hooks/calculation/CalculationProvider.jsx";
import { exportJSON, IO_KINDS } from "../../utils/io/ioAdapters.js";

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();

  const app = useApp();
  const materials = useMaterials();
  const products = useProducts();
  const calc = useCalculation();

  // console.debug("App Shell => Materials => ", materials);
  // console.debug("App shell => Products => ", products);

  useEffect(() => {
    const path = location.pathname;

    const actions = [];

    if (path.startsWith("/inventory")) {
      actions.push(
        {
          id: "add_material",
          label: "Add Material",
          hotkey: "A",
          onClick: () => app.openModal("add_material"),
        },
        {
          id: "import_materials",
          label: "Import",
          hotkey: "I",
          onClick: () =>
            app.openIO({
              kind: IO_KINDS.MATERIALS,
              mode: "import",
              onComplete: async ({ imported }) => {
                await materials.replaceAll(imported);
                app.toast(`Imported ${imported.length} materials.`, "ok");
              },
            }),
        },
        {
          id: "export_materials",
          label: "Export",
          hotkey: "E",
          onClick: () =>
            app.openIO({
              kind: IO_KINDS.MATERIALS,
              mode: "export",
              onComplete: async () => {
                exportJSON({
                  kind: IO_KINDS.MATERIALS,
                  data: materials.materials,
                });
                app.toast("Exported materials JSON.", "ok");
              },
            }),
        }
      );
    } else if (path.startsWith("/calculator")) {
      actions.push(
        {
          id: "add_common",
          label: "Add Common (*)",
          hotkey: "C",
          onClick: () => {
            calc.addCommonMaterials(materials.commonMaterials);
            app.toast("Added common materials.", "ok");
          },
        },
        {
          id: "save_product",
          label: "Save Product",
          hotkey: "S",
          onClick: () => app.openModal("save_product"),
        },
        {
          id: "export_calc",
          label: "Export Draft",
          hotkey: "E",
          onClick: () =>
            app.openIO({
              kind: IO_KINDS.CALCULATION,
              mode: "export",
              onComplete: async () => {
                exportJSON({ kind: IO_KINDS.CALCULATION, data: calc.state });
                app.toast("Exported draft JSON.", "ok");
              },
            }),
        }
      );
    } else if (path.startsWith("/products")) {
      actions.push(
        {
          id: "to_calculator",
          label: "New Draft",
          hotkey: "N",
          onClick: () => navigate("/calculator"),
        },
        {
          id: "import_products",
          label: "Import",
          hotkey: "I",
          onClick: () =>
            app.openIO({
              kind: IO_KINDS.PRODUCTS,
              mode: "import",
              onComplete: async ({ imported }) => {
                await products.replaceAll(imported);
                app.toast(`Imported ${imported.length} products.`, "ok");
              },
            }),
        },
        {
          id: "export_products",
          label: "Export",
          hotkey: "E",
          onClick: () =>
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
            }),
        }
      );
    } else {
      actions.push(
        {
          id: "go_inventory",
          label: "Inventory",
          hotkey: "1",
          onClick: () => navigate("/inventory"),
        },
        {
          id: "go_calc",
          label: "Calculator",
          hotkey: "2",
          onClick: () => navigate("/calculator"),
        },
        {
          id: "go_products",
          label: "Products",
          hotkey: "3",
          onClick: () => navigate("/products"),
        }
      );
    }

    app.setDockActions(actions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, materials.materials.length, products.products.length]);

  return (
    <Box fill background="app-bg" style={{ minHeight: "100vh" }}>
      {/* global css vars for subtle borders */}
      <style>{`:root{--border-color: rgba(0,0,0,0.06);}`}</style>

      <AppHeader />

      <Box flex overflow="auto">
        <Outlet />
      </Box>

      <GlobalModalsHost />
      <Toasts />

      <ChatBubbleButton />
      <AppDock />

      {/* tiny padding so content never hides behind dock */}
      {/* <Box height="86px" /> */}
    </Box>
  );
}
