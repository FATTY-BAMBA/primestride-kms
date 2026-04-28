// src/lib/payroll/__tests__/attendanceBonusCalc.test.ts
//
// Tests for attendanceBonusCalc.ts.
// Pure function tests — no DB, no I/O.

import { describe, it, expect } from "vitest";
import {
  computeAttendanceBonusDeduction,
  ATTENDANCE_BONUS_CALCULATOR_VERSION,
} from "../attendanceBonusCalc";
import type { LeaveOccurrenceInPeriod, EmployeeProfileSnapshot } from "../leaveAggregator";
import type { YtdSummary } from "../ytdCaps";

// ── Fixture helpers ──────────────────────────────────────────────────

function makeProfile(
  partial: Partial<EmployeeProfileSnapshot> = {},
): EmployeeProfileSnapshot {
  return {
    userId: "test-user",
    fullName: "Test User",
    nationalId: null,
    employeeId: null,
    department: null,
    jobTitle: null,
    salaryBase: 45000,
    salaryCurrency: "TWD",
    attendanceBonusMonthly: 3000, // ← reasonable Taiwan SMB default for tests
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

function makeLeave(partial: {
  leaveTypeRaw: string;
  daysInPeriod?: number;
  effectiveStart?: string;
  sourceId?: string;
}): LeaveOccurrenceInPeriod {
  const start = new Date((partial.effectiveStart ?? "2026-04-15") + "T00:00:00Z");
  const end = start;
  return {
    sourceWorkflowSubmissionId: partial.sourceId ?? `ws-${partial.effectiveStart ?? "default"}`,
    leaveTypeRaw: partial.leaveTypeRaw,
    daysClaimedFull: partial.daysInPeriod ?? 1,
    daysInPeriod: partial.daysInPeriod ?? 1,
    durationType: "full_day",
    hoursRequested: null,
    reason: null,
    originalStart: start,
    originalEnd: end,
    effectiveStart: start,
    effectiveEnd: end,
    spansBeyondPeriod: false,
    approvedAt: new Date(start.getTime() + 28800000),
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

// ── 1. Zero-bonus fast path ──────────────────────────────────────────

describe("zero or invalid bonus", () => {
  it("returns 0 deduction when attendanceBonusMonthly is 0", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 0 }),
      leaves: [makeLeave({ leaveTypeRaw: "事假", daysInPeriod: 5 })],
      ytdSummary: makeYtd(),
    });
    expect(result.originalBonus).toBe(0);
    expect(result.totalDeduction).toBe(0);
    expect(result.netBonus).toBe(0);
    expect(result.breakdown).toEqual([]); // No per-leave entries when fast-path
    expect(result.notes[0]).toContain("No attendance bonus configured");
  });

  it("clamps negative bonus to 0 with audit note", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: -500 }),
      leaves: [makeLeave({ leaveTypeRaw: "事假" })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(0);
    expect(result.notes[0]).toContain("Invalid");
    expect(result.notes[0]).toContain("-500");
  });

  it("returns 0 deduction with no leaves at all", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [],
      ytdSummary: makeYtd(),
    });
    expect(result.originalBonus).toBe(3000);
    expect(result.totalDeduction).toBe(0);
    expect(result.netBonus).toBe(3000);
    expect(result.breakdown).toEqual([]);
  });
});

// ── 2. Protected leave types — 第9條 §1 ──────────────────────────────

describe("protected leave types (no deduction)", () => {
  it("婚假 produces no deduction", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [makeLeave({ leaveTypeRaw: "婚假", daysInPeriod: 8 })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(0);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].deductibleDays).toBe(0);
    expect(result.breakdown[0].deductedAmount).toBe(0);
    expect(result.breakdown[0].reason).toContain("Protected");
    expect(result.breakdown[0].reason).toContain("婚假");
  });

  it("喪假 produces no deduction", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [makeLeave({ leaveTypeRaw: "喪假", daysInPeriod: 6 })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(0);
    expect(result.breakdown[0].reason).toContain("喪假");
  });

  it("公假 produces no deduction", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [makeLeave({ leaveTypeRaw: "公假", daysInPeriod: 1 })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(0);
  });

  it("公傷病假 produces no deduction", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [makeLeave({ leaveTypeRaw: "公傷病假", daysInPeriod: 30 })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(0);
  });

  it("產假 produces no deduction", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [makeLeave({ leaveTypeRaw: "產假", daysInPeriod: 56 })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(0);
  });

  it("產檢假 produces no deduction", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [makeLeave({ leaveTypeRaw: "產檢假", daysInPeriod: 1 })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(0);
  });

  it("陪產假 produces no deduction", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [makeLeave({ leaveTypeRaw: "陪產假", daysInPeriod: 7 })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(0);
  });
});

