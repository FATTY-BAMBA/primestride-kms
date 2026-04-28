// src/lib/payroll/__tests__/payTreatment.test.ts
//
// Tests for payTreatment.applyPayTreatment — the per-leave deduction
// calculator. Covers all 7 PayTreatment kinds with edge cases, plus
// the helper functions computeDailyRate and computeTenureSatisfies.

import { describe, it, expect } from "vitest";
import {
  applyPayTreatment,
  computeDailyRate,
  computeTenureSatisfies,
} from "../payTreatment";
import { leaveOntology, type LeaveTypeDefinition } from "../leaveOntology";
import type { YtdSummary } from "../ytdCaps";
import type { EmployeeProfileSnapshot } from "../leaveAggregator";

// ── Helpers ──────────────────────────────────────────────────────────

function getDef(canonicalKey: string): LeaveTypeDefinition {
  const d = leaveOntology.find((e) => e.canonicalKey === canonicalKey);
  if (!d) throw new Error(`Test setup error: no entry for ${canonicalKey}`);
  return d;
}

function makeEmployee(
  partial: Partial<EmployeeProfileSnapshot> = {},
): EmployeeProfileSnapshot {
  return {
    userId: "test-user",
    fullName: "Test User",
    nationalId: null,
    employeeId: null,
    department: null,
    jobTitle: null,
    salaryBase: 45000, // → daily rate 1500
    salaryCurrency: "TWD",
    laborInsuredSalary: 45000,
    nhiInsuredSalary: 45000,
    pensionContributionWage: 45000,
    voluntaryPensionRate: 0,
    nhiDependents: 0,
    bankCode: null,
    bankAccount: null,
    hireDate: new Date("2024-01-15T00:00:00Z"),
    gender: "female",
    terminationDate: null,
    ...partial,
  };
}

function makeYtd(partial: Partial<YtdSummary> = {}): YtdSummary {
  return {
    byCanonicalKey: {},
    sickHalfPayDaysUsed: 0,
    menstrualSeparateDaysUsed: 0,
    menstrualTotalDaysUsed: 0,
    unclassifiedRecords: [],
    ambiguousRecords: [],
    classifiedRecordCount: 0,
    unclassifiedRecordCount: 0,
    ...partial,
  };
}

// ── Daily rate helper ────────────────────────────────────────────────

describe("computeDailyRate", () => {
  it("returns salary_base / 30 for clean values", () => {
    expect(computeDailyRate(45000)).toBe(1500);
    expect(computeDailyRate(30000)).toBe(1000);
    expect(computeDailyRate(60000)).toBe(2000);
  });

  it("returns float for non-clean divisions", () => {
    expect(computeDailyRate(35000)).toBeCloseTo(1166.6666, 3);
    expect(computeDailyRate(50000)).toBeCloseTo(1666.6666, 3);
  });
});

// ── Tenure helper ────────────────────────────────────────────────────

describe("computeTenureSatisfies", () => {
  it("exactly 6 months: hire 2024-01-15, leave 2024-07-15 → satisfies", () => {
    const hire = new Date("2024-01-15T00:00:00Z");
    const leave = new Date("2024-07-15T00:00:00Z");
    expect(computeTenureSatisfies(hire, leave, 6)).toBe(true);
  });

  it("one day short: hire 2024-01-15, leave 2024-07-14 → does not satisfy", () => {
    const hire = new Date("2024-01-15T00:00:00Z");
    const leave = new Date("2024-07-14T00:00:00Z");
    expect(computeTenureSatisfies(hire, leave, 6)).toBe(false);
  });

  it("one day past: hire 2024-01-15, leave 2024-07-16 → satisfies", () => {
    const hire = new Date("2024-01-15T00:00:00Z");
    const leave = new Date("2024-07-16T00:00:00Z");
    expect(computeTenureSatisfies(hire, leave, 6)).toBe(true);
  });

  it("hired 2024-01-31 → 6mo threshold normalizes to 2024-07-31", () => {
    const hire = new Date("2024-01-31T00:00:00Z");
    expect(
      computeTenureSatisfies(hire, new Date("2024-07-31T00:00:00Z"), 6),
    ).toBe(true);
    expect(
      computeTenureSatisfies(hire, new Date("2024-07-30T00:00:00Z"), 6),
    ).toBe(false);
  });

  it("hired 2024-08-31 → 6mo threshold (Feb has 28-29 days) overflow handling", () => {
    // hire month is August = 7 (0-indexed); +6 months = 13 = February next year
    // Day 31 overflows Feb (28 days in 2025) by 3 days → March 3, 2025
    // The function's behavior is conservative: thresholds the date later
    // than naive expectation, slightly delaying tenure qualification.
    const hire = new Date("2024-08-31T00:00:00Z");
    const expectedThreshold = new Date("2025-03-03T00:00:00Z");
    expect(computeTenureSatisfies(hire, expectedThreshold, 6)).toBe(true);
    expect(
      computeTenureSatisfies(
        hire,
        new Date("2025-03-02T00:00:00Z"),
        6,
      ),
    ).toBe(false);
  });

  it("years can also be expressed as months", () => {
    // 12 months = 1 year
    const hire = new Date("2024-01-15T00:00:00Z");
    expect(
      computeTenureSatisfies(hire, new Date("2025-01-15T00:00:00Z"), 12),
    ).toBe(true);
    expect(
      computeTenureSatisfies(hire, new Date("2025-01-14T00:00:00Z"), 12),
    ).toBe(false);
  });
});

