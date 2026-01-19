import React, { useState } from 'react';
import { Box, Button, Layer, Text } from 'grommet';

export default function ChatBubbleButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Box style={{ position: 'fixed', right: 18, bottom: 98, zIndex: 12 }}>
        <Button
          primary
          label="AI"
          onClick={() => setOpen(true)}
          style={{ borderRadius: 999 }}
        />
      </Box>

      {open && (
        <Layer onEsc={() => setOpen(false)} onClickOutside={() => setOpen(false)} position="right" full="vertical">
          <Box pad="medium" width="420px" gap="medium" background="card-bg">
            <Text weight={700} size="large">AI Chat (Placeholder)</Text>
            <Text color="text-muted" size="small">
              This is a placeholder bubble for your future AI-generated calculations. Wire it to your backend later.
            </Text>
            <Box flex align="center" justify="center">
              <Text color="text-muted">Coming soon...</Text>
            </Box>
            <Box direction="row" justify="end">
              <Button label="Close" onClick={() => setOpen(false)} />
            </Box>
          </Box>
        </Layer>
      )}
    </>
  );
}
