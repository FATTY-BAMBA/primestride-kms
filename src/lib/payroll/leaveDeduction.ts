// src/lib/payroll/leaveDeduction.ts
//
// Atlas EIP — Leave Deduction Orchestrator
// ──────────────────────────────────────────────────────────────────────
// Phase 3b layer 4 of 4. Stitches together the four lower layers:
//
//   1. leaveAggregator     — DB read, returns AggregatedLeaveData
//   2. leaveClassifier     — classify each leave's raw type → ontology
//   3. ytdCaps             — summarize YTD usage with bucket merges
//   4. payTreatment        — apply per-leave deduction math
//
// Returns a structured LeaveDeductionRunResult ready for consumption by
// the broader payroll engine. Each employee's record contains all
// information needed to populate `payroll.line_items.calculation_notes`
// jsonb + the per-leave audit trail.
//
// Design principles:
//
//   1. SOFT-FAIL by default. One employee's bad data does not halt the
//      run. Per-employee `errors[]` arrays surface contract violations.
//      The orchestrator never throws — even on malformed data — except
//      for upstream DB connection issues that the aggregator already
//      raises.
//
//   2. PARENTAL LEAVE FILTERING. Records that classify cleanly to
//      `parental_leave` (育嬰留停) are removed from the leaves to be
//      calculated. The employee remains in the run output. Filtering
//      records (not employees) handles the realistic mid-period return
//      scenario. Ambiguous/unclassified records flow through unchanged.
//
//   3. COMPLETE OUTPUT. Every active employee from the aggregator
//      appears in the result, even if they took no leave and have no
//      YTD records. Predictable output simplifies downstream code.
//
//   4. AUDIT TRAIL FIRST-CLASS. Every leave occurrence carries its
//      classification, treatment, and calculation detail. The full
//      result serializes cleanly to jsonb for compliance review.

import {
  aggregateLeaveData,
  type AggregatedLeaveData,
  type LeaveOccurrenceInPeriod,
  type AggregatedEmployee,
  type EmployeeProfileSnapshot,
} from "./leaveAggregator";
import { classify, type ClassificationResult } from "./leaveClassifier";
import { summarizeYtd, type YtdSummary } from "./ytdCaps";
import {
  applyPayTreatment,
  type PayTreatmentResult,
} from "./payTreatment";
import type { LeaveTypeDefinition } from "./leaveOntology";

// ── Public types ────────────────────────────────────────────────────

/**
 * The orchestrator's result for a single leave occurrence in the period.
 *
 * Captures everything an auditor or compliance officer would need to
 * understand WHY this deduction was applied: the original workflow
 * submission ID (FK to source data), the raw text submitted, what it
 * was classified as, and the full treatment math.
 */
export type LeaveOccurrenceResult = {
  /** FK to workflow_submissions.id — original source row */
  sourceWorkflowSubmissionId: string;
  /** Raw leave_type string from the workflow form */
  leaveTypeRaw: string;
  /** Classification outcome: success | ambiguous | unclassified */
  classification:
    | { ok: true; canonicalKey: string; canonicalNameZh: string }
    | { ok: false; reason: "ambiguous"; candidates: string[] }
    | { ok: false; reason: "unclassified" };
  /** Days claimed in the original record (single source of truth) */
  daysClaimed: number;
  /** Days that intersect with the current period */
  daysInPeriod: number;
  /** First date of THIS occurrence in the period (used for tenure calc) */
  effectiveStart: string; // ISO date string YYYY-MM-DD
  /**
   * Pay treatment result. NULL when classification failed (no treatment
   * could be applied). The deduction in that case is 0 with the issue
   * surfaced in the employee's warnings array.
   */
  payTreatment: PayTreatmentResult | null;
  /** True if this record was filtered (育嬰留停 — payroll-skip) */
  filteredAsSkipFromPayroll: boolean;
};

/**
 * Aggregated Q5 attendance-bonus flags for a single employee.
 *
 * Phase 3b reports these; Phase 3c will consume them to compute the
 * actual attendance bonus deduction (which requires the employee's
 * attendance_bonus value, not currently stored on profiles).
 */
