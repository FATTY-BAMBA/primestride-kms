// src/lib/payroll/attendanceBonusCalc.ts
//
// Atlas EIP — Attendance Bonus (全勤獎金) Deduction Calculator
// ──────────────────────────────────────────────────────────────────────
// Phase 3c implementation of Q5 from the Phase 3b legal review.
//
// LEGAL FRAMEWORK:
//
//   勞工請假規則 第9條 (existing):
//     雇主不得視為缺勤而影響其全勤獎金 — for the protected leave types:
//       婚假, 喪假, 公傷病假, 公假
//       prenancy <3mo miscarriage as 普通傷病假
//       家庭照顧事假 (per 第7條)
//
//   勞工請假規則 第9條第2項:
//     "勞工請前項第二款以外之普通傷病假，其全勤獎金之扣發，應按請普通傷
//      病假日數依比例計算" — non-protected 病假 uses proportional deduction
//
//   勞工請假規則 第9-1條 (effective 2026-01-01):
//     "勞工一年內請普通傷病假日數未超過十日者，雇主不得因勞工請普通傷
//      病假而為不利之處分" — first 10 days/year of 普通傷病假 are
//      protected from any 不利處分 including bonus deduction.
//
//   勞動部 官方 Q&A (mol.gov.tw 28162/28218):
//     "未超過10日，係指普通傷病假的實際請假日數；至於依其他法令已明定
//      不得為不利處分的假別，例如：性別平等工作法之生理假、安胎休養
//      請假等，並不列入該10日的計算範圍內"
//     → The 10-day budget counts PURE 病假 days only, NOT
//       生理假 (which has its own 性平法 第21條 protection).
//
// CALCULATION FORMULA (per 勞動部 Q&A worked example):
//   For each deductible leave day:
//     daily_bonus_deduction = attendance_bonus_monthly / 30
//   Total deduction = sum across all deductible days.
//
//   The /30 divisor matches Phase 3b's daily-rate convention. The 勞動部
//   example: NT$3,000 monthly bonus, 1 sick day → 3000/30 = NT$100 deduction.

import type { LeaveTypeDefinition } from "./leaveOntology";
import type { LeaveOccurrenceInPeriod, EmployeeProfileSnapshot } from "./leaveAggregator";
import type { YtdSummary } from "./ytdCaps";
import { classify } from "./leaveClassifier";

// ── Public types ─────────────────────────────────────────────────────

/**
 * Per-leave-occurrence breakdown of how the bonus deduction was computed.
 * One entry per deductible leave; protected leaves are also listed (with
 * deductedDays = 0) so the audit trail shows what was considered.
 */
export type AttendanceBonusBreakdownEntry = {
  /** workflow_submissions.id */
  sourceWorkflowSubmissionId: string;
  /** Raw leave type from the record */
  leaveTypeRaw: string;
  /** Resolved canonical key (or null if classification failed) */
  canonicalKey: string | null;
  /** Days falling in this period for this record */
  daysInPeriod: number;
  /** Days actually deductible (after applying protections) */
  deductibleDays: number;
  /** NTD deducted for this entry */
  deductedAmount: number;
  /**
   * Why the (non-)deduction happened — for audit. Always populated.
   * Example: "Protected (婚假; 勞工請假規則 第9條 §1)"
   * Example: "10-day 病假 budget exhausted (YTD pure 病假: 12d, this period: 3d, deductible: 3d)"
   */
  reason: string;
};

export type AttendanceBonusResult = {
  /** Original monthly bonus from profile */
  originalBonus: number;
  /** Total deduction applied (NTD, integer, half-up rounded) */
  totalDeduction: number;
  /** Bonus actually paid out = originalBonus - totalDeduction */
  netBonus: number;
  /** Per-leave breakdown for audit log */
  breakdown: AttendanceBonusBreakdownEntry[];
  /** Audit notes (e.g., zero-bonus skip, special edge cases) */
  notes: string[];
  /** Calculator version for reproducibility */
  calculatorVersion: string;
};

// ── Constants ────────────────────────────────────────────────────────

/**
 * The /30 divisor for daily proportional deduction.
 * Matches Phase 3b's daily-rate convention and the 勞動部 official Q&A
 * worked example (3000/30 × 1 day = 100 NTD).
 */
const DAILY_BONUS_DIVISOR = 30;

/**
 * Per 勞工請假規則 第9-1條 (effective 2026-01-01): the first 10 days/year
 * of 普通傷病假 are protected from 不利處分 including bonus deduction.
 */
