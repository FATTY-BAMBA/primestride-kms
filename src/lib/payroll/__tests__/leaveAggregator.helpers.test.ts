import { describe, it, expect } from "vitest";
import {
  periodBoundaries,
  daysBetween,
  apportionDaysToFiscalYear,
} from "../leaveAggregator";

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

// ── apportionDaysToFiscalYear (Phase 3b.5 Step 5 — Gap #4 fix) ──────

describe("apportionDaysToFiscalYear", () => {
  it("returns full claim when leave entirely within fiscal year", () => {
    // 2026-03-09 (Mon) to 2026-03-09 (single day)
    const result = apportionDaysToFiscalYear(
      new Date("2026-03-09T00:00:00Z"),
      new Date("2026-03-09T00:00:00Z"),
      1,
      2026,
    );
    expect(result.apportionedDays).toBe(1);
    expect(result.splitForYearBoundary).toBe(false);
  });

  it("returns 0 when leave entirely in a different year", () => {
    // 2025-03-09 leave, asking about fiscal 2026 → no overlap
    const result = apportionDaysToFiscalYear(
      new Date("2025-03-09T00:00:00Z"),
      new Date("2025-03-09T00:00:00Z"),
      1,
      2026,
    );
    expect(result.apportionedDays).toBe(0);
    expect(result.splitForYearBoundary).toBe(false);
  });

  it("apportions year-spanning leave correctly to current year", () => {
    // Dec 28 2025 to Jan 5 2026 = 9 calendar days
    // 4 days in 2025 (Dec 28, 29, 30, 31)
    // 5 days in 2026 (Jan 1, 2, 3, 4, 5)
    const result = apportionDaysToFiscalYear(
      new Date("2025-12-28T00:00:00Z"),
      new Date("2026-01-05T00:00:00Z"),
      9,
      2026,
    );
    expect(result.apportionedDays).toBe(5);
    expect(result.splitForYearBoundary).toBe(true);
  });

  it("apportions year-spanning leave correctly to prior year", () => {
    // Same leave Dec 28 2025 to Jan 5 2026, but asking about 2025
    const result = apportionDaysToFiscalYear(
      new Date("2025-12-28T00:00:00Z"),
      new Date("2026-01-05T00:00:00Z"),
      9,
      2025,
    );
    expect(result.apportionedDays).toBe(4);
    expect(result.splitForYearBoundary).toBe(true);
  });

  it("two halves sum to the total daysClaimed", () => {
    // Verify mathematical invariant for whole-day leaves
    const start = new Date("2025-12-28T00:00:00Z");
    const end = new Date("2026-01-05T00:00:00Z");
    const total = 9;
    const r2025 = apportionDaysToFiscalYear(start, end, total, 2025);
    const r2026 = apportionDaysToFiscalYear(start, end, total, 2026);
    expect(r2025.apportionedDays + r2026.apportionedDays).toBe(total);
  });

  it("handles single-day leave on Dec 31 (last day of year)", () => {
    const result = apportionDaysToFiscalYear(
      new Date("2025-12-31T00:00:00Z"),
      new Date("2025-12-31T00:00:00Z"),
      1,
      2025,
    );
    expect(result.apportionedDays).toBe(1);
    expect(result.splitForYearBoundary).toBe(false);
  });

  it("handles single-day leave on Jan 1 (first day of year)", () => {
    const result = apportionDaysToFiscalYear(
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-01-01T00:00:00Z"),
      1,
      2026,
    );
    expect(result.apportionedDays).toBe(1);
    expect(result.splitForYearBoundary).toBe(false);
  });

  it("handles leave Dec 31 to Jan 1 (2-day spans years)", () => {
    // Dec 31 2025 to Jan 1 2026 = 2 days, 1 in each year
    const r2025 = apportionDaysToFiscalYear(
      new Date("2025-12-31T00:00:00Z"),
      new Date("2026-01-01T00:00:00Z"),
      2,
      2025,
    );
    const r2026 = apportionDaysToFiscalYear(
      new Date("2025-12-31T00:00:00Z"),
      new Date("2026-01-01T00:00:00Z"),
      2,
      2026,
    );
    expect(r2025.apportionedDays).toBe(1);
    expect(r2025.splitForYearBoundary).toBe(true);
    expect(r2026.apportionedDays).toBe(1);
    expect(r2026.splitForYearBoundary).toBe(true);
  });

  it("apportions half-day leave proportionally", () => {
    // 0.5 days claimed across 1 calendar day, leave is 2025-12-31
    const result = apportionDaysToFiscalYear(
      new Date("2025-12-31T00:00:00Z"),
      new Date("2025-12-31T00:00:00Z"),
      0.5,
      2025,
    );
    expect(result.apportionedDays).toBe(0.5);
    expect(result.splitForYearBoundary).toBe(false);
  });

  it("returns correct fiscal year boundary dates", () => {
    const result = apportionDaysToFiscalYear(
      new Date("2026-03-09T00:00:00Z"),
      new Date("2026-03-09T00:00:00Z"),
      1,
      2026,
    );
    expect(result.fiscalYearStart.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(result.fiscalYearEnd.toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });

  it("handles a leave spanning multiple years (rare extreme case)", () => {
    // Dec 28 2024 to Jan 5 2026 — spans all of 2025
    // 4 days in 2024, 365 days in 2025, 5 days in 2026
    // (2025 not leap, so all of 2025 = 365 days)
    const total = 4 + 365 + 5; // 374
    const r2025 = apportionDaysToFiscalYear(
      new Date("2024-12-28T00:00:00Z"),
      new Date("2026-01-05T00:00:00Z"),
      total,
      2025,
    );
    expect(r2025.apportionedDays).toBe(365);
    expect(r2025.splitForYearBoundary).toBe(true);
  });
});
