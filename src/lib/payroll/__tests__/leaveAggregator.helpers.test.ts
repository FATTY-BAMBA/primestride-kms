import { describe, it, expect } from "vitest";
import { periodBoundaries, daysBetween } from "../leaveAggregator";

describe("periodBoundaries", () => {
  it("returns April 2026 boundaries", () => {
    const { startDate, endDate } = periodBoundaries(2026, 4);
    expect(startDate.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(endDate.toISOString()).toBe("2026-04-30T00:00:00.000Z");
  });

  it("returns Feb 2024 (leap year) boundaries with 29 days", () => {
    const { startDate, endDate } = periodBoundaries(2024, 2);
    expect(startDate.toISOString()).toBe("2024-02-01T00:00:00.000Z");
    expect(endDate.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("returns Feb 2026 (non-leap) boundaries with 28 days", () => {
    const { startDate, endDate } = periodBoundaries(2026, 2);
    expect(startDate.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(endDate.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("returns December 2026 boundaries with 31 days", () => {
    const { startDate, endDate } = periodBoundaries(2026, 12);
    expect(startDate.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(endDate.toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });

  it("throws on month 0", () => {
    expect(() => periodBoundaries(2026, 0)).toThrow(/Invalid month/);
  });

  it("throws on month 13", () => {
    expect(() => periodBoundaries(2026, 13)).toThrow(/Invalid month/);
  });
});

describe("daysBetween", () => {
  it("returns inclusive day count for April", () => {
    const start = new Date("2026-04-01T00:00:00Z");
    const end = new Date("2026-04-30T00:00:00Z");
    expect(daysBetween(start, end)).toBe(30);
  });

  it("returns 1 for same day", () => {
    const d = new Date("2026-04-15T00:00:00Z");
    expect(daysBetween(d, d)).toBe(1);
  });

  it("handles 1 day apart", () => {
    const start = new Date("2026-04-01T00:00:00Z");
    const end = new Date("2026-04-02T00:00:00Z");
    expect(daysBetween(start, end)).toBe(2);
  });

  it("handles February non-leap", () => {
    const start = new Date("2026-02-01T00:00:00Z");
    const end = new Date("2026-02-28T00:00:00Z");
    expect(daysBetween(start, end)).toBe(28);
  });

  it("handles February leap year", () => {
    const start = new Date("2024-02-01T00:00:00Z");
    const end = new Date("2024-02-29T00:00:00Z");
    expect(daysBetween(start, end)).toBe(29);
  });
});
