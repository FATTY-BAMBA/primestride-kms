// src/lib/payroll/__tests__/ytdCaps.test.ts
//
// Tests for ytdCaps.summarizeYtd — the YTD usage summary with the
// 生理假 ↔ 病假 bucket-merging logic per GEAW Art. 14.
//
// Test strategy: construct synthetic YtdContext objects directly,
// no DB calls, full deterministic coverage.

import { describe, it, expect } from "vitest";
import { summarizeYtd } from "../ytdCaps";
import type { YtdContext } from "../leaveAggregator";

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Build a YtdContext with the given raw records. Window dates are
 * placeholders since summarizeYtd doesn't depend on them — the records
 * passed in are presumed already filtered to the YTD window.
 */
function buildYtd(
  rawRecords: Array<{
    leaveTypeRaw: string;
    daysClaimed: number;
    /** Optional — defaults to a unique generated id */
    sourceWorkflowSubmissionId?: string;
    /** Optional — defaults to 2026-01-15 */
    startDate?: string;
    endDate?: string;
    durationType?: string | null;
  }>,
): YtdContext {
  return {
    windowStart: new Date("2026-01-01T00:00:00Z"),
    windowEnd: new Date("2026-04-01T00:00:00Z"),
    rawRecords: rawRecords.map((r, idx) => ({
      sourceWorkflowSubmissionId:
        r.sourceWorkflowSubmissionId ?? `synth-${idx}`,
      leaveTypeRaw: r.leaveTypeRaw,
      daysClaimed: r.daysClaimed,
      startDate: new Date((r.startDate ?? "2026-01-15") + "T00:00:00Z"),
      endDate: new Date((r.endDate ?? "2026-01-15") + "T00:00:00Z"),
      durationType: r.durationType ?? null,
    })),
  };
}

// ── Empty input ──────────────────────────────────────────────────────

describe("summarizeYtd — empty inputs", () => {
  it("returns zero totals for empty YTD context", () => {
    const summary = summarizeYtd(buildYtd([]));

    expect(summary.byCanonicalKey).toEqual({});
    expect(summary.sickHalfPayDaysUsed).toBe(0);
    expect(summary.menstrualSeparateDaysUsed).toBe(0);
    expect(summary.menstrualTotalDaysUsed).toBe(0);
    expect(summary.unclassifiedRecords).toEqual([]);
    expect(summary.ambiguousRecords).toEqual([]);
    expect(summary.classifiedRecordCount).toBe(0);
    expect(summary.unclassifiedRecordCount).toBe(0);
  });
});

// ── Pure single-type cases ───────────────────────────────────────────

describe("summarizeYtd — single leave type, no merging", () => {
  it("counts pure 病假 days into sickHalfPayDaysUsed", () => {
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "病假", daysClaimed: 5 },
        { leaveTypeRaw: "病假", daysClaimed: 3 },
      ]),
    );

    expect(summary.byCanonicalKey["sick_unhospitalized"]).toBe(8);
    expect(summary.sickHalfPayDaysUsed).toBe(8);
    expect(summary.menstrualTotalDaysUsed).toBe(0);
    expect(summary.menstrualSeparateDaysUsed).toBe(0);
    expect(summary.classifiedRecordCount).toBe(2);
  });

  it("counts pure 事假 days into byCanonicalKey only", () => {
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "事假", daysClaimed: 2 },
        { leaveTypeRaw: "事假", daysClaimed: 1 },
      ]),
    );

    expect(summary.byCanonicalKey["personal_leave"]).toBe(3);
    expect(summary.sickHalfPayDaysUsed).toBe(0); // unrelated to sick
    expect(summary.classifiedRecordCount).toBe(2);
  });

  it("counts 婚假 / 喪假 / 公假 each separately", () => {
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "婚假", daysClaimed: 8 },
        { leaveTypeRaw: "喪假", daysClaimed: 6 },
        { leaveTypeRaw: "公假", daysClaimed: 1 },
      ]),
    );

    expect(summary.byCanonicalKey["marriage_leave"]).toBe(8);
    expect(summary.byCanonicalKey["bereavement_leave"]).toBe(6);
    expect(summary.byCanonicalKey["official_leave"]).toBe(1);
    expect(summary.sickHalfPayDaysUsed).toBe(0);
  });
});

// ── 生理假 ↔ 病假 bucket-merging — the centerpiece ────────────────────

