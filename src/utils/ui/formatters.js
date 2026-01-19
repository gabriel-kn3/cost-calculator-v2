export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

export function money(n, currency = '$') {
  const x = toNumber(n, 0);
  return `${currency}${x.toFixed(2)}`;
}

export function qty(n, decimals = 4) {
  const x = toNumber(n, 0);
  return x.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.[0-9]*?)0+$/, '$1');
}
