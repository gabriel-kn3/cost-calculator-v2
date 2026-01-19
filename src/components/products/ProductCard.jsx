import React from "react";
import { Box, Button, Text } from "grommet";
import SectionCard from "../layout/SectionCard.jsx";
import { money } from "../../utils/ui/formatters.js";

export default function ProductCard({ product, onLoad, onDelete }) {
  const totals = product?.totals || { total: 0 };

  return (
    <SectionCard
      title={product.name || "Unnamed"}
      subtitle={`Updated: ${
        product.lastUpdated
          ? new Date(product.lastUpdated).toLocaleString("en-US", {
              timeZone: "America/New_York",
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "-"
      }`}
      actions={
        <Box direction="row" gap="xsmall">
          <Button size="small" label="Load" onClick={() => onLoad?.(product)} />
          <Button
            size="small"
            label="Delete"
            onClick={() => onDelete?.(product)}
          />
        </Box>
      }
    >
      <Box gap="xsmall">
        <Box direction="row" justify="between">
          <Text color="text-muted">Total</Text>
          <Text weight={700}>{money(totals.total)}</Text>
        </Box>
        <Text size="small" color="text-muted">
          Materials: {(product.rows || []).length} | Worked hours:{" "}
          {product.workedHours ?? 0}
        </Text>
      </Box>
    </SectionCard>
  );
}
