import { describe, it, expect } from "vitest";
import { splitHours, joinHours, formatDuration } from "../shared/duration.js";
import { laborCost } from "../shared/costMath.js";

// Every worked_hours value present in the operator's live database (Oct 2026).
const LIVE_VALUES = [0.2, 0.25, 0.3, 0.5, 0.75, 1, 1.25];

describe("splitHours", () => {
  it.each([
    [0.2, 0, 12],
    [0.25, 0, 15],
    [0.3, 0, 18],
    [0.5, 0, 30],
    [0.75, 0, 45],
    [1, 1, 0],
    [1.25, 1, 15],
  ])("%s hours -> %sh %sm", (decimal, h, m) => {
    expect(splitHours(decimal)).toEqual({ hours: h, minutes: m });
  });

  it("carries 60 rounded minutes into the next hour", () => {
    expect(splitHours(0.9999)).toEqual({ hours: 1, minutes: 0 });
  });

  it("accepts the strings the draft stores", () => {
    expect(splitHours("1.25")).toEqual({ hours: 1, minutes: 15 });
    expect(splitHours("")).toEqual({ hours: 0, minutes: 0 });
  });
});

describe("joinHours", () => {
  it("lets minutes past 59 carry naturally", () => {
    expect(joinHours(0, 90)).toBe(1.5);
  });

  it("treats blank fields as zero while the user is typing", () => {
    expect(joinHours("", "15")).toBe(0.25);
    expect(joinHours("2", "")).toBe(2);
  });
});

describe("round trip on live data", () => {
  it.each(LIVE_VALUES)("%s survives split -> join exactly", (value) => {
    const { hours, minutes } = splitHours(value);
    expect(joinHours(hours, minutes)).toBe(value);
  });

  it.each(LIVE_VALUES)("labour cost for %s is unchanged by the new input", (value) => {
    // The point: entering the same time through hours + minutes must produce
    // the identical labour figure the frozen math produced from the decimal.
    const { hours, minutes } = splitHours(value);
    expect(laborCost(joinHours(hours, minutes), 12)).toBe(laborCost(value, 12));
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0 min"],
    [0.25, "15 min"],
    [1, "1h"],
    [1.25, "1h 15m"],
    [2.5, "2h 30m"],
  ])("%s -> %s", (value, label) => {
    expect(formatDuration(value)).toBe(label);
  });
});