// ── full_pay treatment ────────────────────────────────────────────────

describe("applyPayTreatment — full_pay", () => {
  it("婚假 8 days at full pay → 0 deduction", () => {
    const result = applyPayTreatment({
      definition: getDef("marriage_leave"),
      daysInPeriod: 8,
      effectiveStart: new Date("2026-04-15T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(0);
    expect(result.fullPayDays).toBe(8);
    expect(result.halfPayDays).toBe(0);
    expect(result.unpaidDays).toBe(0);
    expect(result.treatmentKind).toBe("full_pay");
  });

  it("特休 (annual) at full pay → 0 deduction", () => {
    const result = applyPayTreatment({
      definition: getDef("annual_leave"),
      daysInPeriod: 3,
      effectiveStart: new Date("2026-04-10T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(0);
    expect(result.fullPayDays).toBe(3);
  });
});

// ── unpaid treatment ────────────────────────────────────────────────

describe("applyPayTreatment — unpaid", () => {
  it("事假 1 day @ NT$45000/mo → 1500 deduction", () => {
    const result = applyPayTreatment({
      definition: getDef("personal_leave"),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(1500);
    expect(result.fullPayDays).toBe(0);
    expect(result.halfPayDays).toBe(0);
    expect(result.unpaidDays).toBe(1);
    expect(result.treatmentKind).toBe("unpaid");
    expect(result.dailyRateUsed).toBe(1500);
  });

  it("事假 0.5 day → 750 deduction", () => {
    const result = applyPayTreatment({
      definition: getDef("personal_leave"),
      daysInPeriod: 0.5,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(750);
    expect(result.unpaidDays).toBe(0.5);
  });

  it("事假 with NT$35000/mo → fractional rate, rounded to integer", () => {
    // 35000 / 30 = 1166.666...
    // 1 day × 1166.666 = 1166.666 → rounds to 1167
    const result = applyPayTreatment({
      definition: getDef("personal_leave"),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee({ salaryBase: 35000 }),
    });

    expect(result.deductionAmount).toBe(1167);
  });

  it("家庭照顧假 0.5 day @ NT$45000 → 750", () => {
    const result = applyPayTreatment({
      definition: getDef("family_care_leave"),
      daysInPeriod: 0.5,
      effectiveStart: new Date("2026-04-21T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(750);
    expect(result.treatmentKind).toBe("unpaid");
  });
});

// ── half_pay treatment (生理假, 住院, 安胎) ────────────────────────

describe("applyPayTreatment — half_pay (住院傷病假, 安胎)", () => {
  it("住院傷病假 5 days @ NT$60000 → 5000 deduction", () => {
    // 60000 / 30 = 2000; 5 × 2000 × 0.5 = 5000
    const result = applyPayTreatment({
      definition: getDef("sick_hospitalized"),
      daysInPeriod: 5,
      effectiveStart: new Date("2026-04-10T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee({ salaryBase: 60000 }),
    });

    expect(result.deductionAmount).toBe(5000);
    expect(result.halfPayDays).toBe(5);
  });

  it("安胎休養 (pregnancy_rest_leave) at half_pay", () => {
    const result = applyPayTreatment({
      definition: getDef("pregnancy_rest_leave"),
      daysInPeriod: 7,
      effectiveStart: new Date("2026-04-01T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    // 7 × 1500 × 0.5 = 5250
    expect(result.deductionAmount).toBe(5250);
    expect(result.halfPayDays).toBe(7);
  });
});

// ── menstrual_leave_treatment: 生理假 three-bucket logic (Q1 fix) ──

describe("applyPayTreatment — menstrual_leave_treatment (three buckets per GEAW Art. 14 + MOL 1040131594)", () => {
  const menstrualDef = () => getDef("menstrual_leave");

  it("Bucket 1: 1 day, YTD menstrual=0, sick=0 → all in separate bucket, half pay", () => {
    // separateRoom = 3 - 0 = 3
    // bucket1 = min(1, 3) = 1, bucket2 = 0, bucket3 = 0
    // 1 × 1500 × 0.5 = 750
    const result = applyPayTreatment({
      definition: menstrualDef(),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-15T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(750);
    expect(result.halfPayDays).toBe(1);
    expect(result.unpaidDays).toBe(0);
    expect(result.fullPayDays).toBe(0);
    expect(result.treatmentKind).toBe("menstrual_leave_treatment");
  });

  it("Bucket 1 fully filled YTD: 1 day, YTD menstrual=3, sick=0 → bucket 2 (half pay)", () => {
    // separateRoom = 3 - 3 = 0 (bucket 1 exhausted)
    // bucket1 = 0, capRoom = 30 - 0 = 30
    // bucket2 = min(1, 30) = 1, bucket3 = 0
    // Still half pay
    const result = applyPayTreatment({
      definition: menstrualDef(),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-15T00:00:00Z"),
      ytdSummary: makeYtd({
        byCanonicalKey: { menstrual_leave: 3 },
        menstrualSeparateDaysUsed: 3,
        menstrualTotalDaysUsed: 3,
        sickHalfPayDaysUsed: 0,
      }),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(750);
    expect(result.halfPayDays).toBe(1);
    expect(result.unpaidDays).toBe(0);
  });

  it("Bucket 2 cap exhausted: 1 day, YTD menstrual=3, sick=30 → all unpaid", () => {
    // separateRoom = 0, capRoom = 30 - 30 = 0
    // bucket1 = 0, bucket2 = 0, bucket3 = 1
    // 1 × 1500 = 1500 (unpaid)
    const result = applyPayTreatment({
      definition: menstrualDef(),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-15T00:00:00Z"),
      ytdSummary: makeYtd({
        byCanonicalKey: { menstrual_leave: 3, sick_unhospitalized: 30 },
        menstrualSeparateDaysUsed: 3,
        menstrualTotalDaysUsed: 3,
        sickHalfPayDaysUsed: 30,
      }),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(1500);
    expect(result.halfPayDays).toBe(0);
    expect(result.unpaidDays).toBe(1);
    // Per 勞動部 函釋 prose in note
    expect(result.notes.some((n) => n.includes("1040131594"))).toBe(true);
    expect(result.notes.some((n) => n.includes("beyond"))).toBe(true);
  });

  it("Cap-edge mixed: 5 days, YTD menstrual=3, sick=28 → 2 half + 3 unpaid", () => {
    // separateRoom = 0 (bucket 1 exhausted)
    // capRoom = 30 - 28 = 2
    // bucket1 = 0, bucket2 = min(5, 2) = 2, bucket3 = 5 - 2 = 3
    // halfPayDays = 2, unpaidDays = 3
    // half_pay: 2 × 1500 × 0.5 = 1500
    // unpaid:   3 × 1500       = 4500
    // total: 6000
    const result = applyPayTreatment({
      definition: menstrualDef(),
      daysInPeriod: 5,
      effectiveStart: new Date("2026-04-15T00:00:00Z"),
      ytdSummary: makeYtd({
        byCanonicalKey: { menstrual_leave: 3, sick_unhospitalized: 28 },
        menstrualSeparateDaysUsed: 3,
        menstrualTotalDaysUsed: 3,
        sickHalfPayDaysUsed: 28,
      }),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(6000);
    expect(result.halfPayDays).toBe(2);
    expect(result.unpaidDays).toBe(3);
  });

  it("Spans both buckets 1 and 2: 5 days, YTD menstrual=2, sick=10 → 5 half pay total", () => {
    // separateRoom = 3 - 2 = 1
    // bucket1 = min(5, 1) = 1
    // afterBucket1 = 4, capRoom = 30 - 10 = 20
    // bucket2 = min(4, 20) = 4
    // bucket3 = 0
    // All 5 days are half pay (1 in separate + 4 in shared cap)
    // 5 × 1500 × 0.5 = 3750
    const result = applyPayTreatment({
      definition: menstrualDef(),
      daysInPeriod: 5,
      effectiveStart: new Date("2026-04-15T00:00:00Z"),
      ytdSummary: makeYtd({
        byCanonicalKey: { menstrual_leave: 2, sick_unhospitalized: 10 },
        menstrualSeparateDaysUsed: 2,
        menstrualTotalDaysUsed: 2,
        sickHalfPayDaysUsed: 10,
      }),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(3750);
    expect(result.halfPayDays).toBe(5);
    expect(result.unpaidDays).toBe(0);
    // Detail string mentions both buckets
    expect(result.calculationDetail).toContain("separate bucket");
    expect(result.calculationDetail).toContain("merged with sick cap");
  });

  it("Spans all three buckets: 4 days, YTD menstrual=1, sick=29 → 1 sep + 1 cap + 2 unpaid", () => {
    // separateRoom = 3 - 1 = 2
    // bucket1 = min(4, 2) = 2
    // afterBucket1 = 2, capRoom = 30 - 29 = 1
    // bucket2 = min(2, 1) = 1
    // bucket3 = 1
    // halfPay: (2 + 1) = 3 days × 1500 × 0.5 = 2250
    // unpaid: 1 × 1500 = 1500
    // total: 3750
    const result = applyPayTreatment({
      definition: menstrualDef(),
      daysInPeriod: 4,
      effectiveStart: new Date("2026-04-15T00:00:00Z"),
      ytdSummary: makeYtd({
        byCanonicalKey: { menstrual_leave: 1, sick_unhospitalized: 29 },
        menstrualSeparateDaysUsed: 1,
        menstrualTotalDaysUsed: 1,
        sickHalfPayDaysUsed: 29,
      }),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(3750);
    expect(result.halfPayDays).toBe(3);
    expect(result.unpaidDays).toBe(1);
  });

  it("Half-day request: 0.5 day, YTD menstrual=0, sick=0 → 0.5 half pay", () => {
    // bucket1 = min(0.5, 3) = 0.5
    // 0.5 × 1500 × 0.5 = 375
    const result = applyPayTreatment({
      definition: menstrualDef(),
      daysInPeriod: 0.5,
      effectiveStart: new Date("2026-04-15T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(375);
    expect(result.halfPayDays).toBe(0.5);
  });

  it("Cap exhausted with menstrual overflow already merged: 1 day, YTD menstrual=5, sick=27 → 1 unpaid", () => {
    // YTD: 5 menstrual = 3 separate + 2 overflow merged into sick
    //      27 sick + 2 menstrual_overflow = 29 in sickHalfPayDaysUsed
    // (this is what ytdCaps.summarizeYtd would produce for this input)
    //
    // Actually wait — ytdCaps merges menstrual overflow INTO sickHalfPayDaysUsed.
    // So if menstrualTotalDaysUsed=5, ytd.sickHalfPayDaysUsed should already
    // include the 2-day overflow. But the test below uses sick=29 directly,
    // which represents that merged total.
    //
    // separateRoom = 3 - 3 = 0
    // capRoom = 30 - 29 = 1
    // bucket1 = 0, bucket2 = 1, bucket3 = 0 → all half pay
    const result = applyPayTreatment({
      definition: menstrualDef(),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-15T00:00:00Z"),
      ytdSummary: makeYtd({
        byCanonicalKey: { menstrual_leave: 5, sick_unhospitalized: 27 },
        menstrualSeparateDaysUsed: 3,
        menstrualTotalDaysUsed: 5,
        sickHalfPayDaysUsed: 29, // 27 sick + 2 menstrual overflow
      }),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(750);
    expect(result.halfPayDays).toBe(1);
    expect(result.unpaidDays).toBe(0);
  });

  it("Citation referenced in audit notes when bucket 3 triggers", () => {
    const result = applyPayTreatment({
      definition: menstrualDef(),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-15T00:00:00Z"),
      ytdSummary: makeYtd({
        menstrualSeparateDaysUsed: 3,
        sickHalfPayDaysUsed: 30,
      }),
      employee: makeEmployee(),
    });

    expect(result.notes.some((n) => n.includes("勞動部 函釋"))).toBe(true);
    expect(result.notes.some((n) => n.includes("1040131594"))).toBe(true);
  });
});

// ── half_pay_with_ytd_cap (病假 unhospitalized) — the trickiest ───

describe("applyPayTreatment — half_pay_with_ytd_cap (病假 30-day cap)", () => {
  const sickDef = () => getDef("sick_unhospitalized");

  it("病假 1 day, YTD = 0 → all half pay, 750 deduction", () => {
    const result = applyPayTreatment({
      definition: sickDef(),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd({ sickHalfPayDaysUsed: 0 }),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(750);
    expect(result.halfPayDays).toBe(1);
    expect(result.unpaidDays).toBe(0);
    expect(result.treatmentKind).toBe("half_pay_with_ytd_cap");
  });

  it("病假 5 days, YTD = 25 → 5 days half pay (cap not yet hit)", () => {
    // YTD 25 + current 5 = 30 — exactly at cap. All 5 still half-pay.
    const result = applyPayTreatment({
      definition: sickDef(),
      daysInPeriod: 5,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd({ sickHalfPayDaysUsed: 25 }),
      employee: makeEmployee(),
    });

    // 5 × 1500 × 0.5 = 3750
    expect(result.deductionAmount).toBe(3750);
    expect(result.halfPayDays).toBe(5);
    expect(result.unpaidDays).toBe(0);
  });

  it("病假 5 days, YTD = 28 → 2 days half pay + 3 days unpaid (cap edge)", () => {
    // YTD 28; cap 30; remaining = 2.
    // Days 1-2: half pay (2 × 1500 × 0.5 = 1500)
    // Days 3-5: unpaid (3 × 1500 = 4500)
    // Total: 6000
    const result = applyPayTreatment({
      definition: sickDef(),
      daysInPeriod: 5,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd({ sickHalfPayDaysUsed: 28 }),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(6000);
    expect(result.halfPayDays).toBe(2);
    expect(result.unpaidDays).toBe(3);
    expect(result.notes.length).toBeGreaterThan(0); // cap-edge note
    expect(result.notes.some((n) => n.includes("exceed"))).toBe(true);
  });

  it("病假 5 days, YTD = 30 → all 5 unpaid (cap exhausted)", () => {
    const result = applyPayTreatment({
      definition: sickDef(),
      daysInPeriod: 5,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd({ sickHalfPayDaysUsed: 30 }),
      employee: makeEmployee(),
    });

    // 5 × 1500 = 7500 (all unpaid)
    expect(result.deductionAmount).toBe(7500);
    expect(result.halfPayDays).toBe(0);
    expect(result.unpaidDays).toBe(5);
    expect(result.notes.some((n) => n.includes("exhausted"))).toBe(true);
  });

  it("病假 5 days, YTD = 35 → all 5 unpaid (cap already exceeded before)", () => {
    const result = applyPayTreatment({
      definition: sickDef(),
      daysInPeriod: 5,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd({ sickHalfPayDaysUsed: 35 }),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(7500);
    expect(result.unpaidDays).toBe(5);
    expect(result.halfPayDays).toBe(0);
  });

  it("病假 with menstrual overflow already in YTD: YTD includes 1 menstrual overflow", () => {
    // Doc A § 7.6 example: employee took 4 menstrual days (3 separate + 1 overflow)
    // and 28 病假 days. ytdSummary.sickHalfPayDaysUsed = 28 + 1 = 29.
    // Now they take another 病假 day in current period:
    //   Cap remaining = 30 - 29 = 1. Half-pay 1 day, no overflow.
    const result = applyPayTreatment({
      definition: sickDef(),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd({
        sickHalfPayDaysUsed: 29,
        byCanonicalKey: { sick_unhospitalized: 28, menstrual_leave: 4 },
        menstrualSeparateDaysUsed: 3,
        menstrualTotalDaysUsed: 4,
      }),
      employee: makeEmployee(),
    });

    // Half pay for the 30th cumulative day
    expect(result.deductionAmount).toBe(750);
    expect(result.halfPayDays).toBe(1);
    expect(result.unpaidDays).toBe(0);
  });

  it("病假 with menstrual overflow already at cap: YTD = 30 from menstrual+sick, current is unpaid", () => {
    // YTD 28 sick + 5 menstrual (3 separate + 2 overflow) = 30 in cap bucket
    // → next 病假 day is unpaid
    const result = applyPayTreatment({
      definition: sickDef(),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd({
        sickHalfPayDaysUsed: 30,
        byCanonicalKey: { sick_unhospitalized: 28, menstrual_leave: 5 },
        menstrualSeparateDaysUsed: 3,
        menstrualTotalDaysUsed: 5,
      }),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(1500); // unpaid
    expect(result.halfPayDays).toBe(0);
    expect(result.unpaidDays).toBe(1);
  });

  it("calculation_detail string is informative for half-pay-only", () => {
    const result = applyPayTreatment({
      definition: sickDef(),
      daysInPeriod: 3,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd({ sickHalfPayDaysUsed: 5 }),
      employee: makeEmployee(),
    });

    expect(result.calculationDetail).toContain("half pay");
    expect(result.calculationDetail).toContain("30-day cap");
    expect(result.calculationDetail).toContain("YTD used: 5");
  });
});

// ── tenure_dependent (產假) ────────────────────────────────────────

describe("applyPayTreatment — tenure_dependent (maternity_leave)", () => {
  const matDef = () => getDef("maternity_leave");

  it("maternity at tenure ≥ 6 months → 0 deduction (full pay)", () => {
    // Hired 2024-01-15, leave starts 2024-07-15 (exactly 6 months)
    const result = applyPayTreatment({
      definition: matDef(),
      daysInPeriod: 30, // partial month of 56-day maternity in current period
      effectiveStart: new Date("2024-07-15T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee({
        hireDate: new Date("2024-01-15T00:00:00Z"),
      }),
    });

    expect(result.deductionAmount).toBe(0);
    expect(result.fullPayDays).toBe(30);
    expect(result.unpaidDays).toBe(0);
    expect(result.treatmentKind).toBe("tenure_dependent");
  });

  it("maternity at tenure < 6 months → half pay deduction", () => {
    // Hired 2024-04-01, leave starts 2024-07-15 (~3.5 months tenure)
    // 30 days × 1500 × 0.5 = 22500
    const result = applyPayTreatment({
      definition: matDef(),
      daysInPeriod: 30,
      effectiveStart: new Date("2024-07-15T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee({
        hireDate: new Date("2024-04-01T00:00:00Z"),
      }),
    });

    expect(result.deductionAmount).toBe(22500);
    expect(result.halfPayDays).toBe(30);
    expect(result.unpaidDays).toBe(0);
    expect(result.fullPayDays).toBe(0);
    expect(result.notes.some((n) => n.includes("LSA Art. 50"))).toBe(true);
  });

  it("tenure exactly at 6-month boundary (full pay)", () => {
    // 2024-01-15 + 6 months = 2024-07-15
    const result = applyPayTreatment({
      definition: matDef(),
      daysInPeriod: 7,
      effectiveStart: new Date("2024-07-15T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee({
        hireDate: new Date("2024-01-15T00:00:00Z"),
      }),
    });

    expect(result.deductionAmount).toBe(0);
    expect(result.fullPayDays).toBe(7);
  });

  it("tenure one day short of 6-month boundary (half pay)", () => {
    // 2024-01-15 + 6 months = 2024-07-15; leave starts 2024-07-14
    const result = applyPayTreatment({
      definition: matDef(),
      daysInPeriod: 7,
      effectiveStart: new Date("2024-07-14T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee({
        hireDate: new Date("2024-01-15T00:00:00Z"),
      }),
    });

    expect(result.halfPayDays).toBe(7);
    expect(result.deductionAmount).toBe(roundExpected(7 * 1500 * 0.5));
  });

  it("missing hire_date → fallback to unpaid with WARNING note", () => {
    const result = applyPayTreatment({
      definition: matDef(),
      daysInPeriod: 7,
      effectiveStart: new Date("2024-07-15T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee({ hireDate: null }),
    });

    expect(result.deductionAmount).toBe(7 * 1500); // unpaid
    expect(result.unpaidDays).toBe(7);
    expect(result.notes.some((n) => n.includes("WARNING"))).toBe(true);
    expect(result.notes.some((n) => n.includes("hire_date"))).toBe(true);
  });
});

// ── employer_full_pay_with_insurance_offset (公傷病假) ───────────

describe("applyPayTreatment — employer_full_pay_with_insurance_offset", () => {
  it("公傷病假 → 0 deduction with insurance-offset note", () => {
    const result = applyPayTreatment({
      definition: getDef("occupational_injury_leave"),
      daysInPeriod: 14,
      effectiveStart: new Date("2026-04-01T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(0);
    expect(result.fullPayDays).toBe(14);
    expect(result.unpaidDays).toBe(0);
    expect(result.treatmentKind).toBe(
      "employer_full_pay_with_insurance_offset",
    );
    expect(result.notes.some((n) => n.includes("勞工保險"))).toBe(true);
    expect(result.notes.some((n) => n.includes("insurance offset"))).toBe(
      true,
    );
  });
});

// ── skip_from_payroll (育嬰留停) — must throw ────────────────────

describe("applyPayTreatment — skip_from_payroll throws", () => {
  it("parental_leave throws (orchestrator must filter upstream)", () => {
    expect(() =>
      applyPayTreatment({
        definition: getDef("parental_leave"),
        daysInPeriod: 30,
        effectiveStart: new Date("2026-04-01T00:00:00Z"),
        ytdSummary: makeYtd(),
        employee: makeEmployee(),
      }),
    ).toThrow(/orchestrator must filter/i);
  });
});

// ── Edge cases ──────────────────────────────────────────────────────

describe("applyPayTreatment — edge cases", () => {
  it("zero-day leave → 0 deduction with explanatory note", () => {
    const result = applyPayTreatment({
      definition: getDef("personal_leave"),
      daysInPeriod: 0,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(0);
    expect(result.fullPayDays).toBe(0);
    expect(result.halfPayDays).toBe(0);
    expect(result.unpaidDays).toBe(0);
    expect(result.notes.some((n) => n.includes("zero or negative"))).toBe(true);
  });

  it("negative days defensively handled as zero", () => {
    const result = applyPayTreatment({
      definition: getDef("personal_leave"),
      daysInPeriod: -1,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    expect(result.deductionAmount).toBe(0);
  });

  it("very high salary (above bracket cap) handled correctly", () => {
    // salary_base 200000 → daily rate 6666.66...
    // 1 day 事假 = 6667 NTD (rounded)
    const result = applyPayTreatment({
      definition: getDef("personal_leave"),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee({ salaryBase: 200000 }),
    });

    expect(result.deductionAmount).toBe(6667);
  });

  it("very low salary handled correctly", () => {
    // salary_base 27470 → daily rate 915.66...
    // 1 day 事假 = 916 NTD (rounded)
    const result = applyPayTreatment({
      definition: getDef("personal_leave"),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee({ salaryBase: 27470 }),
    });

    expect(result.deductionAmount).toBe(916);
  });
});

// ── attendanceBonusInteraction (Q5 audit-flagging) ─────────────────────

describe("applyPayTreatment — attendanceBonusInteraction (Q5 audit flag)", () => {
  it("protected leave (婚假) → flag.protected=true with note", () => {
    const result = applyPayTreatment({
      definition: getDef("marriage_leave"),
      daysInPeriod: 8,
      effectiveStart: new Date("2026-04-15T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    expect(result.attendanceBonusInteraction.protected).toBe(true);
    expect(result.attendanceBonusInteraction.proportionalDeduction).toBe(null);
    expect(result.attendanceBonusInteraction.note).toContain("NOT permitted");
    expect(result.attendanceBonusInteraction.note).toContain("Phase 3c");
  });

  it("protected leave (生理假) → flag.protected=true", () => {
    // Menstrual leave is protected per 性別平等工作法 第21條
    const result = applyPayTreatment({
      definition: getDef("menstrual_leave"),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-15T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    expect(result.attendanceBonusInteraction.protected).toBe(true);
    expect(result.attendanceBonusInteraction.note).toContain("NOT permitted");
  });

  it("protected leave (公傷病假) → flag.protected=true", () => {
    const result = applyPayTreatment({
      definition: getDef("occupational_injury_leave"),
      daysInPeriod: 5,
      effectiveStart: new Date("2026-04-01T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    expect(result.attendanceBonusInteraction.protected).toBe(true);
  });

  it("unprotected (事假) → flag.protected=false, proportionalDeduction=true", () => {
    const result = applyPayTreatment({
      definition: getDef("personal_leave"),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    expect(result.attendanceBonusInteraction.protected).toBe(false);
    expect(result.attendanceBonusInteraction.proportionalDeduction).toBe(true);
    expect(result.attendanceBonusInteraction.note).toContain("BY PROPORTION");
  });

  it("special-case (病假) → mentions 第9-1條 10-day YTD protection", () => {
    // Per 勞工請假規則 第9-1條 (effective 2026-01-01), the first 10 days
    // of 病假 per year are protected. The leave-type flag itself is
    // unprotected, but the note must surface this YTD-aware rule for
    // the orchestrator to apply.
    const result = applyPayTreatment({
      definition: getDef("sick_unhospitalized"),
      daysInPeriod: 1,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd({ sickHalfPayDaysUsed: 5 }),
      employee: makeEmployee(),
    });

    expect(result.attendanceBonusInteraction.protected).toBe(false);
    expect(result.attendanceBonusInteraction.proportionalDeduction).toBe(true);
    expect(result.attendanceBonusInteraction.note).toContain("第9-1條");
    expect(result.attendanceBonusInteraction.note).toContain("10-day");
    expect(result.attendanceBonusInteraction.note).toContain("YTD");
  });

  it("audit flag present even on zero-day defensive return", () => {
    const result = applyPayTreatment({
      definition: getDef("personal_leave"),
      daysInPeriod: 0,
      effectiveStart: new Date("2026-04-09T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
    });

    // Even with zero deduction, the flag must be populated so the
    // orchestrator has consistent shape to work with.
    expect(result.attendanceBonusInteraction).toBeDefined();
    expect(result.attendanceBonusInteraction.note).toBeTruthy();
  });
});

// ── Helper for rounding test expectations ──
function roundExpected(amount: number): number {
  return Math.floor(amount + 0.5);
}

// ── Phase 3b.5 Step 6 — chainContext (continuous sick leave) ────────

describe("half_pay_with_ytd_cap with chainContext (Step 6)", () => {
  // Daily rate 1500 (45000 / 30)

  it("legacy behavior unchanged when chainContext absent", () => {
    const result = applyPayTreatment({
      definition: getDef("sick_unhospitalized"),
      daysInPeriod: 5,
      effectiveStart: new Date("2026-04-13T00:00:00Z"),
      ytdSummary: makeYtd({ sickHalfPayDaysUsed: 0 }),
      employee: makeEmployee(),
    });
    // 5 days at half pay: 5 × 1500 × 0.5 = 3750
    expect(result.deductionAmount).toBe(3750);
    expect(result.halfPayDays).toBe(5);
    expect(result.fullPayDays).toBe(0);
    expect(result.unpaidDays).toBe(0);
  });

  it("chainContext: 5 work-days in days-1-30, 2 weekend non-work days", () => {
    // Record covers Mon-Sun: 5 work days + 2 non-work days, all in days-1-30
    const result = applyPayTreatment({
      definition: getDef("sick_unhospitalized"),
      daysInPeriod: 7,
      effectiveStart: new Date("2026-04-13T00:00:00Z"),
      ytdSummary: makeYtd({ sickHalfPayDaysUsed: 0 }),
      employee: makeEmployee(),
      chainContext: {
        workDaysInDays1To30: 5,
        nonWorkDaysInDays1To30: 2,
        calendarDaysInDay31Plus: 0,
      },
    });
    // 5 work days half pay: 5 × 1500 × 0.5 = 3750
    // 2 non-work days full pay: 0 deduction (per LSA Art. 39)
    expect(result.deductionAmount).toBe(3750);
    expect(result.halfPayDays).toBe(5);
    expect(result.fullPayDays).toBe(2);
    expect(result.unpaidDays).toBe(0);
  });

  it("chainContext: pure day-31+ region — all unpaid", () => {
    // Record entirely past day 30 of chain
    const result = applyPayTreatment({
      definition: getDef("sick_unhospitalized"),
      daysInPeriod: 7,
      effectiveStart: new Date("2026-02-23T00:00:00Z"),
      ytdSummary: makeYtd({ sickHalfPayDaysUsed: 30 }),
      employee: makeEmployee(),
      chainContext: {
        workDaysInDays1To30: 0,
        nonWorkDaysInDays1To30: 0,
        calendarDaysInDay31Plus: 7,
      },
    });
    // 7 calendar days unpaid: 7 × 1500 = 10500
    expect(result.deductionAmount).toBe(10500);
    expect(result.unpaidDays).toBe(7);
    expect(result.halfPayDays).toBe(0);
    expect(result.fullPayDays).toBe(0);
  });

  it("chainContext: mix of days-1-30 and day-31+", () => {
    // Record straddles day 30 boundary: 3 work-days in days-1-30,
    // 1 non-work in days-1-30, 5 calendar in day-31+
    const result = applyPayTreatment({
      definition: getDef("sick_unhospitalized"),
      daysInPeriod: 9,
      effectiveStart: new Date("2026-02-20T00:00:00Z"),
      ytdSummary: makeYtd({ sickHalfPayDaysUsed: 27 }),
      employee: makeEmployee(),
      chainContext: {
        workDaysInDays1To30: 3,
        nonWorkDaysInDays1To30: 1,
        calendarDaysInDay31Plus: 5,
      },
    });
    // 3 work-days half pay: 3 × 1500 × 0.5 = 2250
    // 1 non-work full pay: 0
    // 5 calendar day-31+ unpaid: 5 × 1500 = 7500
    // Total: 9750
    expect(result.deductionAmount).toBe(9750);
    expect(result.halfPayDays).toBe(3);
    expect(result.fullPayDays).toBe(1);
    expect(result.unpaidDays).toBe(5);
  });

  it("chainContext: YTD cap exhausted — work-days flip to unpaid", () => {
    // YTD already used 30 days; record's 5 work-days exceed cap entirely
    const result = applyPayTreatment({
      definition: getDef("sick_unhospitalized"),
      daysInPeriod: 7,
      effectiveStart: new Date("2026-04-13T00:00:00Z"),
      ytdSummary: makeYtd({ sickHalfPayDaysUsed: 30 }), // cap exhausted
      employee: makeEmployee(),
      chainContext: {
        workDaysInDays1To30: 5,
        nonWorkDaysInDays1To30: 2,
        calendarDaysInDay31Plus: 0,
      },
    });
    // 0 half pay (cap exhausted), 5 work-days unpaid: 5 × 1500 = 7500
    // 2 non-work full pay: 0 (LSA Art. 39 still applies in days-1-30)
    expect(result.deductionAmount).toBe(7500);
    expect(result.halfPayDays).toBe(0);
    expect(result.fullPayDays).toBe(2);
    expect(result.unpaidDays).toBe(5);
  });

  it("chainContext: partial YTD cap remaining", () => {
    // YTD has 28 used; cap 30; remaining 2. Record has 5 work-days.
    // 2 → half pay; 3 → unpaid (cap exhausted).
    const result = applyPayTreatment({
      definition: getDef("sick_unhospitalized"),
      daysInPeriod: 5,
      effectiveStart: new Date("2026-04-13T00:00:00Z"),
      ytdSummary: makeYtd({ sickHalfPayDaysUsed: 28 }),
      employee: makeEmployee(),
      chainContext: {
        workDaysInDays1To30: 5,
        nonWorkDaysInDays1To30: 0,
        calendarDaysInDay31Plus: 0,
      },
    });
    // 2 half pay: 2 × 1500 × 0.5 = 1500
    // 3 unpaid: 3 × 1500 = 4500
    // Total 6000
    expect(result.deductionAmount).toBe(6000);
    expect(result.halfPayDays).toBe(2);
    expect(result.fullPayDays).toBe(0);
    expect(result.unpaidDays).toBe(3);
  });

  it("chainContext: notes mention 函釋 citation", () => {
    const result = applyPayTreatment({
      definition: getDef("sick_unhospitalized"),
      daysInPeriod: 5,
      effectiveStart: new Date("2026-04-13T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
      chainContext: {
        workDaysInDays1To30: 5,
        nonWorkDaysInDays1To30: 0,
        calendarDaysInDay31Plus: 0,
      },
    });
    const notes = result.notes.join(" ");
    expect(notes).toContain("勞動條3字第1120147882號函");
  });

  it("chainContext: zero-day record returns zero deduction", () => {
    const result = applyPayTreatment({
      definition: getDef("sick_unhospitalized"),
      daysInPeriod: 0,
      effectiveStart: new Date("2026-04-13T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
      chainContext: {
        workDaysInDays1To30: 0,
        nonWorkDaysInDays1To30: 0,
        calendarDaysInDay31Plus: 0,
      },
    });
    // Zero-day defensive return path
    expect(result.deductionAmount).toBe(0);
  });

  it("chainContext does NOT affect non-sick leaves", () => {
    // Personal leave with chainContext should ignore chainContext
    const result = applyPayTreatment({
      definition: getDef("personal_leave"),
      daysInPeriod: 5,
      effectiveStart: new Date("2026-04-13T00:00:00Z"),
      ytdSummary: makeYtd(),
      employee: makeEmployee(),
      chainContext: {
        workDaysInDays1To30: 5,
        nonWorkDaysInDays1To30: 0,
        calendarDaysInDay31Plus: 0,
      },
    });
    // Personal leave is unpaid: 5 × 1500 = 7500
    expect(result.deductionAmount).toBe(7500);
    expect(result.unpaidDays).toBe(5);
  });

  it("chainContext: only counts non-work days for full pay, not unpaid", () => {
    // Verify nonWorkDaysInDays1To30 contributes to fullPayDays, NOT unpaidDays
    const result = applyPayTreatment({
      definition: getDef("sick_unhospitalized"),
      daysInPeriod: 9,
      effectiveStart: new Date("2026-04-13T00:00:00Z"),
      ytdSummary: makeYtd({ sickHalfPayDaysUsed: 30 }), // cap exhausted
      employee: makeEmployee(),
      chainContext: {
        workDaysInDays1To30: 5,
        nonWorkDaysInDays1To30: 4,
        calendarDaysInDay31Plus: 0,
      },
    });
    // Even with cap exhausted: 5 work-days unpaid (5 × 1500 = 7500),
    // 4 non-work full pay (LSA Art. 39 protects them)
    expect(result.deductionAmount).toBe(7500);
    expect(result.fullPayDays).toBe(4);
    expect(result.unpaidDays).toBe(5);
    expect(result.halfPayDays).toBe(0);
  });
});
