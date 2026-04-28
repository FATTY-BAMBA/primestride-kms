// src/lib/payroll/ytdCaps.ts
//
// Atlas EIP — Year-to-Date Leave Usage Summary
// ──────────────────────────────────────────────────────────────────────
// Phase 3b layer 2 of 4. Takes a YtdContext (raw approved leaves before
// the current period) and produces a structured summary of usage by
// canonical leave type, including the 生理假 ↔ 病假 bucket-merging logic
// per 性別平等工作法 第14條.
//
// Pure function. No DB calls. No I/O. Same input → same output.
//
// Design principle (per Doc A § 3.3): this file REPORTS usage. It does
// NOT apply caps. Cap application happens in payTreatment.ts (layer 3).
// Separation of concerns means we can test these layers independently.
//
// Soft-fail semantics: classifier failures on YTD records are surfaced
// as warnings, not exceptions. The orchestrator (and eventually the
// compliance agent) decides whether to halt or proceed.

import { classify, type ClassificationResult } from "./leaveClassifier";
import type { YtdContext } from "./leaveAggregator";
import type { LeaveTypeDefinition } from "./leaveOntology";

// ── Public types ─────────────────────────────────────────────────────

/**
 * A YTD record that failed to classify cleanly. Surfaced for audit/
 * agent review; not included in usage totals.
 */
export type YtdClassificationFailure = {
  sourceWorkflowSubmissionId: string;
  leaveTypeRaw: string;
  daysClaimed: number;
  reason: "unclassified" | "ambiguous";
  ambiguousCandidates?: string[];
};

/**
 * Structured summary of YTD leave usage for a single employee.
 *
 * Notes on the merged buckets:
 *
 *   sickHalfPayDaysUsed = 病假 (unhospitalized) days
 *                       + (生理假 days beyond the first 3)
 *
 * Per 性別平等工作法 第14條: "全年請假日數未逾三日，不併入病假計算，
 * 其餘日數併入病假計算。" Days 4+ of menstrual leave count INTO the
 * sick leave 30-day half-pay cap.
 *
 *   menstrualSeparateDaysUsed = MIN(total 生理假 YTD, 3)
 *
 * The first 3 days/year are in their own bucket (don't count toward
 * the 30-day cap).
 *
 * The 30-day cap itself is NOT applied here. payTreatment.ts uses these
 * values to decide how much of the CURRENT period's leaves get half-pay
 * vs. exceed-cap unpaid.
 */
export type YtdSummary = {
  /**
   * Days used by canonical leave key, summed directly from approved
   * YTD records. Does NOT include the menstrual→sick overflow merge;
   * see sickHalfPayDaysUsed for the merged value.
   */
  byCanonicalKey: Record<string, number>;

  /**
   * Combined sick-leave half-pay bucket (per LSA Art. 4 + GEAW Art. 14):
   *   = sick_unhospitalized_days + max(0, menstrual_days - 3)
   * Used by payTreatment to determine how many days of CURRENT-period
   * 病假 receive half pay vs. exceed-cap unpaid.
   */
  sickHalfPayDaysUsed: number;

  /**
   * Days used in the menstrual "separate" bucket (first 3 days/year
   * that don't count toward the sick cap).
   *   = min(menstrual_days, 3)
   */
  menstrualSeparateDaysUsed: number;

  /**
   * Total raw 生理假 days YTD (informational; equals
   * menstrualSeparateDaysUsed + (sickHalfPayDaysUsed contribution from
   * menstrual overflow)).
   */
  menstrualTotalDaysUsed: number;

  /**
   * Records that could not be classified. Surfaced for audit; excluded
   * from totals.
   */
  unclassifiedRecords: YtdClassificationFailure[];

  /**
   * Records that matched multiple ontology entries. Surfaced for audit;
   * excluded from totals.
   */
  ambiguousRecords: YtdClassificationFailure[];

  /** Total count of YTD records that classified cleanly. */
  classifiedRecordCount: number;

  /** Total count of YTD records that did not classify cleanly. */
  unclassifiedRecordCount: number;
};

// ── Helper: tally a single classified record into the by-key map ────

function addToTally(
  byCanonicalKey: Record<string, number>,
  canonicalKey: string,
  daysClaimed: number,
): void {
  byCanonicalKey[canonicalKey] =
    (byCanonicalKey[canonicalKey] ?? 0) + daysClaimed;
}

