import React, { useMemo, useState } from 'react';
import { Layer, Box, Text, Button, Spinner } from 'grommet';

import Dropzone from './Dropzone.jsx';
import { importJSON } from '../../utils/io/ioAdapters.js';

function kindTitle(kind) {
  if (kind === 'materials') return 'Materials';
  if (kind === 'products') return 'Products';
  if (kind === 'calculation') return 'Draft Calculation';
  return kind;
}

export default function ImportExportModal({ open, kind, mode, onClose, onComplete }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [parsedPreview, setParsedPreview] = useState(null);
  const title = useMemo(() => `${mode === 'import' ? 'Import' : 'Export'} ${kindTitle(kind)}`, [mode, kind]);

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setParsedPreview(null);
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose?.();
  };

  const handleImportParse = async (f) => {
    setFile(f);
    setBusy(true);
    try {
      const data = await importJSON({ kind, file: f });
      const count = Array.isArray(data) ? data.length : typeof data === 'object' ? Object.keys(data).length : 1;
      setParsedPreview({ data, count });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layer onEsc={close} onClickOutside={close}>
      <Box pad="medium" width={{ min: '520px', max: '720px' }} gap="medium">
        <Box direction="row" justify="between" align="center">
          <Text weight={700} size="large">
            {title}
          </Text>
          <Button label="Close" onClick={close} />
        </Box>

        {mode === 'export' && (
          <Box gap="small">
            <Text color="text-muted" size="small">
              This will export a JSON file you can re-import later.
            </Text>
            <Box direction="row" gap="small" justify="end">
              <Button
                primary
                label="Export JSON"
                onClick={async () => {
                  await onComplete?.({ kind, mode });
                  close();
                }}
              />
            </Box>
          </Box>
        )}

        {mode === 'import' && (
          <Box gap="small">
            <Text color="text-muted" size="small">
              Drop a JSON export file here.
            </Text>

            <Dropzone
              accept={["application/json", ".json"]}
              onFile={handleImportParse}
              label={file ? file.name : 'Drop JSON here or choose a file'}
            />

            {busy && (
              <Box direction="row" gap="small" align="center">
                <Spinner />
                <Text size="small">Reading file...</Text>
              </Box>
            )}

            {parsedPreview && (
              <Box
                pad="small"
                round="small"
                background="app-bg"
                style={{ border: '1px solid rgba(0,0,0,0.06)' }}
                gap="xsmall"
              >
                <Text size="small" weight={600}>
                  Parsed OK
                </Text>
                <Text size="small" color="text-muted">
                  Items detected: {parsedPreview.count}
                </Text>
              </Box>
            )}

            <Box direction="row" gap="small" justify="end">
              <Button label="Cancel" onClick={close} />
              <Button
                primary
                disabled={!parsedPreview || busy}
                label="Import"
                onClick={async () => {
                  await onComplete?.({ kind, mode, imported: parsedPreview.data });
                  close();
                }}
              />
            </Box>
          </Box>
        )}
      </Box>
    </Layer>
  );
}
