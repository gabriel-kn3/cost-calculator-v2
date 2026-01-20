import React from "react";
import { Box } from "grommet";

export default function Toolbar({ left, right }) {
  return (
    <Box
      direction="row"
      align="center"
      justify="between"
      gap="medium"
      wrap
      margin={{ bottom: "medium" }}
    >
      <Box direction="row" align="center" gap="small" wrap>
        {left}
      </Box>
      <Box direction="row" align="center" gap="small" wrap>
        {right}
      </Box>
    </Box>
  );
}