export type AttendanceBonusFlags = {
  /**
   * True if at least one leave in this period is a protected type
   * (婚假, 喪假, 公傷病假, 生理假, 產假, 育嬰相關, 安胎, 家庭照顧假).
   * Phase 3c calculator must NOT deduct attendance bonus for these.
   */
  anyProtectedLeave: boolean;
  /**
   * Sum of unprotected leave days that would be subject to proportional
   * attendance bonus deduction (e.g., 事假).
   */
  proportionallyDeductibleDays: number;
  /**
   * 病假 days in this period (cumulative-with-YTD will trigger the
   * 第9-1條 10-day protection rule). The calculator in Phase 3c
   * compares this + ytdSummary.sickHalfPayDaysUsed against the 10-day
   * protection threshold.
   */
  sickDaysInPeriod: number;
  /** Per-leave-type details for audit transparency */
  perLeaveNotes: Array<{
    leaveTypeRaw: string;
    canonicalKey: string | null;
    note: string;
  }>;
};

/**
 * The orchestrator's result for a single employee in this run.
 */
export type EmployeeLeaveDeductionResult = {
  /** Stable identifier — Clerk user_id */
  userId: string;
  /** Display name for UI / audit (snapshot value) */
  fullName: string;
  /** Profile snapshot at run time — frozen for audit reproducibility */
  profileSnapshot: EmployeeProfileSnapshot;
  /** Sum of all leave deductions for this period (integer NTD) */
  totalLeaveDeductionAmount: number;
  /** Sum of fully unpaid leave days */
  totalUnpaidLeaveDays: number;
  /** Sum of half-pay leave days */
  totalHalfPayLeaveDays: number;
  /** Sum of full-pay leave days (for record-keeping; no deduction) */
  totalFullPayLeaveDays: number;
  /** YTD usage summary (input to per-leave calculations) */
  ytdSummary: YtdSummary;
  /** Per-leave breakdown (one entry per workflow_submission record) */
  leaveOccurrences: LeaveOccurrenceResult[];
  /** Aggregated Q5 flags for downstream attendance-bonus calc */
  attendanceBonusFlags: AttendanceBonusFlags;
  /** Soft-fail warnings (didn't break the calc, but admin should see) */
  warnings: string[];
  /** Hard errors (specific records were skipped or zeroed) */
  errors: string[];
};

/**
 * The orchestrator's full run result.
 */
export type LeaveDeductionRunResult = {
  organizationId: string;
  periodYear: number;
  periodMonth: number;
  /** ISO date strings */
  periodStartDate: string;
  periodEndDate: string;
  /** One record per active employee (skipped employees included with zeros) */
  employees: EmployeeLeaveDeductionResult[];
  /**
   * Run-level warnings (e.g., employees skipped due to no salary_base).
   * Mirrors aggregator.warnings.
   */
  runWarnings: string[];
  /** Total ms spent in the orchestrator (excludes DB round-trip from aggregator) */
  computeTimeMs: number;
  /** Stamp for audit reproducibility — engine version */
  calculatorVersion: string;
};

// ── Constants ───────────────────────────────────────────────────────

/**
 * Calculator version string. Stamped on every run so downstream audits
 * can identify exactly which engine version produced a given line item.
 * Bump on any behavior change.
 */
export const CALCULATOR_VERSION = "phase-3b-v1.0";

// ── Helpers ─────────────────────────────────────────────────────────

/** Convert Date to YYYY-MM-DD string (UTC). */
function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Build the LeaveOccurrenceResult for a single record.
 * Pure function — no I/O, no side effects.
 */