const SICK_LEAVE_PROTECTION_DAYS_BUDGET = 10;

/**
 * Calculator version stamp for this module. Bumped on any behavioral
 * change (separate from leaveDeduction.CALCULATOR_VERSION since they
 * may evolve independently).
 */
export const ATTENDANCE_BONUS_CALCULATOR_VERSION = "phase-3c-v1.0";

// ── Helpers ──────────────────────────────────────────────────────────

/** Round half-up to integer NTD. Matches Phase 3b convention. */
function roundHalfUpToInt(amount: number): number {
  return Math.floor(amount + 0.5);
}

/**
 * For a given leave definition, determine the deduction policy.
 *
 * Returns:
 *   - 'protected': no deduction allowed for this leave type at all
 *   - 'sick_special': sick leave — apply the 10-day YTD budget rule
 *   - 'proportional': deduct by proportion (the default for non-protected)
 *   - 'unknown': unclassified record; skip with audit note (caller decides)
 */
type DeductionPolicy = "protected" | "sick_special" | "proportional" | "unknown";

function policyFor(definition: LeaveTypeDefinition): DeductionPolicy {
  const flag = definition.perfectAttendanceProtected;
  if (flag.protected) return "protected";
  if (definition.canonicalKey === "sick_unhospitalized") return "sick_special";
  if (flag.proportionalDeduction === true) return "proportional";
  // Defensive: ontology says not-protected but proportionalDeduction is
  // not explicitly true. Treat as proportional with audit note (safe default).
  return "proportional";
}

/**
 * Format a brief reason string for the audit breakdown entry.
 */
function reasonProtected(definition: LeaveTypeDefinition): string {
  const flag = definition.perfectAttendanceProtected;
  return `Protected (${definition.canonicalNameZh}; ${flag.legalBasis})`;
}

// ── Main calculator ──────────────────────────────────────────────────

/**
 * Compute the proportional attendance bonus deduction for an employee
 * based on their leaves in the current period.
 *
 * @param input.profile employee profile (provides attendanceBonusMonthly)
 * @param input.leaves leaves in the current period
 * @param input.ytdSummary YTD usage (used for 第9-1條 10-day 病假 budget)
 * @returns AttendanceBonusResult with total deduction and per-leave breakdown
 */
