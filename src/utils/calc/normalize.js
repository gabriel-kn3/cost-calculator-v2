import { toNumber } from '../ui/formatters.js';

export function safeDiv(a, b, fallback = 0) {
  const x = toNumber(a, 0);
  const y = toNumber(b, 0);
  if (y === 0) return fallback;
  return x / y;
}

export function roundMoney(n) {
  const x = toNumber(n, 0);
  return Math.round(x * 100) / 100;
}
