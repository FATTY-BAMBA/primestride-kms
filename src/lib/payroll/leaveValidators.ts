// src/lib/payroll/leaveValidators.ts
//
// Atlas EIP — Leave Validators
// ──────────────────────────────────────────────────────────────────────
// Pure validation functions that surface compliance/data-quality issues
// without modifying the underlying records.
//
// DESIGN PRINCIPLES:
//
//   1. Pure: each validator takes structured inputs and returns
//      ValidationWarning[]. No I/O, no side effects, no mutation.
//
//   2. Soft-warn (not silent rewrite): when a rule is broken, we
//      SURFACE it. We never silently change record data. The workflow
//      approval layer should have caught most of these; the calculator
//      flags what slipped through.
//
//   3. Audit-friendly: each warning carries the FK to the offending
//      workflow_submission so HR admins can locate and correct the
//      source record.
//
//   4. Composable: orchestrator runs all relevant validators per
//      employee, concatenates warnings.
//
// CURRENT VALIDATORS:
//
//   - validateMenstrualMonthlyLimit (Gap #2 fix)
//     Per 性別平等工作法 第14條: 女性受僱者因生理日致工作有困難者，
//     每月得請生理假一日. We flag any month where >1 day was used.
//
// FUTURE VALIDATORS (likely Phase 3c):
//
//   - validateBereavementGrade (喪假 by relationship grade)
//   - validateMarriageLeaveTiming (婚假 within reasonable time of marriage)
//   - validateOccupationalInjuryDocumented (公傷病假 documentation)

import type {
  LeaveOccurrenceInPeriod,
  YtdContext,
} from "./leaveAggregator";
import { classify } from "./leaveClassifier";

// ── Public types ─────────────────────────────────────────────────────

/**
 * A single validation finding.
 *
 * Designed to flow into EmployeeLeaveDeductionResult.warnings as a
 * formatted string, but kept as structured data here so downstream
 * consumers can render or filter as needed.
 */
export type ValidationWarning = {
  /** Stable identifier for the rule violated. Used by tests & UI. */
  code: ValidationWarningCode;
  /** Human-readable description of the issue. Includes verbatim citations. */
  message: string;
  /** FK to the offending workflow_submissions.id */
  sourceWorkflowSubmissionId: string;
  /** Days claimed in the offending record (for context) */
  daysClaimed: number;
  /** When this leave occurred (ISO YYYY-MM-DD) */
  effectiveDate: string;
  /** Severity: warning = surface in audit; error = fundamental problem */
  severity: "warning" | "error";
};

/**
 * Stable validation rule codes.
 *
 * Format: <leaveType>_<violation>_<scope>
 * Codes are NEVER renamed once shipped — UI and audit logs reference them.
 */
export type ValidationWarningCode =
  | "MENSTRUAL_PER_MONTH_LIMIT_EXCEEDED";

// ── Internals ────────────────────────────────────────────────────────

/**
 * Convert a Date to YYYY-MM (calendar-month bucket key) in UTC.
 * UTC alignment matches WorkingDayService and avoids timezone slop.
 */
