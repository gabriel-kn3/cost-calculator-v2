import { readFileText, downloadText } from './fileUtils.js';

// Shared import/export pipeline for materials + products + draft calculation.
// Future: add XLSX/PDF adapters here without touching UI.

export const IO_KINDS = {
  MATERIALS: 'materials',
  PRODUCTS: 'products',
  CALCULATION: 'calculation'
};

function filenameFor(kind) {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `costcalc_${kind}_${stamp}.json`;
}

export function exportJSON({ kind, data }) {
  const payload = {
    kind,
    version: 1,
    exported_at: new Date().toISOString(),
    data
  };
  downloadText(filenameFor(kind), JSON.stringify(payload, null, 2));
}

export async function importJSON({ kind, file }) {
  const txt = await readFileText(file);
  const parsed = JSON.parse(txt);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON file.');
  }
  if (parsed.kind !== kind) {
    throw new Error(`Wrong file kind. Expected "${kind}" but got "${parsed.kind}".`);
  }
  if (!('data' in parsed)) {
    throw new Error('JSON file missing "data" field.');
  }
  return parsed.data;
}