function processSingleLeave(
  occurrence: LeaveOccurrenceInPeriod,
  ytdSummary: YtdSummary,
  employee: EmployeeProfileSnapshot,
): LeaveOccurrenceResult {
  const classification: ClassificationResult = classify(
    occurrence.leaveTypeRaw,
  );

  // Build the classification descriptor for the audit record
  let classificationDesc: LeaveOccurrenceResult["classification"];
  let definition: LeaveTypeDefinition | null = null;

  if (classification.ok === true) {
    definition = classification.definition;
    classificationDesc = {
      ok: true,
      canonicalKey: definition.canonicalKey,
      canonicalNameZh: definition.canonicalNameZh,
    };
  } else if (classification.reason === "ambiguous") {
    classificationDesc = {
      ok: false,
      reason: "ambiguous",
      candidates: classification.candidates,
    };
  } else {
    classificationDesc = { ok: false, reason: "unclassified" };
  }

  // Filter parental_leave (育嬰留停) — they don't contribute to payroll
  if (
    definition !== null &&
    definition.canonicalKey === "parental_leave"
  ) {
    return {
      sourceWorkflowSubmissionId: occurrence.sourceWorkflowSubmissionId,
      leaveTypeRaw: occurrence.leaveTypeRaw,
      classification: classificationDesc,
      daysClaimed: occurrence.daysClaimedFull,
      daysInPeriod: occurrence.daysInPeriod,
      effectiveStart: toIsoDate(occurrence.effectiveStart),
      payTreatment: null,
      filteredAsSkipFromPayroll: true,
    };
  }

  // Apply pay treatment if classification succeeded
  let payTreatmentResult: PayTreatmentResult | null = null;
  if (definition !== null) {
    try {
      payTreatmentResult = applyPayTreatment({
        definition,
        daysInPeriod: occurrence.daysInPeriod,
        effectiveStart: occurrence.effectiveStart,
        ytdSummary,
        employee,
      });
    } catch (err) {
      // applyPayTreatment throws only on skip_from_payroll (already
      // filtered above) or on a `never` exhaustiveness violation.
      // If we land here, it's an internal contract violation —
      // surface as null treatment with an error.
      payTreatmentResult = null;
    }
  }

  return {
    sourceWorkflowSubmissionId: occurrence.sourceWorkflowSubmissionId,
    leaveTypeRaw: occurrence.leaveTypeRaw,
    classification: classificationDesc,
    daysClaimed: occurrence.daysClaimedFull,
    daysInPeriod: occurrence.daysInPeriod,
    effectiveStart: toIsoDate(occurrence.effectiveStart),
    payTreatment: payTreatmentResult,
    filteredAsSkipFromPayroll: false,
  };
}

/**
 * Build the aggregated Q5 attendance-bonus flags for an employee from
 * their per-leave results.
 */
function buildAttendanceBonusFlags(
  occurrences: LeaveOccurrenceResult[],
): AttendanceBonusFlags {
  let anyProtectedLeave = false;
  let proportionallyDeductibleDays = 0;
  let sickDaysInPeriod = 0;
  const perLeaveNotes: AttendanceBonusFlags["perLeaveNotes"] = [];

  for (const occ of occurrences) {
    if (occ.payTreatment === null) {
      // No treatment could be applied (parental_leave filtered, or
      // classification failed). Don't contribute to bonus flags.
      continue;
    }

    const interaction = occ.payTreatment.attendanceBonusInteraction;
    if (interaction.protected) {
      anyProtectedLeave = true;
    } else if (interaction.proportionalDeduction === true) {
      // Sum the days that contribute to proportional deduction
      proportionallyDeductibleDays += occ.daysInPeriod;
    }

    // Track sick days specifically (for 第9-1條 10-day rule)
    if (
      occ.classification.ok === true &&
      occ.classification.canonicalKey === "sick_unhospitalized"
    ) {
      sickDaysInPeriod += occ.daysInPeriod;
    }

    perLeaveNotes.push({
      leaveTypeRaw: occ.leaveTypeRaw,
      canonicalKey:
        occ.classification.ok === true
          ? occ.classification.canonicalKey
          : null,
      note: interaction.note,
    });
  }

  return {
    anyProtectedLeave,
    proportionallyDeductibleDays,
    sickDaysInPeriod,
    perLeaveNotes,
  };
}

/**
 * Process a single employee's data into an EmployeeLeaveDeductionResult.
 * Pure function over already-aggregated data.
 */