describe("summarizeYtd — 生理假/病假 bucket merging per GEAW Art. 14", () => {
  it("1 day 生理假 → entirely in separate bucket, no overflow", () => {
    const summary = summarizeYtd(
      buildYtd([{ leaveTypeRaw: "生理假", daysClaimed: 1 }]),
    );

    expect(summary.menstrualTotalDaysUsed).toBe(1);
    expect(summary.menstrualSeparateDaysUsed).toBe(1);
    expect(summary.sickHalfPayDaysUsed).toBe(0);
    expect(summary.byCanonicalKey["menstrual_leave"]).toBe(1);
  });

  it("3 days 生理假 → all 3 in separate bucket, no overflow", () => {
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "生理假", daysClaimed: 1 },
        { leaveTypeRaw: "生理假", daysClaimed: 1 },
        { leaveTypeRaw: "生理假", daysClaimed: 1 },
      ]),
    );

    expect(summary.menstrualTotalDaysUsed).toBe(3);
    expect(summary.menstrualSeparateDaysUsed).toBe(3);
    expect(summary.sickHalfPayDaysUsed).toBe(0);
  });

  it("4 days 生理假 → 3 separate + 1 overflow into sick", () => {
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "生理假", daysClaimed: 4 },
      ]),
    );

    expect(summary.menstrualTotalDaysUsed).toBe(4);
    expect(summary.menstrualSeparateDaysUsed).toBe(3);
    expect(summary.sickHalfPayDaysUsed).toBe(1); // the overflow
    expect(summary.byCanonicalKey["menstrual_leave"]).toBe(4);
    // Note: byCanonicalKey['sick_unhospitalized'] is NOT set here —
    // the overflow only appears in sickHalfPayDaysUsed (the merged value)
    expect(summary.byCanonicalKey["sick_unhospitalized"]).toBeUndefined();
  });

  it("12 days 生理假 → 3 separate + 9 overflow", () => {
    const summary = summarizeYtd(
      buildYtd([{ leaveTypeRaw: "生理假", daysClaimed: 12 }]),
    );

    expect(summary.menstrualTotalDaysUsed).toBe(12);
    expect(summary.menstrualSeparateDaysUsed).toBe(3);
    expect(summary.sickHalfPayDaysUsed).toBe(9);
  });

  it("mixed: 5 days 病假 + 2 days 生理假 → no overflow yet", () => {
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "病假", daysClaimed: 5 },
        { leaveTypeRaw: "生理假", daysClaimed: 2 },
      ]),
    );

    expect(summary.byCanonicalKey["sick_unhospitalized"]).toBe(5);
    expect(summary.menstrualTotalDaysUsed).toBe(2);
    expect(summary.menstrualSeparateDaysUsed).toBe(2);
    expect(summary.sickHalfPayDaysUsed).toBe(5); // sick only, no overflow
  });

  it("mixed: 28 days 病假 + 4 days 生理假 → near 30-day cap edge", () => {
    // Real-world test of the cap-edge case
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "病假", daysClaimed: 28 },
        { leaveTypeRaw: "生理假", daysClaimed: 4 },
      ]),
    );

    expect(summary.byCanonicalKey["sick_unhospitalized"]).toBe(28);
    expect(summary.menstrualTotalDaysUsed).toBe(4);
    expect(summary.menstrualSeparateDaysUsed).toBe(3);
    // 28 sick + 1 menstrual overflow = 29 in the half-pay bucket
    // (exactly 1 under the 30-day cap; the next 病假 day is the 30th)
    expect(summary.sickHalfPayDaysUsed).toBe(29);
  });

  it("half-day 生理假: 0.5 + 0.5 + 0.5 + 0.5 = 2 days, all separate", () => {
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "生理假", daysClaimed: 0.5, durationType: "half_day_am" },
        { leaveTypeRaw: "生理假", daysClaimed: 0.5, durationType: "half_day_pm" },
        { leaveTypeRaw: "生理假", daysClaimed: 0.5, durationType: "half_day_am" },
        { leaveTypeRaw: "生理假", daysClaimed: 0.5, durationType: "half_day_pm" },
      ]),
    );

    expect(summary.menstrualTotalDaysUsed).toBe(2);
    expect(summary.menstrualSeparateDaysUsed).toBe(2);
    expect(summary.sickHalfPayDaysUsed).toBe(0);
  });

  it("fractional overflow: 3.5 menstrual days → 3 separate + 0.5 overflow", () => {
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "生理假", daysClaimed: 3 },
        { leaveTypeRaw: "生理假", daysClaimed: 0.5 },
      ]),
    );

    expect(summary.menstrualTotalDaysUsed).toBe(3.5);
    expect(summary.menstrualSeparateDaysUsed).toBe(3);
    expect(summary.sickHalfPayDaysUsed).toBe(0.5);
  });
});

// ── Hospitalized vs unhospitalized sick — separate buckets ───────────

