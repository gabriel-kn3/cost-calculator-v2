import { Box, Text, TextInput } from "grommet";
import SectionCard from "../layout/SectionCard.jsx";
import { toNumber as toNum, round2, money } from "../../utils/ui/formatters.js";

export default function ProfitsCard({
  profitPercent,
  salePrice,
  // onChangeProfit,
  // onChangeSalePrice,
  // totalProdCost,
}) {
  // const cost = round2(toNum(totalProdCost));
  // const pct = toNum(profitPercent);
  // const price = round2(toNum(salePrice));

  // // Derived values for insight
  // const computedSaleFromPct = cost > 0 ? round2(cost * (1 + pct / 100)) : 0;
  // const computedPctFromSale =
  //   cost > 0 ? round2(((price - cost) / cost) * 100) : 0;

  // const profitDollars = round2(price - cost);
  // const isLoss = cost > 0 && price > 0 && profitDollars < 0;

  return (
    <SectionCard
      title="Profits"
      subtitle="Precio Sugerido con profit añadido**"
    >
      <Box gap="small">
        <Box direction="row" gap="medium" wrap>
          <Box flex>
            <Text size="small" color="text-muted">
              Example Profit:
            </Text>
            <Text weight={"bold"}>
              <u> {`${profitPercent}%`}</u>
            </Text>
            {/* <TextInput
              value={profitPercent ?? ""}
              placeholder="e.g. 25"
              onChange={(e) => {
                const nextPct = toNum(e.target.value);
                onChangeProfit?.(nextPct);

                // Keep in sync: sale price derived from cost + %
                const nextSale =
                  cost > 0 ? round2(cost * (1 + nextPct / 100)) : 0;
                onChangeSalePrice?.(nextSale);
              }}
            /> */}
          </Box>

          <Box flex>
            <Text size="small" color="text-muted">
              Suggested Price:
            </Text>
            <Text weight={"bold"} color={"status-ok"}>
              <u>{money(salePrice * (1 + profitPercent / 100))}</u>
            </Text>
            {/* <TextInput
              value={salePrice ?? ""}
              placeholder="e.g. 149.99"
              onChange={(e) => {
                const nextSale = round2(toNum(e.target.value));
                onChangeSalePrice?.(nextSale);

                // Keep in sync: profit % derived from sale vs cost
                const nextPct =
                  cost > 0 ? round2(((nextSale - cost) / cost) * 100) : 0;
                onChangeProfit?.(nextPct);
              }}
            /> */}
          </Box>
        </Box>

        {/* <Box
          direction="row"
          justify="between"
          wrap
          pad={{ vertical: "xsmall" }}
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <Box>
            <Text size="small" color="text-muted">
              Total Product Cost
            </Text>
            <Text weight={600}>${round2(cost).toFixed(2)}</Text>
          </Box>

          <Box>
            <Text size="small" color="text-muted">
              Profit ($)
            </Text>
            <Text weight={600} color={isLoss ? "status-critical" : undefined}>
              ${round2(profitDollars).toFixed(2)}
            </Text>
          </Box>

          <Box>
            <Text size="small" color="text-muted">
              Current Profit %
            </Text>
            <Text weight={600} color={isLoss ? "status-critical" : undefined}>
              {cost > 0 ? `${computedPctFromSale.toFixed(2)}%` : "—"}
            </Text>
          </Box>
        </Box>

        <Box>
          <Text size="small" color="text-muted">
            Suggestion from Profit %
          </Text>
          <Text>
            {cost > 0
              ? `At ${pct.toFixed(
                  2
                )}% profit, suggested sale price is $${computedSaleFromPct.toFixed(
                  2
                )}.`
              : "Add line-items to compute total cost, then set profit."}
          </Text>
        </Box> */}
      </Box>
    </SectionCard>
  );
}
