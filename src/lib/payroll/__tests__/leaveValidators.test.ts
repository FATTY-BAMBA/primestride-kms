// src/lib/payroll/__tests__/leaveValidators.test.ts
//
// Tests for leaveValidators.ts. Pure functions, no DB.

import { describe, it, expect } from "vitest";
import {
  validateMenstrualMonthlyLimit,
  runAllLeaveValidators,
  formatWarning,
  type ValidationWarning,
} from "../leaveValidators";
import type {
  LeaveOccurrenceInPeriod,
  YtdContext,
} from "../leaveAggregator";

// ── Fixture helpers ──────────────────────────────────────────────────

function makeInPeriodOccurrence(partial: {
  leaveTypeRaw: string;
  effectiveDate: string;
  daysInPeriod?: number;
  sourceId?: string;
}): LeaveOccurrenceInPeriod {
  const start = new Date(partial.effectiveDate + "T00:00:00Z");
  const end = start;
  return {
    sourceWorkflowSubmissionId:
      partial.sourceId ?? `inperiod-${partial.effectiveDate}`,
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
    approvedAt: new Date(partial.effectiveDate + "T08:00:00Z"),
  };
}

function makeYtdContext(
  records: Array<{
    leaveTypeRaw: string;
    effectiveDate: string;
    daysClaimed?: number;
    sourceId?: string;
  }> = [],
): YtdContext {
  return {
    windowStart: new Date("2026-01-01T00:00:00Z"),
    windowEnd: new Date("2026-04-01T00:00:00Z"),
    rawRecords: records.map((r) => ({
      sourceWorkflowSubmissionId: r.sourceId ?? `ytd-${r.effectiveDate}`,
      leaveTypeRaw: r.leaveTypeRaw,
      daysClaimed: r.daysClaimed ?? 1,
      startDate: new Date(r.effectiveDate + "T00:00:00Z"),
      endDate: new Date(r.effectiveDate + "T00:00:00Z"),
      durationType: null,
    })),
  };
}

// ── 1. validateMenstrualMonthlyLimit ────────────────────────────────