describe("summarizeYtd — sick hospitalized vs unhospitalized are separate", () => {
  it("住院傷病假 days do NOT contribute to sickHalfPayDaysUsed", () => {
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "病假", daysClaimed: 10 },
        { leaveTypeRaw: "住院傷病假", daysClaimed: 30 },
      ]),
    );

    // Unhospitalized sick (and menstrual overflow) flow into sickHalfPayDaysUsed
    expect(summary.sickHalfPayDaysUsed).toBe(10);
    // Hospitalized sick gets its own canonical key, NOT merged
    expect(summary.byCanonicalKey["sick_hospitalized"]).toBe(30);
    expect(summary.byCanonicalKey["sick_unhospitalized"]).toBe(10);
  });

  it("生理假 overflow does NOT pollute sick_hospitalized bucket", () => {
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "生理假", daysClaimed: 5 },
        { leaveTypeRaw: "住院傷病假", daysClaimed: 20 },
      ]),
    );

    // Menstrual overflow goes to sickHalfPayDaysUsed (the unhospitalized bucket)
    expect(summary.sickHalfPayDaysUsed).toBe(2); // 5 - 3 = 2 overflow
    // Hospitalized stays at 20, untouched
    expect(summary.byCanonicalKey["sick_hospitalized"]).toBe(20);
  });
});

// ── Other leave types ────────────────────────────────────────────────

describe("summarizeYtd — other leave types accumulate independently", () => {
  it("產假 / 陪產假 / 公傷病假 / 安胎 each get own bucket", () => {
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "產假", daysClaimed: 56 },
        { leaveTypeRaw: "陪產假", daysClaimed: 7 },
        { leaveTypeRaw: "公傷病假", daysClaimed: 14 },
        { leaveTypeRaw: "安胎", daysClaimed: 30 },
      ]),
    );

    expect(summary.byCanonicalKey["maternity_leave"]).toBe(56);
    expect(summary.byCanonicalKey["paternity_leave"]).toBe(7);
    expect(summary.byCanonicalKey["occupational_injury_leave"]).toBe(14);
    expect(summary.byCanonicalKey["pregnancy_rest_leave"]).toBe(30);
    // None of these affect the sick bucket
    expect(summary.sickHalfPayDaysUsed).toBe(0);
  });

  it("特休 (annual_leave) accumulates independently", () => {
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "特休", daysClaimed: 3 },
        { leaveTypeRaw: "特休 Annual", daysClaimed: 5 },
      ]),
    );

    expect(summary.byCanonicalKey["annual_leave"]).toBe(8);
    expect(summary.sickHalfPayDaysUsed).toBe(0);
  });

  it("育嬰留停 accumulates (will be filtered by orchestrator before payroll)", () => {
    // ytdCaps doesn't filter parental_leave — that's the orchestrator's
    // job. We just report the days for audit purposes.
    const summary = summarizeYtd(
      buildYtd([{ leaveTypeRaw: "育嬰留職停薪", daysClaimed: 90 }]),
    );

    expect(summary.byCanonicalKey["parental_leave"]).toBe(90);
    expect(summary.classifiedRecordCount).toBe(1);
  });
});

// ── Soft-fail behavior — classifier failures surface as warnings ─────

describe("summarizeYtd — soft-fail on classifier failures", () => {
  it("unclassified records surface in unclassifiedRecords, not totals", () => {
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "病假", daysClaimed: 5 },
        {
          leaveTypeRaw: "totally unknown leave type",
          daysClaimed: 10,
          sourceWorkflowSubmissionId: "ws-bad-1",
        },
      ]),
    );

    // The classified record IS counted
    expect(summary.byCanonicalKey["sick_unhospitalized"]).toBe(5);
    expect(summary.sickHalfPayDaysUsed).toBe(5);

    // The unclassified record is surfaced, not in totals
    expect(summary.unclassifiedRecords).toHaveLength(1);
    expect(summary.unclassifiedRecords[0].sourceWorkflowSubmissionId).toBe(
      "ws-bad-1",
    );
    expect(summary.unclassifiedRecords[0].reason).toBe("unclassified");
    expect(summary.unclassifiedRecords[0].daysClaimed).toBe(10);

    // Counts
    expect(summary.classifiedRecordCount).toBe(1);
    expect(summary.unclassifiedRecordCount).toBe(1);
  });

  it("ambiguous records surface in ambiguousRecords with candidates", () => {
    const summary = summarizeYtd(
      buildYtd([
        {
          leaveTypeRaw: "病假或事假",
          daysClaimed: 2,
          sourceWorkflowSubmissionId: "ws-amb-1",
        },
      ]),
    );

    expect(summary.classifiedRecordCount).toBe(0);
    expect(summary.unclassifiedRecordCount).toBe(1);
    expect(summary.ambiguousRecords).toHaveLength(1);

    const failure = summary.ambiguousRecords[0];
    expect(failure.sourceWorkflowSubmissionId).toBe("ws-amb-1");
    expect(failure.reason).toBe("ambiguous");
    expect(failure.ambiguousCandidates).toBeDefined();
    expect(failure.ambiguousCandidates).toContain("sick_unhospitalized");
    expect(failure.ambiguousCandidates).toContain("personal_leave");

    // Bad records do not contribute to totals
    expect(summary.byCanonicalKey).toEqual({});
    expect(summary.sickHalfPayDaysUsed).toBe(0);
  });

  it("mix of clean + unclassified + ambiguous all surface correctly", () => {
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "病假", daysClaimed: 3 },
        { leaveTypeRaw: "garbage input", daysClaimed: 1 },
        { leaveTypeRaw: "婚假或喪假", daysClaimed: 4 },
        { leaveTypeRaw: "事假", daysClaimed: 1 },
      ]),
    );

    expect(summary.classifiedRecordCount).toBe(2);
    expect(summary.unclassifiedRecords).toHaveLength(1);
    expect(summary.ambiguousRecords).toHaveLength(1);
    expect(summary.byCanonicalKey["sick_unhospitalized"]).toBe(3);
    expect(summary.byCanonicalKey["personal_leave"]).toBe(1);
  });
});

