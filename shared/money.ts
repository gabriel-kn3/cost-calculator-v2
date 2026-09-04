/**
 * FROZEN SEMANTICS -- do not "improve" anything in this file.
 *
 * Ported 1:1 from the v2 app:
 *   src/utils/ui/formatters.js   (toNumber, round2, money, qty)
 *   src/utils/calc/normalize.js  (safeDiv, roundMoney)
 *
 * Every quirk below is deliberate and pinned by tests/characterization.
 * The operator is trained on these numbers; a "fix" here is a silent repricing
 * of her catalogue. If you believe something is wrong, raise it -- don't change it.
 */

/** Coerces to a finite number, stripping thousands separators. Falls back on junk. */
export function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n =
    typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * QUIRK (pinned): uses Number(), NOT toNumber(). So round2("1,000") is NaN
 * while roundMoney("1,000") is 1000. It also applies an EPSILON nudge, which
 * only changes results at .5 boundaries (the classic 1.005 case).
 * Used exclusively by the Profits card. Do not merge with roundMoney().
 */
export function round2(n: unknown): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** The money rounder used by totalCost(). toNumber-based, no EPSILON nudge. */
export function roundMoney(n: unknown): number {
  const x = toNumber(n, 0);
  return Math.round(x * 100) / 100;
}

/** QUIRK (pinned): a zero divisor yields the fallback, never Infinity/NaN. */
export function safeDiv(a: unknown, b: unknown, fallback = 0): number {
  const x = toNumber(a, 0);
  const y = toNumber(b, 0);
  if (y === 0) return fallback;
  return x / y;
}

/** Display only. */
export function money(n: unknown, currency = "$"): string {
  const x = toNumber(n, 0);
  return `${currency}${x.toFixed(2)}`;
}

/** Display only: fixed decimals with trailing zeros trimmed. */
export function qty(n: unknown, decimals = 4): string {
  const x = toNumber(n, 0);
  return x
    .toFixed(decimals)
    .replace(/\.0+$/, "")
    .replace(/(\.[0-9]*?)0+$/, "$1");
}
