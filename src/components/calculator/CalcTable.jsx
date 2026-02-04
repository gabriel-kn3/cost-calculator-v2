import { Box, Text, Button } from "grommet";
import CalcRow from "./CalcRow.jsx";

export default function CalcTable({
  rows,
  materials,
  onPatchRow,
  onRemoveRow,
  onMaterialChange,
  onAddEmptyRow,
}) {
  return (
    <Box gap="xsmall">
      {/* toolbar */}
      <Box direction="row" justify="end" align="center">
        <Button label="Add Material" onClick={onAddEmptyRow} />
      </Box>

      {/* horizontal scroll container */}
      <Box style={{ borderRadius: 10 }}>
        {/* baseline width so columns never collapse */}
        <Box style={{ minWidth: 1040 }}>
          {/* header (NO wrap) */}
          <Box
            direction="row"
            gap="small"
            align="center"
            pad={{ vertical: "xsmall" }}
            style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
          >
            <Box flex basis="280px">
              <Text size="small" color="text-muted">
                Material
              </Text>
            </Box>
            <Box width="140px">
              <Text size="small" color="text-muted">
                Base Cost
              </Text>
            </Box>
            <Box width="140px">
              <Text size="small" color="text-muted">
                Base Qty
              </Text>
            </Box>
            <Box width="140px">
              <Text size="small" color="text-muted">
                Used Qty
              </Text>
            </Box>
            <Box width="120px" align="end">
              <Text size="small" color="text-muted">
                Unit
              </Text>
            </Box>
            <Box width="120px" align="end">
              <Text size="small" color="text-muted">
                Line Cost
              </Text>
            </Box>
            <Box width="100px" />
          </Box>

          {/* rows */}
          <Box>
            {rows.map((row) => (
              <CalcRow
                key={row.rowId}
                row={row}
                materials={materials}
                onPatch={onPatchRow}
                onRemove={onRemoveRow}
                onMaterialChange={onMaterialChange}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
