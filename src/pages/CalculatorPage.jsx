import { Box, Button, Text, TextInput } from "grommet";

import PageContainer from "../components/layout/PageContainer.jsx";
import Toolbar from "../components/layout/Toolbar.jsx";
import SectionCard from "../components/layout/SectionCard.jsx";
import CalcTable from "../components/calculator/CalcTable.jsx";
import WorkedHoursCard from "../components/calculator/WorkedHoursCard.jsx";
import TotalsCard from "../components/calculator/TotalsCard.jsx";

import { useApp } from "../hooks/app/AppProvider.jsx";
import { useMaterials } from "../hooks/materials/MaterialsProvider.jsx";
import { useCalculation } from "../hooks/calculation/CalculationProvider.jsx";
import { IO_KINDS, exportJSON } from "../utils/io/ioAdapters.js";

export default function CalculatorPage() {
  const app = useApp();
  const materials = useMaterials();
  const calc = useCalculation();

  const onMaterialChange = (rowId, material) => {
    if (!material) return;
    calc.patchRow(rowId, {
      materialId: material.id,
      name: material.name || "Material",
      base_cost: material.base_cost ?? 0,
      base_qty: material.base_qty ?? 1,
    });
  };

  return (
    <PageContainer>
      <Toolbar
        left={
          <Text size="xxlarge" weight={700}>
            Calculator
          </Text>
        }
        right={
          <Box direction="row" gap="small" wrap>
            <Button
              label="Add Common (*)"
              onClick={() => calc.addCommonMaterials(materials.commonMaterials)}
            />
            <Button
              label="Save"
              onClick={() => app.openModal("save_product")}
            />
            <Button
              label="Import Draft"
              onClick={() =>
                app.openIO({
                  kind: IO_KINDS.CALCULATION,
                  mode: "import",
                  onComplete: async ({ imported }) => {
                    calc.loadDraftState(imported);
                    app.toast("Draft imported.");
                  },
                })
              }
            />
            <Button
              label="Export Draft"
              onClick={() =>
                app.openIO({
                  kind: IO_KINDS.CALCULATION,
                  mode: "export",
                  onComplete: async () => {
                    exportJSON({
                      kind: IO_KINDS.CALCULATION,
                      data: calc.state,
                    });
                    app.toast("Draft exported.");
                  },
                })
              }
            />
          </Box>
        }
      />

      <SectionCard
        title="Product Draft"
        subtitle="Name, notes, and line-items"
        cardStyleProps={{
          minHeight: "400px",
        }}
        footer={
          <Box
            direction="row"
            justify="end"
            // margin={{ top: "medium" }}
            pad={{ top: "small" }}
          >
            <Button
              label="Clear Draft"
              onClick={() => {
                const ok = window.confirm("Clear the current draft?");
                if (ok) calc.clearDraft();
              }}
            />
          </Box>
        }
      >
        <Box gap="medium">
          {/* Product Name */}
          <Box gap="xsmall" margin={{ bottom: "small" }}>
            <Text size="small" color="text-muted">
              Product Name
            </Text>
            <TextInput
              value={calc.state.name}
              onChange={(e) => calc.setMeta("name", e.target.value)}
            />
          </Box>

          {/* Notes */}
          <Box gap="xsmall">
            <Text size="small" color="text-muted">
              Notes
            </Text>
            <TextInput
              // rows={3}
              value={calc.state.notes}
              onChange={(e) => calc.setMeta("notes", e.target.value)}
            />
          </Box>

          {/* Table */}
          <CalcTable
            rows={calc.rows}
            materials={materials.materials}
            onPatchRow={calc.patchRow}
            onRemoveRow={calc.removeRow}
            onMaterialChange={onMaterialChange}
            onAddEmptyRow={calc.addEmptyRow}
          />
        </Box>
      </SectionCard>

      <Box direction="row" gap="medium" wrap>
        <Box flex>
          <WorkedHoursCard
            workedHours={calc.state.workedHours}
            laborRate={calc.state.laborRate}
            onChangeWorkedHours={(v) => calc.setMeta("workedHours", v)}
            onChangeLaborRate={(v) => calc.setMeta("laborRate", v)}
          />
        </Box>
        <Box width={{ min: "320px" }} pad={{ bottom: "small" }}>
          <TotalsCard totals={calc.totals} />
        </Box>
      </Box>
    </PageContainer>
  );
}