// ── Main entry point ────────────────────────────────────────────────

/**
 * Summarize an employee's YTD leave usage from a YtdContext.
 *
 * Process:
 *   1. Classify every raw YTD record (soft-fail on classifier errors)
 *   2. Tally days by canonical leave key
 *   3. Compute the 生理假 ↔ 病假 bucket merge per GEAW Art. 14
 *
 * @example
 *   const summary = summarizeYtd(employee.ytdContext);
 *   summary.sickHalfPayDaysUsed  // 5 if employee took 5 病假 days
 *   summary.byCanonicalKey['marriage_leave']  // 3 if took 3 婚假 days
 */
export function summarizeYtd(ytdContext: YtdContext): YtdSummary {
  const byCanonicalKey: Record<string, number> = {};
  const unclassifiedRecords: YtdClassificationFailure[] = [];
  const ambiguousRecords: YtdClassificationFailure[] = [];
  let classifiedRecordCount = 0;

  for (const record of ytdContext.rawRecords) {
    const result: ClassificationResult = classify(record.leaveTypeRaw);

    if (result.ok === true) {
      // Successful classification — tally the days.
      const def: LeaveTypeDefinition = result.definition;
      addToTally(byCanonicalKey, def.canonicalKey, record.daysClaimed);
      classifiedRecordCount++;
    } else if (result.reason === "ambiguous") {
      ambiguousRecords.push({
        sourceWorkflowSubmissionId: record.sourceWorkflowSubmissionId,
        leaveTypeRaw: record.leaveTypeRaw,
        daysClaimed: record.daysClaimed,
        reason: "ambiguous",
        ambiguousCandidates: result.candidates,
      });
    } else {
      // unclassified
      unclassifiedRecords.push({
        sourceWorkflowSubmissionId: record.sourceWorkflowSubmissionId,
        leaveTypeRaw: record.leaveTypeRaw,
        daysClaimed: record.daysClaimed,
        reason: "unclassified",
      });
    }
  }

  // ── Bucket merge: 生理假 ↔ 病假 per 性別平等工作法 第14條 ──
  //
  // Total menstrual YTD splits into two buckets:
  //   - First 3 days: separate bucket (never counts toward sick cap)
  //   - Days 4+: merged into sick_unhospitalized for cap calculations
  //
  // Why cumulative-not-per-record interpretation: GEAW Art. 14 says
  //   "全年請假日數未逾三日，不併入病假計算，其餘日數併入病假計算"
  //   = "annual days within 3, not merged with sick; the rest merged"
  // It speaks of an aggregate threshold, not a per-occurrence one.
  //
  // The 30-day half-pay cap itself is NOT applied here. payTreatment.ts
  // uses sickHalfPayDaysUsed to decide whether the CURRENT period's
  // 病假 days get half-pay or fall into the exceed-cap unpaid zone.
  //
  // Example: employee takes 4 days 生理假 and 28 days 病假 YTD.
  //   menstrualTotalDaysUsed       = 4
  //   menstrualSeparateDaysUsed    = 3 (capped at 3)
  //   menstrual_overflow_into_sick = 1
  //   sickHalfPayDaysUsed          = 28 + 1 = 29
  // The next 病假 day is the 30th and gets half pay (last of the 30 cap).
  // The 31st day exceeds the cap and is unpaid (or per legacy rule:
  // 工資折半發給 only applies to the first 30; thereafter unpaid).

  const menstrualTotalDaysUsed = byCanonicalKey["menstrual_leave"] ?? 0;
  const menstrualSeparateDaysUsed = Math.min(menstrualTotalDaysUsed, 3);
  const menstrualOverflowIntoSick = Math.max(
    0,
    menstrualTotalDaysUsed - 3,
  );
  const sickUnhospitalizedDaysUsed =
    byCanonicalKey["sick_unhospitalized"] ?? 0;
  const sickHalfPayDaysUsed =
    sickUnhospitalizedDaysUsed + menstrualOverflowIntoSick;

  return {
    byCanonicalKey,
    sickHalfPayDaysUsed,
    menstrualSeparateDaysUsed,
    menstrualTotalDaysUsed,
    unclassifiedRecords,
    ambiguousRecords,
    classifiedRecordCount,
    unclassifiedRecordCount:
      unclassifiedRecords.length + ambiguousRecords.length,
  };
}
