import React, { useMemo } from 'react';
import { Select, Box, Text } from 'grommet';

export default function MaterialPicker({ materials, valueId, onSelect, placeholder = 'Select material' }) {
  const options = useMemo(() => materials || [], [materials]);
  const selected = useMemo(() => options.find((m) => m.id === valueId) || null, [options, valueId]);

  return (
    <Select
      options={options}
      labelKey="name"
      valueKey={{ key: 'id', reduce: true }}
      value={valueId || ''}
      placeholder={placeholder}
      searchable
      onChange={({ option }) => onSelect?.(option)}
      valueLabel={
        selected ? (
          <Text size="small" weight={600}>
            {selected.name}
          </Text>
        ) : (
          <Text size="small" color="text-muted">
            {placeholder}
          </Text>
        )
      }
    >
      {(option) => (
        <Box pad="xsmall" direction="row" gap="xsmall" align="center">
          <Text size="small">{option.name}</Text>
          {String(option.name || '').includes('*') && (
            <Text size="xsmall" color="text-muted">
              (common)
            </Text>
          )}
        </Box>
      )}
    </Select>
  );
}