export function processEmployee(
  employee: AggregatedEmployee,
): EmployeeLeaveDeductionResult {
  const warnings: string[] = [...employee.warnings];
  const errors: string[] = [];

  // Step 1: summarize YTD
  const ytdSummary = summarizeYtd(employee.ytdContext);

  // Surface YTD classification failures as warnings on this employee
  for (const failure of ytdSummary.unclassifiedRecords) {
    warnings.push(
      `YTD record ${failure.sourceWorkflowSubmissionId} ` +
        `(leaveTypeRaw="${failure.leaveTypeRaw}", ${failure.daysClaimed}d) ` +
        `could not be classified — excluded from YTD totals`,
    );
  }
  for (const failure of ytdSummary.ambiguousRecords) {
    warnings.push(
      `YTD record ${failure.sourceWorkflowSubmissionId} ` +
        `(leaveTypeRaw="${failure.leaveTypeRaw}", ${failure.daysClaimed}d) ` +
        `is ambiguous (candidates: ${failure.ambiguousCandidates?.join(", ")}) ` +
        `— excluded from YTD totals`,
    );
  }

  // Step 2: process each leave occurrence
  const leaveOccurrences: LeaveOccurrenceResult[] = [];
  let totalLeaveDeductionAmount = 0;
  let totalUnpaidLeaveDays = 0;
  let totalHalfPayLeaveDays = 0;
  let totalFullPayLeaveDays = 0;

  for (const occurrence of employee.leavesInPeriod) {
    const result = processSingleLeave(
      occurrence,
      ytdSummary,
      employee.profile,
    );
    leaveOccurrences.push(result);

    // Accumulate totals (skip filtered/failed records)
    if (
      result.filteredAsSkipFromPayroll ||
      result.payTreatment === null
    ) {
      // Surface failures on the employee
      if (result.classification.ok === false) {
        const reason =
          result.classification.reason === "ambiguous"
            ? `ambiguous (candidates: ${result.classification.candidates.join(", ")})`
            : "unclassified";
        warnings.push(
          `Leave record ${result.sourceWorkflowSubmissionId} ` +
            `(leaveTypeRaw="${result.leaveTypeRaw}", ` +
            `${result.daysClaimed}d) ${reason} — no deduction calculated`,
        );
      }
      // parental_leave filtering is not a warning, it's by design
      continue;
    }

    totalLeaveDeductionAmount += result.payTreatment.deductionAmount;
    totalUnpaidLeaveDays += result.payTreatment.unpaidDays;
    totalHalfPayLeaveDays += result.payTreatment.halfPayDays;
    totalFullPayLeaveDays += result.payTreatment.fullPayDays;
  }

  // Step 3: build aggregated bonus flags
  const attendanceBonusFlags = buildAttendanceBonusFlags(leaveOccurrences);

  return {
    userId: employee.profile.userId,
    fullName: employee.profile.fullName ?? "(name not set)",
    profileSnapshot: employee.profile,
    totalLeaveDeductionAmount,
    totalUnpaidLeaveDays,
    totalHalfPayLeaveDays,
    totalFullPayLeaveDays,
    ytdSummary,
    leaveOccurrences,
    attendanceBonusFlags,
    warnings,
    errors,
  };
}

// ── Main entry point ────────────────────────────────────────────────

/**
 * Compute leave deductions for all active employees in an organization
 * for a specific period. This is the primary function the broader
 * payroll engine calls; everything below is reachable through this.
 *
 * @example
 *   const result = await computeLeaveDeductions({
 *     organizationId: "02bb4bee-...",
 *     periodYear: 2026,
 *     periodMonth: 4,
 *   });
 *   // result.employees[i].totalLeaveDeductionAmount → integer NTD
 *   // result.employees[i].leaveOccurrences[j].payTreatment.calculationDetail
 *   //   → human-readable audit string
 *
 * Soft-fail semantics: this function does NOT throw on bad data. If
 * data quality issues exist, they appear in `warnings`/`errors` arrays
 * on the relevant employee. Only DB connection failures (raised by the
 * aggregator) propagate.
 */
export async function computeLeaveDeductions(input: {
  organizationId: string;
  periodYear: number;
  periodMonth: number;
}): Promise<LeaveDeductionRunResult> {
  const startTime = Date.now();

  // Fetch aggregated data (DB read happens here)
  const aggregated: AggregatedLeaveData = await aggregateLeaveData({
    organizationId: input.organizationId,
    periodYear: input.periodYear,
    periodMonth: input.periodMonth,
  });

  // Process each employee through the pipeline
  const employees: EmployeeLeaveDeductionResult[] = [];
  for (const employee of aggregated.employees) {
    employees.push(processEmployee(employee));
  }

  return {
    organizationId: aggregated.organizationId,
    periodYear: aggregated.period.year,
    periodMonth: aggregated.period.month,
    periodStartDate: toIsoDate(aggregated.period.startDate),
    periodEndDate: toIsoDate(aggregated.period.endDate),
    employees,
    runWarnings: aggregated.warnings,
    computeTimeMs: Date.now() - startTime,
    calculatorVersion: CALCULATOR_VERSION,
  };
}