// ── 3. Proportional deduction — 第9條 §2 ─────────────────────────────

describe("proportional deduction (default for non-protected)", () => {
  it("事假 1 day → 100 NTD (3000/30 × 1)", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [makeLeave({ leaveTypeRaw: "事假", daysInPeriod: 1 })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(100);
    expect(result.netBonus).toBe(2900);
    expect(result.breakdown[0].deductedAmount).toBe(100);
    expect(result.breakdown[0].deductibleDays).toBe(1);
  });

  it("事假 5 days → 500 NTD", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [makeLeave({ leaveTypeRaw: "事假", daysInPeriod: 5 })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(500);
    expect(result.netBonus).toBe(2500);
  });

  it("uses 30-day divisor matching 勞動部 worked example", () => {
    // 勞動部 Q&A example: 3000 monthly bonus, 1 sick day → 100 NTD
    // (sick is special-case with budget; using 事假 here for pure proportional)
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [makeLeave({ leaveTypeRaw: "事假", daysInPeriod: 1 })],
      ytdSummary: makeYtd(),
    });
    // 3000 / 30 × 1 = 100 (matches official example)
    expect(result.totalDeduction).toBe(100);
  });

  it("rounds half-up: 4000/30 × 1 = 133.33 → 133 NTD", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 4000 }),
      leaves: [makeLeave({ leaveTypeRaw: "事假", daysInPeriod: 1 })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(133);
  });

  it("rounds half-up: 5000/30 × 1 = 166.67 → 167 NTD", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 5000 }),
      leaves: [makeLeave({ leaveTypeRaw: "事假", daysInPeriod: 1 })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(167);
  });
});

// ── 4. Sick leave 10-day budget — 第9-1條 ────────────────────────────

describe("sick leave 10-day protection budget (第9-1條)", () => {
  it("3 days of sick leave with 0 YTD pure sick → 0 deduction (within budget)", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [makeLeave({ leaveTypeRaw: "病假", daysInPeriod: 3 })],
      ytdSummary: makeYtd({ byCanonicalKey: { sick_unhospitalized: 0 } }),
    });
    expect(result.totalDeduction).toBe(0);
    expect(result.breakdown[0].deductibleDays).toBe(0);
    expect(result.breakdown[0].reason).toContain("Within 10-day");
  });

  it("11 days of sick leave with 0 YTD → 1 day deductible (10 protected)", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [makeLeave({ leaveTypeRaw: "病假", daysInPeriod: 11 })],
      ytdSummary: makeYtd({ byCanonicalKey: { sick_unhospitalized: 0 } }),
    });
    expect(result.totalDeduction).toBe(100); // 1 day × 100
    expect(result.breakdown[0].deductibleDays).toBe(1);
  });

  it("3 days sick with YTD already at 10 → all 3 deductible", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [makeLeave({ leaveTypeRaw: "病假", daysInPeriod: 3 })],
      ytdSummary: makeYtd({ byCanonicalKey: { sick_unhospitalized: 10 } }),
    });
    expect(result.totalDeduction).toBe(300); // 3 × 100
    expect(result.breakdown[0].deductibleDays).toBe(3);
  });

  it("3 days sick with YTD at 8 → 2 protected + 1 deductible", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [makeLeave({ leaveTypeRaw: "病假", daysInPeriod: 3 })],
      ytdSummary: makeYtd({ byCanonicalKey: { sick_unhospitalized: 8 } }),
    });
    // 10-8 = 2 days remaining protection. 3 - 2 = 1 deductible.
    expect(result.totalDeduction).toBe(100);
    expect(result.breakdown[0].deductibleDays).toBe(1);
    expect(result.breakdown[0].reason).toContain("Partial");
  });

  it("budget excludes merged menstrual overflow (per 勞動部 Q&A)", () => {
    // ytdSummary has sickHalfPayDaysUsed = 13 (3 pure sick + 10 merged
    // menstrual overflow). The 10-day 第9-1條 budget should consume
    // ONLY pure 病假, so should still have 7 days protection remaining.
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [makeLeave({ leaveTypeRaw: "病假", daysInPeriod: 5 })],
      ytdSummary: makeYtd({
        byCanonicalKey: {
          sick_unhospitalized: 3,
          menstrual_leave: 13, // 3 separate + 10 merged
        },
        sickHalfPayDaysUsed: 13,
        menstrualSeparateDaysUsed: 3,
        menstrualTotalDaysUsed: 13,
      }),
    });
    // 10 - 3 (pure 病假 YTD) = 7 protection remaining
    // 5 days requested, all within remaining 7-day budget
    // → 0 deduction
    expect(result.totalDeduction).toBe(0);
    expect(result.breakdown[0].deductibleDays).toBe(0);
  });

  it("12 days sick with YTD at 9 → 1 protected + 11 deductible", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [makeLeave({ leaveTypeRaw: "病假", daysInPeriod: 12 })],
      ytdSummary: makeYtd({ byCanonicalKey: { sick_unhospitalized: 9 } }),
    });
    // 10-9 = 1 day remaining protection. 12 - 1 = 11 deductible.
    expect(result.totalDeduction).toBe(1100); // 11 × 100
    expect(result.breakdown[0].deductibleDays).toBe(11);
  });
});

