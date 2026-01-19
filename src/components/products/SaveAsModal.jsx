import React, { useEffect, useState } from 'react';
import { Layer, Box, Text, Button, TextInput } from 'grommet';

export default function SaveAsModal({ open, initialName, onClose, onSave }) {
  const [name, setName] = useState(initialName || '');

  useEffect(() => {
    if (open) setName(initialName || '');
  }, [open, initialName]);

  if (!open) return null;

  return (
    <Layer onEsc={onClose} onClickOutside={onClose}>
      <Box pad="medium" width={{ min: '480px' }} gap="medium">
        <Text weight={700} size="large">Save Product</Text>

        <Box gap="xsmall">
          <Text size="small" color="text-muted">Product name</Text>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Roof Panel v1" />
        </Box>

        <Box direction="row" gap="small" justify="end">
          <Button label="Cancel" onClick={onClose} />
          <Button
            primary
            label="Save"
            disabled={!name.trim()}
            onClick={async () => {
              await onSave?.(name.trim());
            }}
          />
        </Box>
      </Box>
    </Layer>
  );
}
