import React from "react";
import { Box, Button, Text } from "grommet";

import PageContainer from "../components/layout/PageContainer.jsx";
import Toolbar from "../components/layout/Toolbar.jsx";
import SectionCard from "../components/layout/SectionCard.jsx";
import MaterialTable from "../components/inventory/MaterialTable.jsx";

import { useApp } from "../hooks/app/AppProvider.jsx";
import { useMaterials } from "../hooks/materials/MaterialsProvider.jsx";
import { IO_KINDS, exportJSON } from "../utils/io/ioAdapters.js";

export default function InventoryPage() {
  const app = useApp();
  const materials = useMaterials();

  return (
    <PageContainer>
      <Toolbar
        left={
          <Text size="xxlarge" weight={700}>
            Inventory
          </Text>
        }
        right={
          <Box direction="row" gap="small" wrap>
            <Button label="Add" onClick={() => app.openModal("add_material")} />
            <Button
              label="Import"
              onClick={() =>
                app.openIO({
                  kind: IO_KINDS.MATERIALS,
                  mode: "import",
                  onComplete: async ({ imported }) => {
                    await materials.replaceAll(imported);
                    app.toast(`Imported ${imported.length} materials.`);
                  },
                })
              }
            />
            <Button
              label="Export"
              onClick={() =>
                app.openIO({
                  kind: IO_KINDS.MATERIALS,
                  mode: "export",
                  onComplete: async () => {
                    exportJSON({
                      kind: IO_KINDS.MATERIALS,
                      data: materials.materials,
                    });
                    app.toast("Exported materials JSON.");
                  },
                })
              }
            />
          </Box>
        }
      />

      <SectionCard
        title="Materials"
        subtitle="Base cost & base quantity. Use * in name for common items."
      >
        <MaterialTable
          items={materials.materials}
          onEdit={(m) => app.openModal("edit_material", m)}
          onDelete={async (m) => {
            const ok = window.confirm(`Delete material: ${m.name}?`);
            if (!ok) return;
            const { message } = await materials.remove(m.id);
            app.toast(message, "ok");
          }}
        />
      </SectionCard>
    </PageContainer>
  );
}