// ── 5. Mixed leave types ────────────────────────────────────────────

describe("mixed leave types in same period", () => {
  it("婚假 + 事假: only 事假 deducts", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [
        makeLeave({ leaveTypeRaw: "婚假", daysInPeriod: 8, sourceId: "ws-w" }),
        makeLeave({ leaveTypeRaw: "事假", daysInPeriod: 2, sourceId: "ws-p" }),
      ],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(200); // 2 × 100, 婚假 protected
    expect(result.breakdown).toHaveLength(2);
    const married = result.breakdown.find((b) => b.sourceWorkflowSubmissionId === "ws-w");
    const personal = result.breakdown.find((b) => b.sourceWorkflowSubmissionId === "ws-p");
    expect(married?.deductedAmount).toBe(0);
    expect(personal?.deductedAmount).toBe(200);
  });

  it("事假 + 病假 (within budget): only 事假 deducts", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [
        makeLeave({ leaveTypeRaw: "事假", daysInPeriod: 1, sourceId: "p", effectiveStart: "2026-04-13" }),
        makeLeave({ leaveTypeRaw: "病假", daysInPeriod: 5, sourceId: "s", effectiveStart: "2026-04-15" }),
      ],
      ytdSummary: makeYtd({ byCanonicalKey: { sick_unhospitalized: 0 } }),
    });
    expect(result.totalDeduction).toBe(100); // 事假 1 × 100
    const sick = result.breakdown.find((b) => b.sourceWorkflowSubmissionId === "s");
    expect(sick?.deductedAmount).toBe(0);
  });

  it("multiple sick leaves consume budget in date order", () => {
    // First sick (5d on 4/05) consumes 5 of 10. Second sick (8d on 4/15)
    // gets 5 protected, 3 deductible.
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [
        makeLeave({ leaveTypeRaw: "病假", daysInPeriod: 5, sourceId: "s1", effectiveStart: "2026-04-05" }),
        makeLeave({ leaveTypeRaw: "病假", daysInPeriod: 8, sourceId: "s2", effectiveStart: "2026-04-15" }),
      ],
      ytdSummary: makeYtd({ byCanonicalKey: { sick_unhospitalized: 0 } }),
    });
    expect(result.totalDeduction).toBe(300); // 0 + 3 × 100
    const s1 = result.breakdown.find((b) => b.sourceWorkflowSubmissionId === "s1");
    const s2 = result.breakdown.find((b) => b.sourceWorkflowSubmissionId === "s2");
    expect(s1?.deductibleDays).toBe(0);
    expect(s2?.deductibleDays).toBe(3);
  });

  it("sorts deterministically by date then sourceId", () => {
    // Same dates, different IDs — alphabetical tiebreak
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [
        makeLeave({ leaveTypeRaw: "事假", daysInPeriod: 1, sourceId: "z", effectiveStart: "2026-04-10" }),
        makeLeave({ leaveTypeRaw: "事假", daysInPeriod: 1, sourceId: "a", effectiveStart: "2026-04-10" }),
      ],
      ytdSummary: makeYtd(),
    });
    expect(result.breakdown[0].sourceWorkflowSubmissionId).toBe("a");
    expect(result.breakdown[1].sourceWorkflowSubmissionId).toBe("z");
  });
});

