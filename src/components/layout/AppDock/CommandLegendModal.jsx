import React from 'react';
import { Layer, Box, Text, Button } from 'grommet';

export default function CommandLegendModal({ open, actions, onClose }) {
  if (!open) return null;

  return (
    <Layer onEsc={onClose} onClickOutside={onClose}>
      <Box pad="medium" width={{ min: '560px' }} gap="medium">
        <Box direction="row" justify="between" align="center">
          <Text weight={700} size="large">Command Legend</Text>
          <Button label="Close" onClick={onClose} />
        </Box>

        <Box gap="xsmall">
          <Text size="small" color="text-muted">
            Tip: Press Ctrl + / anywhere to open this.
          </Text>
        </Box>

        <Box gap="small">
          {(actions || []).map((a) => (
            <Box
              key={a.id}
              direction="row"
              justify="between"
              pad={{ vertical: 'xsmall' }}
              style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
            >
              <Text weight={600}>{a.label}</Text>
              <Text size="small" color="text-muted">{a.hotkey ? `(${a.hotkey})` : ''}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Layer>
  );
}
