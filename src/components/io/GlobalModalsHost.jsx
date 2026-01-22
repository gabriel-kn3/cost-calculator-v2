import React from "react";

import { useApp } from "../../hooks/app/AppProvider.jsx";
import { useMaterials } from "../../hooks/materials/MaterialsProvider.jsx";
import { useProducts } from "../../hooks/products/ProductsProvider.jsx";
import { useCalculation } from "../../hooks/calculation/CalculationProvider.jsx";

import ImportExportModal from "./ImportExportModal.jsx";
import MaterialFormModal from "../inventory/MaterialFormModal.jsx";
import SaveAsModal from "../products/SaveAsModal.jsx";

export default function GlobalModalsHost() {
  const app = useApp();
  const materials = useMaterials();
  const products = useProducts();
  const calc = useCalculation();

  const modal = app.state.modal;

  const materialModalOpen =
    modal.open &&
    (modal.type === "add_material" || modal.type === "edit_material");

  return (
    <>
      <ImportExportModal
        open={app.state.io.open}
        kind={app.state.io.kind}
        mode={app.state.io.mode}
        onClose={app.closeIO}
        onComplete={app.onIOComplete}
      />

      <MaterialFormModal
        open={materialModalOpen}
        initialMaterial={modal.data}
        onClose={app.closeModal}
        onSave={async (payload) => {
          await materials.save(payload);
          app.toast("Material saved.", "ok");
          app.closeModal();
        }}
      />

      <SaveAsModal
        open={modal.open && modal.type === "save_product"}
        initialName={calc.state.name}
        onClose={app.closeModal}
        onSave={async (name) => {
          const payload = calc.toProductPayload();
          const saved = await products.save({ ...payload, name });
          app.toast(`Saved product: ${saved.name}`, "ok");
          app.closeModal();
        }}
      />
    </>
  );
}
