import { Box, Text, TextInput } from "grommet";
import SectionCard from "../layout/SectionCard.jsx";
import { toNumber as toNum, round2, money } from "../../utils/ui/formatters.js";

export default function ProfitsCard({
  totalProductCost,
  profitPercent,
  salePrice,
  onChangeProfit,
  onChangeSalePrice,
}) {
  const cost = round2(toNum(totalProductCost));
  const pct = toNum(profitPercent);

  // If salePrice hasn't been set yet (0), derive it from the current profit %
  const storedPrice = toNum(salePrice);
  const displayPrice =
    storedPrice === 0 && cost > 0
      ? round2(cost * (1 + pct / 100))
      : storedPrice;

  const profitAmt = round2(displayPrice - cost);
  const isLoss = cost > 0 && displayPrice > 0 && profitAmt < 0;

  return (
    <SectionCard title="Profits" subtitle="Adjust margin or target price — they stay in sync">
      <Box gap="small">
        <Box direction="row" gap="medium" wrap>
          {/* Profit % — primary input */}
          <Box flex>
            <Text size="small" color="text-muted">
              Profit %
            </Text>
            <TextInput
              type="number"
              value={pct ?? ""}
              placeholder="e.g. 25"
              onChange={(e) => {
                const nextPct = toNum(e.target.value);
                onChangeProfit?.(nextPct);
                // Keep suggested price in sync
                const nextSale =
                  cost > 0 ? round2(cost * (1 + nextPct / 100)) : 0;
                onChangeSalePrice?.(nextSale);
              }}
            />
          </Box>

          {/* Suggested price — reverse-sync back to profit % */}
          <Box flex>
            <Text size="small" color="text-muted">
              Suggested Price
            </Text>
            <TextInput
              type="number"
              value={displayPrice ?? ""}
              placeholder="e.g. 149.99"
              onChange={(e) => {
                const nextSale = round2(toNum(e.target.value));
                onChangeSalePrice?.(nextSale);
                // Derive profit % from the typed price
                const nextPct =
                  cost > 0
                    ? round2(((nextSale - cost) / cost) * 100)
                    : 0;
                onChangeProfit?.(nextPct);
              }}
            />
          </Box>
        </Box>

        {/* Summary strip */}
        <Box
          direction="row"
          justify="between"
          pad={{ top: "xsmall" }}
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <Box>
            <Text size="small" color="text-muted">
              Product Cost
            </Text>
            <Text weight={600}>{money(cost)}</Text>
          </Box>

          <Box align="end">
            <Text size="small" color="text-muted">
              Profit ($)
            </Text>
            <Text
              weight={600}
              color={isLoss ? "status-critical" : "status-ok"}
            >
              {money(profitAmt)}
            </Text>
          </Box>
        </Box>
      </Box>
    </SectionCard>
  );
}
