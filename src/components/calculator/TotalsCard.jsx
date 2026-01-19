import React from 'react';
import { Box, Text } from 'grommet';
import SectionCard from '../layout/SectionCard.jsx';
import { money } from '../../utils/ui/formatters.js';

export default function TotalsCard({ totals }) {
  return (
    <SectionCard title="Totals" subtitle="Live totals (materials + labor)">
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
          pad={{ top: 'small' }}
          style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
        >
          <Text weight={700}>Total</Text>
          <Text weight={700}>{money(totals.total)}</Text>
        </Box>
      </Box>
    </SectionCard>
  );
}
