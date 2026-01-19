import React, { useMemo } from 'react';
import { Box, Button, DataTable, Text } from 'grommet';

import { money, qty } from '../../utils/ui/formatters.js';

export default function MaterialTable({ items, onEdit, onDelete }) {
  const columns = useMemo(
    () => [
      {
        property: 'name',
        header: 'Name',
        primary: true,
        render: (d) => (
          <Box direction="row" gap="xsmall" align="center">
            <Text weight={600}>{d.name}</Text>
            {String(d.name || '').includes('*') && (
              <Text size="small" color="text-muted">
                (common)
              </Text>
            )}
          </Box>
        )
      },
      {
        property: 'base_cost',
        header: 'Base Cost',
        align: 'end',
        render: (d) => <Text>{money(d.base_cost)}</Text>
      },
      {
        property: 'base_qty',
        header: 'Base Qty',
        align: 'end',
        render: (d) => <Text>{qty(d.base_qty)}</Text>
      },
      {
        property: 'supplier',
        header: 'Supplier',
        render: (d) => <Text size="small" color="text-muted">{d.supplier || '-'}</Text>
      },
      {
        property: 'active',
        header: 'Status',
        render: (d) => (
          <Text size="small" color={d.active ? 'status-ok' : 'text-muted'}>
            {d.active ? 'Active' : 'Disabled'}
          </Text>
        )
      },
      {
        property: 'actions',
        header: '',
        render: (d) => (
          <Box direction="row" gap="xsmall" justify="end">
            <Button size="small" label="Edit" onClick={() => onEdit?.(d)} />
            <Button size="small" label="Delete" onClick={() => onDelete?.(d)} />
          </Box>
        )
      }
    ],
    [onEdit, onDelete]
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      sortable
      resizable
      step={14}
    />
  );
}