// ── 6. Special / edge cases ──────────────────────────────────────────

describe("edge cases", () => {
  it("unclassified leave is skipped with conservative note", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [makeLeave({ leaveTypeRaw: "garbage type that doesn't classify", daysInPeriod: 5 })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(0);
    expect(result.breakdown[0].canonicalKey).toBeNull();
    expect(result.breakdown[0].reason).toContain("Unclassified");
  });

  it("生理假 (separate, days 1-3) is protected separately from 病假 budget", () => {
    // 生理假 has its own 性別平等工作法 第21條 protection
    // (perfectAttendanceProtected.protected = true in ontology)
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [makeLeave({ leaveTypeRaw: "生理假", daysInPeriod: 1 })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(0);
    expect(result.breakdown[0].reason).toContain("Protected");
  });

  it("家庭照顧假 produces no deduction (per 第9條 §1.3)", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [makeLeave({ leaveTypeRaw: "家庭照顧假", daysInPeriod: 7 })],
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBe(0);
  });

  it("specified totalDeduction never exceeds originalBonus (cap)", () => {
    // Pathological case: tiny bonus, many days
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 100 }),
      leaves: [makeLeave({ leaveTypeRaw: "事假", daysInPeriod: 30 })], // would be 100/30 × 30 = 100
      ytdSummary: makeYtd(),
    });
    expect(result.totalDeduction).toBeLessThanOrEqual(100);
    expect(result.netBonus).toBeGreaterThanOrEqual(0);
  });

  it("calculator version stamp is present", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [],
      ytdSummary: makeYtd(),
    });
    expect(result.calculatorVersion).toBe(ATTENDANCE_BONUS_CALCULATOR_VERSION);
    expect(result.calculatorVersion).toMatch(/^phase-3c-v/);
  });

  it("netBonus + totalDeduction always equals originalBonus", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile({ attendanceBonusMonthly: 3000 }),
      leaves: [
        makeLeave({ leaveTypeRaw: "事假", daysInPeriod: 5, sourceId: "p" }),
        makeLeave({ leaveTypeRaw: "病假", daysInPeriod: 11, sourceId: "s" }),
      ],
      ytdSummary: makeYtd({ byCanonicalKey: { sick_unhospitalized: 0 } }),
    });
    expect(result.netBonus + result.totalDeduction).toBe(result.originalBonus);
  });

  it("Sick leave English alias 'Sick leave' is recognized", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [makeLeave({ leaveTypeRaw: "Sick leave", daysInPeriod: 11 })],
      ytdSummary: makeYtd({ byCanonicalKey: { sick_unhospitalized: 0 } }),
    });
    // Should be recognized as sick_unhospitalized and apply 10-day budget
    expect(result.breakdown[0].canonicalKey).toBe("sick_unhospitalized");
    expect(result.breakdown[0].deductibleDays).toBe(1);
  });
});

// ── 7. Audit trail completeness ──────────────────────────────────────

describe("audit trail", () => {
  it("each breakdown entry has all required fields", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [makeLeave({ leaveTypeRaw: "事假", daysInPeriod: 2, sourceId: "ws-1" })],
      ytdSummary: makeYtd(),
    });
    const entry = result.breakdown[0];
    expect(entry.sourceWorkflowSubmissionId).toBe("ws-1");
    expect(entry.leaveTypeRaw).toBe("事假");
    expect(entry.canonicalKey).toBe("personal_leave");
    expect(entry.daysInPeriod).toBe(2);
    expect(entry.deductibleDays).toBe(2);
    expect(entry.deductedAmount).toBe(200);
    expect(entry.reason).toBeTruthy();
  });

  it("reason cites legal basis for protected leaves", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [makeLeave({ leaveTypeRaw: "婚假", daysInPeriod: 8 })],
      ytdSummary: makeYtd(),
    });
    expect(result.breakdown[0].reason).toMatch(/勞工請假規則 第9條/);
  });

  it("reason cites 第9-1條 for sick leave protection", () => {
    const result = computeAttendanceBonusDeduction({
      profile: makeProfile(),
      leaves: [makeLeave({ leaveTypeRaw: "病假", daysInPeriod: 3 })],
      ytdSummary: makeYtd({ byCanonicalKey: { sick_unhospitalized: 0 } }),
    });
    expect(result.breakdown[0].reason).toContain("第9-1條");
  });
});
