import React, { useCallback } from 'react';
import { Box, FileInput, Text } from 'grommet';

export default function Dropzone({ accept, onFile, label = 'Drop file here' }) {
  const onChange = useCallback(
    (event) => {
      const f = event?.target?.files?.[0];
      if (f) onFile?.(f);
    },
    [onFile]
  );

  return (
    <Box
      pad="medium"
      round="medium"
      background="card-bg"
      style={{ border: '1px dashed rgba(0,0,0,0.18)' }}
      gap="small"
    >
      <Text size="small" color="text-muted">
        {label}
      </Text>
      <FileInput onChange={onChange} accept={accept} />
    </Box>
  );
}
