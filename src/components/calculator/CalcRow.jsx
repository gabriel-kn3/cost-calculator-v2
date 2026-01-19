import React, { memo, useMemo } from "react";
import { Box, Button, TextInput, Text } from "grommet";

import MaterialPicker from "./MaterialPicker.jsx";
import { unitCost, lineCost } from "../../utils/calc/costMath.js";
import { money } from "../../utils/ui/formatters.js";

function NumInput({ value, onChange, width = "120px" }) {
  return (
    <Box width={width}>
      <TextInput
        type="number"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </Box>
  );
}

function CalcRowImpl({ row, materials, onPatch, onRemove, onMaterialChange }) {
  const unit = useMemo(
    () => unitCost(row.base_cost, row.base_qty),
    [row.base_cost, row.base_qty]
  );
  const cost = useMemo(() => lineCost(row), [row]);

  return (
    <Box
      direction="row"
      gap="small"
      align="center"
      pad={{ vertical: "xsmall" }}
      wrap={false}
      flex={false}
      style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}
    >
      <Box flex basis="280px">
        <MaterialPicker
          materials={materials}
          valueId={row.materialId}
          onSelect={(m) => onMaterialChange?.(row.rowId, m)}
        />
      </Box>

      <NumInput
        value={row.base_cost}
        onChange={(v) => onPatch?.(row.rowId, { base_cost: v })}
        width="140px"
      />
      <NumInput
        value={row.base_qty}
        onChange={(v) => onPatch?.(row.rowId, { base_qty: v })}
        width="140px"
      />
      <NumInput
        value={row.used_qty}
        onChange={(v) => onPatch?.(row.rowId, { used_qty: v })}
        width="140px"
      />

      <Box width="120px" align="end">
        <Text size="small" color="text-muted">
          {money(unit)} / u
        </Text>
      </Box>

      <Box width="120px" align="end">
        <Text weight={600}>{money(cost)}</Text>
      </Box>

      {/* reserved width so it never collapses */}
      <Box width="100px" align="end">
        <Button label="Remove" onClick={() => onRemove?.(row.rowId)} />
      </Box>
    </Box>
  );
}

export default memo(CalcRowImpl);