describe("validateMenstrualMonthlyLimit", () => {
  it("returns empty when no menstrual leaves are present", () => {
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({ leaveTypeRaw: "事假", effectiveDate: "2026-03-15" }),
        makeInPeriodOccurrence({ leaveTypeRaw: "病假", effectiveDate: "2026-03-20" }),
      ],
      ytdContext: makeYtdContext(),
    });
    expect(result).toEqual([]);
  });

  it("returns empty for a single 生理假 in a month", () => {
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-15",
        }),
      ],
      ytdContext: makeYtdContext(),
    });
    expect(result).toEqual([]);
  });

  it("warns on the second 生理假 in the same calendar month", () => {
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-10",
          sourceId: "ws-1",
        }),
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-25",
          sourceId: "ws-2",
        }),
      ],
      ytdContext: makeYtdContext(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("MENSTRUAL_PER_MONTH_LIMIT_EXCEEDED");
    expect(result[0].sourceWorkflowSubmissionId).toBe("ws-2"); // SECOND record warns
    expect(result[0].effectiveDate).toBe("2026-03-25");
    expect(result[0].severity).toBe("warning");
  });

  it("first record in month is the keeper, subsequent warn", () => {
    // ws-A is March 10, ws-B is March 5. ws-B is earlier → keeper.
    // ws-A warns because it comes after ws-B in date order.
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-10",
          sourceId: "ws-A",
        }),
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-05",
          sourceId: "ws-B",
        }),
      ],
      ytdContext: makeYtdContext(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].sourceWorkflowSubmissionId).toBe("ws-A");
  });

  it("warns on each excess record (3 records → 2 warnings)", () => {
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-05",
          sourceId: "ws-1",
        }),
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-15",
          sourceId: "ws-2",
        }),
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-25",
          sourceId: "ws-3",
        }),
      ],
      ytdContext: makeYtdContext(),
    });

    expect(result).toHaveLength(2);
    expect(result.map((w) => w.sourceWorkflowSubmissionId)).toEqual([
      "ws-2",
      "ws-3",
    ]);
  });

  it("does NOT warn for menstrual leaves in different months", () => {
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-01-15",
        }),
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-02-15",
        }),
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-15",
        }),
      ],
      ytdContext: makeYtdContext(),
    });
    expect(result).toEqual([]);
  });

  it("considers YTD record + in-period record in the same month", () => {
    // YTD has a 生理假 from earlier in March; new in-period record also in March
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-25",
          sourceId: "ws-inperiod",
        }),
      ],
      ytdContext: makeYtdContext([
        {
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-10",
          sourceId: "ws-ytd",
        },
      ]),
    });

    expect(result).toHaveLength(1);
    // The IN-PERIOD record warns because YTD had the first one (March 10 < March 25)
    expect(result[0].sourceWorkflowSubmissionId).toBe("ws-inperiod");
  });

  it("considers two YTD records in the same month", () => {
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [],
      ytdContext: makeYtdContext([
        {
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-02-05",
          sourceId: "ws-ytd-1",
        },
        {
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-02-20",
          sourceId: "ws-ytd-2",
        },
      ]),
    });

    expect(result).toHaveLength(1);
    expect(result[0].sourceWorkflowSubmissionId).toBe("ws-ytd-2");
  });

  it("uses classifier — recognizes 'Menstrual leave' (English)", () => {
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "Menstrual leave",
          effectiveDate: "2026-03-10",
        }),
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-20",
          sourceId: "ws-2nd",
        }),
      ],
      ytdContext: makeYtdContext(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].sourceWorkflowSubmissionId).toBe("ws-2nd");
  });

  it("ignores unclassified leave types", () => {
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "garbage type that doesn't classify",
          effectiveDate: "2026-03-10",
        }),
        makeInPeriodOccurrence({
          leaveTypeRaw: "another garbage type",
          effectiveDate: "2026-03-20",
        }),
      ],
      ytdContext: makeYtdContext(),
    });
    expect(result).toEqual([]);
  });

  it("ignores other leave types when mixed with 生理假", () => {
    // Mixed: 病假 + 事假 + only one 生理假 → no warning
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "病假",
          effectiveDate: "2026-03-05",
        }),
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-15",
        }),
        makeInPeriodOccurrence({
          leaveTypeRaw: "事假",
          effectiveDate: "2026-03-25",
        }),
      ],
      ytdContext: makeYtdContext(),
    });
    expect(result).toEqual([]);
  });

  it("warning message includes legal citation 第14條", () => {
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-10",
        }),
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-20",
        }),
      ],
      ytdContext: makeYtdContext(),
    });

    expect(result[0].message).toContain("第14條");
    expect(result[0].message).toContain("性別平等工作法");
  });

  it("warning message includes the affected month", () => {
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-10",
        }),
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-20",
        }),
      ],
      ytdContext: makeYtdContext(),
    });
    expect(result[0].message).toContain("2026-03");
  });

  it("handles same-day duplicate submissions (data quality)", () => {
    // Two distinct submissions both on 2026-03-15 — second one warns
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-15",
          sourceId: "ws-aaa",
        }),
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-15",
          sourceId: "ws-bbb",
        }),
      ],
      ytdContext: makeYtdContext(),
    });

    expect(result).toHaveLength(1);
    // Tie-breaker: alphabetical by sourceId, so "ws-aaa" is keeper, "ws-bbb" warns
    expect(result[0].sourceWorkflowSubmissionId).toBe("ws-bbb");
  });

  it("year-spanning: same month-of-year in different years are distinct", () => {
    // 2025-03 and 2026-03 are different month buckets — neither warns
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-15",
        }),
      ],
      ytdContext: makeYtdContext([
        { leaveTypeRaw: "生理假", effectiveDate: "2025-03-10" },
      ]),
    });
    expect(result).toEqual([]);
  });

  it("handles months at year boundaries correctly", () => {
    // Dec 2025 and Jan 2026 are separate buckets
    const result = validateMenstrualMonthlyLimit({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-01-05",
        }),
      ],
      ytdContext: makeYtdContext([
        { leaveTypeRaw: "生理假", effectiveDate: "2025-12-28" },
      ]),
    });
    expect(result).toEqual([]);
  });
});

// ── 2. runAllLeaveValidators (composite) ────────────────────────────

describe("runAllLeaveValidators", () => {
  it("returns concatenated warnings from all validators", () => {
    const result = runAllLeaveValidators({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-10",
        }),
        makeInPeriodOccurrence({
          leaveTypeRaw: "生理假",
          effectiveDate: "2026-03-20",
        }),
      ],
      ytdContext: makeYtdContext(),
    });

    // Currently only the menstrual validator exists; expect 1 warning.
    // When other validators are added, this test stays correct as long
    // as the single condition is the only violation.
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("MENSTRUAL_PER_MONTH_LIMIT_EXCEEDED");
  });

  it("returns empty when no rules violated", () => {
    const result = runAllLeaveValidators({
      inPeriod: [
        makeInPeriodOccurrence({
          leaveTypeRaw: "事假",
          effectiveDate: "2026-03-10",
        }),
      ],
      ytdContext: makeYtdContext(),
    });
    expect(result).toEqual([]);
  });
});

// ── 3. formatWarning ────────────────────────────────────────────────

describe("formatWarning", () => {
  it("produces a string with code, message, and source id", () => {
    const w: ValidationWarning = {
      code: "MENSTRUAL_PER_MONTH_LIMIT_EXCEEDED",
      severity: "warning",
      sourceWorkflowSubmissionId: "ws-test-123",
      daysClaimed: 1,
      effectiveDate: "2026-03-20",
      message: "Test message body",
    };

    const formatted = formatWarning(w);
    expect(formatted).toContain("MENSTRUAL_PER_MONTH_LIMIT_EXCEEDED");
    expect(formatted).toContain("Test message body");
    expect(formatted).toContain("ws-test-123");
  });
});