function utcMonthKey(d: Date): string {
  const yr = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yr}-${mo}`;
}

/**
 * Convert a Date to YYYY-MM-DD (UTC).
 */
function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Lightweight occurrence shape used internally — just the fields the
 * validator needs. Allows both LeaveOccurrenceInPeriod (in-period) and
 * the YtdContext.rawRecords shape (YTD) to flow into the same logic.
 */
type ValidatorOccurrence = {
  sourceWorkflowSubmissionId: string;
  leaveTypeRaw: string;
  daysClaimed: number;
  effectiveDate: Date; // The date this leave was taken (or its anchor)
};

/**
 * Combine in-period occurrences and YTD raw records into one stream
 * of ValidatorOccurrence entries for cross-period analysis.
 */
function combineOccurrences(
  inPeriod: ReadonlyArray<LeaveOccurrenceInPeriod>,
  ytdContext: YtdContext,
): ValidatorOccurrence[] {
  const out: ValidatorOccurrence[] = [];

  for (const occ of inPeriod) {
    out.push({
      sourceWorkflowSubmissionId: occ.sourceWorkflowSubmissionId,
      leaveTypeRaw: occ.leaveTypeRaw,
      daysClaimed: occ.daysInPeriod,
      effectiveDate: occ.effectiveStart,
    });
  }

  for (const r of ytdContext.rawRecords) {
    out.push({
      sourceWorkflowSubmissionId: r.sourceWorkflowSubmissionId,
      leaveTypeRaw: r.leaveTypeRaw,
      daysClaimed: r.daysClaimed,
      effectiveDate: r.startDate,
    });
  }

  return out;
}

// ── Validator: Menstrual per-month limit ────────────────────────────

/**
 * Per 性別平等工作法 第14條:
 *   "女性受僱者因生理日致工作有困難者，每月得請生理假一日"
 *
 * Allows ONE 生理假 day per calendar month. Records exceeding this in
 * a given month produce a warning per excess record.
 *
 * Counting rules:
 *   - All 生理假 records (in-period + YTD) considered for cross-period
 *     accuracy. A 生理假 on 2026-03-29 (YTD) plus another on 2026-03-31
 *     (in-period) both fall in March → second one warns.
 *   - Records are sorted by effective date; the FIRST in each month is
 *     considered "within limit", subsequent ones warn.
 *   - Same-day duplicate submissions both warn (data quality issue).
 *   - Days claimed > 1 within a single record: not flagged here
 *     (separate concern — workflow should reject single records of >1d
 *     since the law says "一日"). Handled by other layers.
 *
 * Note: We pass occurrences through `classify()` to identify menstrual
 * leave robustly across the various raw strings we see in production
 * ("生理假", "Menstrual leave", etc.). Records that fail classification
 * are skipped here — they're caught by the orchestrator's general
 * unclassified-record warning.
 *
 * @returns array of warnings, one per excess record (empty if no violations)
 */
export function validateMenstrualMonthlyLimit(input: {
  inPeriod: ReadonlyArray<LeaveOccurrenceInPeriod>;
  ytdContext: YtdContext;
}): ValidationWarning[] {
  const all = combineOccurrences(input.inPeriod, input.ytdContext);

  // Filter to menstrual leaves only (via classifier — robust to raw text variations)
  const menstrual: ValidatorOccurrence[] = [];
  for (const occ of all) {
    const c = classify(occ.leaveTypeRaw);
    if (c.ok === true && c.definition.canonicalKey === "menstrual_leave") {
      menstrual.push(occ);
    }
  }

  if (menstrual.length === 0) return [];

  // Sort by effective date (stable, ascending)
  menstrual.sort((a, b) => {
    const t = a.effectiveDate.getTime() - b.effectiveDate.getTime();
    if (t !== 0) return t;
    // Tie-break by sourceWorkflowSubmissionId for deterministic ordering
    return a.sourceWorkflowSubmissionId.localeCompare(
      b.sourceWorkflowSubmissionId,
    );
  });

  // Group by calendar month and flag any beyond the first
  const seenInMonth = new Set<string>();
  const warnings: ValidationWarning[] = [];

  for (const occ of menstrual) {
    const monthKey = utcMonthKey(occ.effectiveDate);
    if (seenInMonth.has(monthKey)) {
      // Excess record — generate warning
      warnings.push({
        code: "MENSTRUAL_PER_MONTH_LIMIT_EXCEEDED",
        severity: "warning",
        sourceWorkflowSubmissionId: occ.sourceWorkflowSubmissionId,
        daysClaimed: occ.daysClaimed,
        effectiveDate: toIsoDate(occ.effectiveDate),
        message:
          `生理假 monthly limit exceeded for ${monthKey}: per 性別平等工作法 第14條, ` +
          `"女性受僱者因生理日致工作有困難者，每月得請生理假一日" — only one 生理假 ` +
          `day is permitted per calendar month. The earlier record in this month ` +
          `is within the limit; this record (${occ.daysClaimed}d on ` +
          `${toIsoDate(occ.effectiveDate)}) is excess. Calculation proceeds normally; ` +
          `workflow approval should have caught this.`,
      });
    } else {
      seenInMonth.add(monthKey);
    }
  }

  return warnings;
}

// ── Composite: run all validators ───────────────────────────────────

/**
 * Run all validators against a single employee's leave data.
 * Returns combined warnings array, ready to merge into
 * EmployeeLeaveDeductionResult.warnings.
 *
 * As more validators are added, they're called here. Order doesn't
 * matter for correctness, but stable ordering helps test reliability.
 */
export function runAllLeaveValidators(input: {
  inPeriod: ReadonlyArray<LeaveOccurrenceInPeriod>;
  ytdContext: YtdContext;
}): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  warnings.push(...validateMenstrualMonthlyLimit(input));
  // Future: warnings.push(...validateBereavementGrade(input));
  // Future: warnings.push(...validateMarriageLeaveTiming(input));
  return warnings;
}

/**
 * Convert ValidationWarning to a plain string for display in
 * EmployeeLeaveDeductionResult.warnings (which is string[]).
 *
 * Keeps the orchestrator's existing string[]-based interface stable
 * while letting validators internally use richer structured data.
 */
export function formatWarning(w: ValidationWarning): string {
  return `[${w.code}] ${w.message} (record: ${w.sourceWorkflowSubmissionId})`;
}
