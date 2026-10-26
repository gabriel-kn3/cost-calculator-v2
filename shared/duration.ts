/**
 * Worked time as hours + minutes.
 *
 * STORAGE IS UNCHANGED: products.worked_hours stays decimal hours, so the
 * frozen labour math (laborCost = hours * rate) and every saved product are
 * untouched. These helpers only translate at the edge of the UI.
 *
 * Real data motivated this: the operator was typing 0.2, 0.3 and 0.75 --
 * mentally converting 12, 18 and 45 minutes into decimals.
 */
import { toNumber } from "./money.js";

export interface HoursMinutes {
  hours: number;
  minutes: number;
}

/** Decimal hours -> whole hours + whole minutes. 0.25 -> 0h 15m. */
export function splitHours(decimalHours: unknown): HoursMinutes {
  const total = Math.max(0, toNumber(decimalHours, 0));
  let hours = Math.floor(total);
  let minutes = Math.round((total - hours) * 60);
  // 0.9999 rounds to 60 minutes; carry it rather than show "0h 60m".
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }
  return { hours, minutes };
}

/**
 * Hours + minutes -> decimal hours. Minutes may exceed 59 ("90" minutes is a
 * perfectly natural thing to type) and simply carry into hours.
 */
export function joinHours(hours: unknown, minutes: unknown): number {
  return toNumber(hours, 0) + toNumber(minutes, 0) / 60;
}

/** Friendly label: "15 min", "1h", "1h 15m", "0 min". */
export function formatDuration(decimalHours: unknown): string {
  const { hours, minutes } = splitHours(decimalHours);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
