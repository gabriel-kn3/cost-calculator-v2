import React from 'react';
import { Box, Text, TextInput } from 'grommet';
import SectionCard from '../layout/SectionCard.jsx';

export default function WorkedHoursCard({ workedHours, laborRate, onChangeWorkedHours, onChangeLaborRate }) {
  return (
    <SectionCard
      title="Labor"
      subtitle="Optional add-on: worked hours and labor rate"
    >
      <Box direction="row" gap="medium" wrap>
        <Box width="200px">
          <Text size="small" color="text-muted">Worked Hours</Text>
          <TextInput
            type="number"
            value={workedHours}
            onChange={(e) => onChangeWorkedHours?.(e.target.value)}
          />
        </Box>
        <Box width="200px">
          <Text size="small" color="text-muted">Labor Rate (per hour)</Text>
          <TextInput
            type="number"
            value={laborRate}
            onChange={(e) => onChangeLaborRate?.(e.target.value)}
          />
        </Box>
      </Box>
    </SectionCard>
  );
}
