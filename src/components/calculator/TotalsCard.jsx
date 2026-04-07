import { Box, Text } from "grommet";
import SectionCard from "../layout/SectionCard.jsx";
import { money } from "../../utils/ui/formatters.js";

export default function TotalsCard({ totals, taxPercent }) {
  console.log("Totals object=> ", totals);
  return (
    <SectionCard title="Totals" subtitle="Costos del producto sin profit**">
      <Box gap="xsmall">
        <Box direction="row" justify="between">
          <Text color="text-muted">Materials</Text>
          <Text weight={600}>{money(totals.materials)}</Text>
        </Box>
        <Box direction="row" justify="between">
          <Text color="text-muted">Labor</Text>
          <Text weight={600}>{money(totals.labor)}</Text>
        </Box>
        <Box
          direction="row"
          justify="between"
          pad={{ top: "small" }}
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <Text weight={700}>Sub-Total</Text>
          <Text weight={700}>{money(totals.subTotal)}</Text>
        </Box>
        <Box direction="row" justify="between">
          <Text weight={700}>Product Fees</Text>
          <Text weight={700}>{money(totals.productFees)}</Text>
        </Box>
        <Box direction="row" justify="between">
          <Text weight={700}>Tax {`(${taxPercent}%)`}</Text>
          <Text weight={700}>{money(totals.tax)}</Text>
        </Box>
        <Box direction="row" justify="between">
          <Text weight={700}>Total</Text>
          <Text weight={700}>
            <u> {money(totals.total)}</u>
          </Text>
        </Box>
      </Box>
    </SectionCard>
  );
}