// ── Production-shape cases ──────────────────────────────────────────

describe("summarizeYtd — production-shape inputs", () => {
  it("handles real production string '病假 Sick' (not just '病假')", () => {
    // From real workflow_submissions: leave_type = "病假 Sick"
    const summary = summarizeYtd(
      buildYtd([
        { leaveTypeRaw: "病假 Sick", daysClaimed: 1 },
        { leaveTypeRaw: "病假 Sick", daysClaimed: 2 },
      ]),
    );

    expect(summary.byCanonicalKey["sick_unhospitalized"]).toBe(3);
    expect(summary.sickHalfPayDaysUsed).toBe(3);
  });

  it("handles real production string '特休' for annual leave", () => {
    const summary = summarizeYtd(
      buildYtd([{ leaveTypeRaw: "特休", daysClaimed: 3 }]),
    );

    expect(summary.byCanonicalKey["annual_leave"]).toBe(3);
  });

  it("handles duplicate-content records (sums them all)", () => {
    // Mirrors the Abdoulie Fatty test data: 6 identical 病假 records
    // for the same date. ytdCaps sums them all (no dedup at this layer)
    // — the cleanup happens at the workflow API level (Phase 3f).
    const summary = summarizeYtd(
      buildYtd(
        Array.from({ length: 6 }, (_, i) => ({
          leaveTypeRaw: "病假",
          daysClaimed: 1,
          sourceWorkflowSubmissionId: `dup-${i}`,
        })),
      ),
    );

    expect(summary.classifiedRecordCount).toBe(6);
    expect(summary.byCanonicalKey["sick_unhospitalized"]).toBe(6);
    expect(summary.sickHalfPayDaysUsed).toBe(6);
  });
});

// ── Integration with leaveAggregator's actual YtdContext shape ──────

describe("summarizeYtd — accepts real YtdContext from leaveAggregator", () => {
  it("works with the exact shape leaveAggregator produces", () => {
    // This mimics the structure leaveAggregator.aggregateLeaveData returns.
    // If this test passes, the layers integrate correctly.
    const ytd: YtdContext = {
      windowStart: new Date("2026-01-01T00:00:00Z"),
      windowEnd: new Date("2026-04-01T00:00:00Z"),
      rawRecords: [
        {
          sourceWorkflowSubmissionId: "abc-123",
          leaveTypeRaw: "事假",
          daysClaimed: 1,
          startDate: new Date("2026-03-09T00:00:00Z"),
          endDate: new Date("2026-03-09T00:00:00Z"),
          durationType: null,
        },
        {
          sourceWorkflowSubmissionId: "def-456",
          leaveTypeRaw: "病假 Sick",
          daysClaimed: 1,
          startDate: new Date("2026-03-15T00:00:00Z"),
          endDate: new Date("2026-03-15T00:00:00Z"),
          durationType: null,
        },
      ],
    };

    const summary = summarizeYtd(ytd);

    expect(summary.byCanonicalKey["personal_leave"]).toBe(1);
    expect(summary.byCanonicalKey["sick_unhospitalized"]).toBe(1);
    expect(summary.sickHalfPayDaysUsed).toBe(1);
    expect(summary.menstrualTotalDaysUsed).toBe(0);
    expect(summary.classifiedRecordCount).toBe(2);
    expect(summary.unclassifiedRecordCount).toBe(0);
  });
});