export function computeAttendanceBonusDeduction(input: {
  profile: EmployeeProfileSnapshot;
  leaves: ReadonlyArray<LeaveOccurrenceInPeriod>;
  ytdSummary: YtdSummary;
}): AttendanceBonusResult {
  const { profile, leaves, ytdSummary } = input;
  const bonus = profile.attendanceBonusMonthly;
  const breakdown: AttendanceBonusBreakdownEntry[] = [];
  const notes: string[] = [];

  // Fast path: no bonus configured → no deduction, no per-leave entries
  if (bonus <= 0) {
    return {
      originalBonus: bonus,
      totalDeduction: 0,
      netBonus: bonus,
      breakdown: [],
      notes:
        bonus === 0
          ? ["No attendance bonus configured for this employee (attendance_bonus_monthly = 0); deduction calculation skipped."]
          : [`Invalid attendance_bonus_monthly = ${bonus} (negative); treated as 0.`],
      calculatorVersion: ATTENDANCE_BONUS_CALCULATOR_VERSION,
    };
  }

  const dailyBonusRate = bonus / DAILY_BONUS_DIVISOR;

  // Track running budget consumption for sick leave's 10-day protection.
  // Start with whatever YTD pure-病假 days the employee has already used
  // (NOT including merged menstrual overflow — see 勞動部 Q&A).
  const ytdPureSickDays = ytdSummary.byCanonicalKey["sick_unhospitalized"] ?? 0;
  let sickProtectionRemaining = Math.max(
    0,
    SICK_LEAVE_PROTECTION_DAYS_BUDGET - ytdPureSickDays,
  );

  // Sort leaves deterministically so test results are stable
  const sortedLeaves = [...leaves].sort((a, b) => {
    const t = a.effectiveStart.getTime() - b.effectiveStart.getTime();
    if (t !== 0) return t;
    return a.sourceWorkflowSubmissionId.localeCompare(
      b.sourceWorkflowSubmissionId,
    );
  });

  let totalDeduction = 0;

  for (const leave of sortedLeaves) {
    const c = classify(leave.leaveTypeRaw);
    if (c.ok !== true) {
      // Unclassified — skip with note (no deduction applied since we
      // can't tell if it's protected). Conservative for the employee.
      breakdown.push({
        sourceWorkflowSubmissionId: leave.sourceWorkflowSubmissionId,
        leaveTypeRaw: leave.leaveTypeRaw,
        canonicalKey: null,
        daysInPeriod: leave.daysInPeriod,
        deductibleDays: 0,
        deductedAmount: 0,
        reason:
          `Unclassified leave (raw="${leave.leaveTypeRaw}"); ` +
          `no bonus deduction applied (conservative — unknown protection status)`,
      });
      continue;
    }

    const definition = c.definition;
    const policy = policyFor(definition);

    if (policy === "protected") {
      breakdown.push({
        sourceWorkflowSubmissionId: leave.sourceWorkflowSubmissionId,
        leaveTypeRaw: leave.leaveTypeRaw,
        canonicalKey: definition.canonicalKey,
        daysInPeriod: leave.daysInPeriod,
        deductibleDays: 0,
        deductedAmount: 0,
        reason: reasonProtected(definition),
      });
      continue;
    }

    if (policy === "sick_special") {
      // 普通傷病假 with 10-day YTD protection.
      // Determine how many days of THIS leave fall under remaining budget.
      const protectedHere = Math.min(leave.daysInPeriod, sickProtectionRemaining);
      const deductibleHere = leave.daysInPeriod - protectedHere;
      sickProtectionRemaining = Math.max(0, sickProtectionRemaining - protectedHere);

      if (deductibleHere === 0) {
        breakdown.push({
          sourceWorkflowSubmissionId: leave.sourceWorkflowSubmissionId,
          leaveTypeRaw: leave.leaveTypeRaw,
          canonicalKey: definition.canonicalKey,
          daysInPeriod: leave.daysInPeriod,
          deductibleDays: 0,
          deductedAmount: 0,
          reason:
            `Within 10-day 病假 protection budget (YTD pure 病假: ${ytdPureSickDays}d, ` +
            `protected here: ${protectedHere}d; per 勞工請假規則 第9-1條)`,
        });
        continue;
      }

      const deductedAmount = roundHalfUpToInt(
        deductibleHere * dailyBonusRate,
      );
      totalDeduction += deductedAmount;
      breakdown.push({
        sourceWorkflowSubmissionId: leave.sourceWorkflowSubmissionId,
        leaveTypeRaw: leave.leaveTypeRaw,
        canonicalKey: definition.canonicalKey,
        daysInPeriod: leave.daysInPeriod,
        deductibleDays: deductibleHere,
        deductedAmount,
        reason:
          protectedHere > 0
            ? `Partial 病假: ${protectedHere}d within 10-day protection (第9-1條), ` +
              `${deductibleHere}d deductible @ ${bonus}/30 = ${deductedAmount} NTD`
            : `病假 beyond 10-day budget (YTD pure 病假: ${ytdPureSickDays}d); ` +
              `${deductibleHere}d × ${bonus}/30 = ${deductedAmount} NTD`,
      });
      continue;
    }

    // policy === "proportional": 事假, etc.
    const deductedAmount = roundHalfUpToInt(
      leave.daysInPeriod * dailyBonusRate,
    );
    totalDeduction += deductedAmount;
    breakdown.push({
      sourceWorkflowSubmissionId: leave.sourceWorkflowSubmissionId,
      leaveTypeRaw: leave.leaveTypeRaw,
      canonicalKey: definition.canonicalKey,
      daysInPeriod: leave.daysInPeriod,
      deductibleDays: leave.daysInPeriod,
      deductedAmount,
      reason:
        `Proportional deduction for ${definition.canonicalNameZh}: ` +
        `${leave.daysInPeriod}d × ${bonus}/30 = ${deductedAmount} NTD ` +
        `(per 勞工請假規則 第9條第2項)`,
    });
  }

  // Sanity: deduction can never exceed the original bonus. Per 勞動部
  // explicit guidance, deduction must be PROPORTIONAL — capping at full
  // bonus prevents the calculator from accidentally producing negative
  // net bonus if some math edge case arises.
  if (totalDeduction > bonus) {
    notes.push(
      `Computed deduction ${totalDeduction} exceeds bonus ${bonus}; ` +
        `capped at bonus (proportional principle).`,
    );
    totalDeduction = bonus;
  }

  return {
    originalBonus: bonus,
    totalDeduction,
    netBonus: bonus - totalDeduction,
    breakdown,
    notes,
    calculatorVersion: ATTENDANCE_BONUS_CALCULATOR_VERSION,
  };
}
