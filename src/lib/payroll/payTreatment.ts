// src/lib/payroll/payTreatment.ts
//
// Atlas EIP — Pay Treatment Calculator
// ──────────────────────────────────────────────────────────────────────
// Phase 3b layer 3 of 4. Per-leave-occurrence calculator: takes a
// classified leave occurrence + employee profile + YTD context, applies
// the ontology's payTreatment.kind, returns a deduction amount with
// full audit detail.
//
// Pure function. No DB, no I/O. Same input → same output.
//
// Design principle: this is the ONLY place where money math touches
// labor law. Every payTreatment.kind variant has a clearly-attributed
// formula. Adding a new kind requires updating this switch.

import type { LeaveTypeDefinition, PayTreatment } from "./leaveOntology";
import type { YtdSummary } from "./ytdCaps";
import type { EmployeeProfileSnapshot } from "./leaveAggregator";

// ── Constants ────────────────────────────────────────────────────────

/**
 * LSA-strict daily rate divisor (Doc A § 4.2). The denominator is
 * calendar days, not work days, per common Taiwan labor convention.
 *
 * Phase 3c will allow per-org override (some companies use 30.4 or
 * actual workdays/month). For now this is fixed.
 */
const DAILY_RATE_DIVISOR = 30;

/**
 * 月內天數 / month for tenure calculation. Doc A § 4.3 specifies
 * calendar-day measurement: tenure_days = (leaveStart - hireDate) days.
 * Convert to months: divide by 30.4375 (= 365.25 / 12) for fractional
 * accuracy. For the LSA Art. 50 6-month threshold we round-trip via
 * a 6-month boundary date instead of months arithmetic — see
 * computeTenureSatisfies() below.
 */

// ── Public types ─────────────────────────────────────────────────────

export type PayTreatmentInput = {
  /** Resolved leave definition from the classifier */
  definition: LeaveTypeDefinition;
  /**
   * Days within the current period for THIS leave occurrence.
   * Source: leaveAggregator.LeaveOccurrenceInPeriod.daysInPeriod.
   */
  daysInPeriod: number;
  /** First calendar date of THIS leave occurrence (in this period) */
  effectiveStart: Date;
  /**
   * YTD usage summary computed BEFORE this leave occurrence.
   * Source: ytdCaps.summarizeYtd applied to the employee's YTD context.
   */
  ytdSummary: YtdSummary;
  /** Employee profile snapshot — used for tenure & insurance config */
  employee: EmployeeProfileSnapshot;
  /**
   * Optional chain context for continuous 病假 (Phase 3b.5 Step 6).
   * When provided, half_pay_with_ytd_cap applies the day-31+ rule per
   * 勞動部 勞動條3字第1120147882號函:
   *   - Days 1-30 are counted as WORKING DAYS only
   *   - Non-work days within days 1-30 are paid full per LSA Art. 39
   *   - From day 31 onward, ALL calendar days (incl. weekends/holidays)
   *     count toward the sick period and are unpaid
   *
   * The breakdown reflects only THIS record's portion of the chain that
   * intersects the current period. The orchestrator computes these via
   * continuousSickLeaveDetector + WorkingDayService.
   *
   * When omitted, the calculator falls back to legacy behavior
   * (treats daysInPeriod as all-uniform, no work-day distinction).
   * This keeps backward compatibility for non-sick leaves and for
   * tests that don't set up a working-day service.
   */
  chainContext?: {
    /** Work days in record's portion that fall in chain's days-1-30 region */
    workDaysInDays1To30: number;
    /**
     * Non-work days in record's portion that fall in chain's days-1-30
     * region. These are paid full per LSA Art. 39.
     */
    nonWorkDaysInDays1To30: number;
    /**
     * Calendar days in record's portion that fall in chain's day-31+
     * region. All unpaid per 函釋, regardless of work-day status.
     */
    calendarDaysInDay31Plus: number;
  };
};

export type PayTreatmentResult = {
  /** Integer NTD deduction amount (always >= 0) */
  deductionAmount: number;
  /** Days that were paid in full (no deduction) */
  fullPayDays: number;
  /** Days that were paid at half rate */
  halfPayDays: number;
  /** Days that were fully unpaid */
  unpaidDays: number;
  /** Effective payTreatment kind that was applied */
  treatmentKind: PayTreatment["kind"];
  /** Daily rate used for the calculation (NTD) — 0 if not applicable */
  dailyRateUsed: number;
  /** Human-readable explanation for audit log */
  calculationDetail: string;
  /** Additional notes for audit (cap-edge events, tenure decisions, etc.) */
  notes: string[];
  /**
   * Q5 audit flag — captures the attendance-bonus implications of this
   * leave type, so the orchestrator and the eventual Phase 3c attendance-
   * bonus calculator can use it. Phase 3b does NOT compute attendance bonus
   * deductions (no attendance_bonus column on profiles yet); this field
   * exposes the per-leave context for downstream use.
   *
   * Per 勞工請假規則 第9條 (and new 第9-1條 effective 2026-01-01):
   *   - protected: true → attendance bonus CANNOT be deducted for this leave
   *   - protected: false + proportionalDeduction: true → bonus deductible
   *     by proportion (NOT all-or-nothing)
   *   - 病假 has special 10-day per-year protection per 第9-1條 (cumulative
   *     YTD 病假 days ≤ 10 → no deduction allowed). The orchestrator is
   *     responsible for applying this YTD-aware logic; this field reports
   *     the leave-type-level rule only.
   */
  attendanceBonusInteraction: {
    /** True if attendance bonus deduction is forbidden for this leave type */
    protected: boolean;
    /**
     * For unprotected types: true means deduction must be by proportion
     * (e.g., 事假, 病假 beyond 10-day protection).
     * For protected types: null (no deduction allowed at all).
     */
    proportionalDeduction: boolean | null;
    /** Human-readable note for audit; cites legal basis */
    note: string;
  };
};

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Round half-up to integer NTD. Matches the existing deductionCalc
 * pattern used elsewhere in the payroll engine.
 */
function roundHalfUpToInt(amount: number): number {
  return Math.floor(amount + 0.5);
}

/**
 * Compute the daily rate for an employee. LSA-strict:
 *   dailyRate = salary_base / 30
 * Returns a float; rounding happens AFTER multiplication by days.
 */
export function computeDailyRate(salaryBase: number): number {
  return salaryBase / DAILY_RATE_DIVISOR;
}

/**
 * Determine if an employee's tenure ≥ N months as of a reference date.
 *
 * Approach (per Doc A § 4.3): compute the date that is exactly N
 * calendar months after hireDate, then test referenceDate >= that.
 *
 * Example: hireDate = 2024-01-15, N = 6
 *   threshold = 2024-07-15
 *   referenceDate 2024-07-14 → false (one day short)
 *   referenceDate 2024-07-15 → true (exactly meets)
 *   referenceDate 2024-07-16 → true (exceeds)
 *
 * This matches courts' common interpretation of LSA Art. 50's
 * "六個月" (six months) — calendar-month equivalence anchored on
 * the same day of the month.
 *
 * Edge case: if hireDate is the 31st and the threshold month has fewer
 * days (e.g., June, which has 30), Date.UTC normalizes by overflowing
 * (June 31 → July 1). This means an employee hired 2024-01-31 reaches
 * 6-month tenure threshold on 2024-08-01 (not 2024-07-31). This is
 * conservative (slightly delays qualification) and avoids ambiguity.
 */
export function computeTenureSatisfies(
  hireDate: Date,
  referenceDate: Date,
  thresholdMonths: number,
): boolean {
  const threshold = new Date(
    Date.UTC(
      hireDate.getUTCFullYear(),
      hireDate.getUTCMonth() + thresholdMonths,
      hireDate.getUTCDate(),
    ),
  );
  return referenceDate >= threshold;
}

/**
 * Build the Q5 attendance-bonus interaction summary for a leave type.
 *
 * Reads from the ontology's `perfectAttendanceProtected` flag and emits
 * a structured description. Phase 3b does not compute the actual bonus
 * deduction; this just exposes the per-leave-type rule for the
 * orchestrator and the eventual Phase 3c bonus calculator.
 *
 * Note on 病假 (sick_unhospitalized): the ontology marks it as
 * NOT protected with proportionalDeduction=true. But per 勞工請假規則
 * 第9-1條 (effective 2026-01-01), the FIRST 10 days/year are protected
 * from any attendance bonus deduction. That YTD-aware logic is the
 * orchestrator's responsibility — this helper reports only the
 * leave-type-level rule.
 */
function buildAttendanceBonusInteraction(
  definition: LeaveTypeDefinition,
): PayTreatmentResult["attendanceBonusInteraction"] {
  const flag = definition.perfectAttendanceProtected;
  const leaveLabel = definition.canonicalNameZh;

  if (flag.protected) {
    return {
      protected: true,
      proportionalDeduction: null,
      note:
        `Attendance bonus deduction NOT permitted for ${leaveLabel} ` +
        `(${flag.legalBasis}). Phase 3c attendance-bonus calculator ` +
        `will skip this leave type entirely.`,
    };
  }

  // Not protected — deduction is allowed but with rules
  const proportional = flag.proportionalDeduction === true;

  // Special-case 病假 (sick_unhospitalized) for the new 第9-1條 rule
  if (definition.canonicalKey === "sick_unhospitalized") {
    return {
      protected: false,
      proportionalDeduction: proportional,
      note:
        `Attendance bonus deduction permitted for ${leaveLabel} BY PROPORTION ` +
        `only, AND only for days exceeding the YTD 10-day protection per ` +
        `勞工請假規則 第9-1條 (effective 2026-01-01). Phase 3c calculator ` +
        `will apply YTD-aware logic.`,
    };
  }

  return {
    protected: false,
    proportionalDeduction: proportional,
    note:
      `Attendance bonus deduction permitted for ${leaveLabel} ` +
      `${proportional ? "BY PROPORTION only" : "(check ontology rules)"} ` +
      `(${flag.legalBasis}). Phase 3c calculator will apply.`,
  };
}

// ── The main calculator ────────────────────────────────────────────

/**
 * Apply the ontology's payTreatment to a leave occurrence.
 *
 * @throws if the leave's payTreatment is `skip_from_payroll` — the
 *         orchestrator must filter these BEFORE calling this function.
 *         Reaching this with skip_from_payroll is a contract violation.
 */
export function applyPayTreatment(input: PayTreatmentInput): PayTreatmentResult {
  const { definition, daysInPeriod, effectiveStart, ytdSummary, employee, chainContext } = input;

  // Compute Q5 audit-flag once; all return paths include it.
  const attendanceBonusInteraction = buildAttendanceBonusInteraction(definition);

  // Defensive: zero-or-negative days should never reach here.
  if (daysInPeriod <= 0) {
    return {
      deductionAmount: 0,
      fullPayDays: 0,
      halfPayDays: 0,
      unpaidDays: 0,
      treatmentKind: definition.payTreatment.kind,
      dailyRateUsed: 0,
      calculationDetail: `Zero-day leave: no calculation performed`,
      notes: [`daysInPeriod=${daysInPeriod} (zero or negative); treated as no-op`],
      attendanceBonusInteraction,
    };
  }

  const dailyRate = computeDailyRate(employee.salaryBase);
  const treatment = definition.payTreatment;

  switch (treatment.kind) {
    // ── full_pay: no deduction (婚假, 喪假, 公假, 陪產, 產檢, 補休, 特休) ──
    case "full_pay": {
      return {
        deductionAmount: 0,
        fullPayDays: daysInPeriod,
        halfPayDays: 0,
        unpaidDays: 0,
        treatmentKind: "full_pay",
        dailyRateUsed: dailyRate,
        calculationDetail:
          `${daysInPeriod} day(s) of ${definition.canonicalNameZh} ` +
          `at full pay → 0 NTD deduction`,
        notes: [],
        attendanceBonusInteraction,
      };
    }

    // ── unpaid: deduction = days × dailyRate (事假, 家庭照顧假) ──
    case "unpaid": {
      const deduction = roundHalfUpToInt(daysInPeriod * dailyRate);
      return {
        deductionAmount: deduction,
        fullPayDays: 0,
        halfPayDays: 0,
        unpaidDays: daysInPeriod,
        treatmentKind: "unpaid",
        dailyRateUsed: dailyRate,
        calculationDetail:
          `${daysInPeriod} day(s) of ${definition.canonicalNameZh} ` +
          `unpaid: ${daysInPeriod} × ${dailyRate.toFixed(2)} ` +
          `= ${deduction} NTD`,
        notes: [],
        attendanceBonusInteraction,
      };
    }

    // ── half_pay: deduction = days × dailyRate × 0.5 ──
    // Used by: menstrual_leave (in separate bucket), sick_hospitalized,
    //          pregnancy_rest_leave
    case "half_pay": {
      const deduction = roundHalfUpToInt(daysInPeriod * dailyRate * 0.5);
      return {
        deductionAmount: deduction,
        fullPayDays: 0,
        halfPayDays: daysInPeriod,
        unpaidDays: 0,
        treatmentKind: "half_pay",
        dailyRateUsed: dailyRate,
        calculationDetail:
          `${daysInPeriod} day(s) of ${definition.canonicalNameZh} ` +
          `at half pay: ${daysInPeriod} × ${dailyRate.toFixed(2)} × 0.5 ` +
          `= ${deduction} NTD`,
        notes: [],
        attendanceBonusInteraction,
      };
    }

    // ── half_pay_with_ytd_cap: 病假 (unhospitalized) — 30-day cap ──
    case "half_pay_with_ytd_cap": {
      // Per LSA Art. 4 § 3 + GEAW Art. 14:
      //   First 30 days/year (combined sick + menstrual overflow):
      //     工資折半發給 (half pay)
      //   Days 31+: thenTreatment (unpaid per ontology)
      //
      // The combined YTD bucket is ytdSummary.sickHalfPayDaysUsed.
      // ytdCaps already merged menstrual overflow into this number.

      const capDays = treatment.capDays;
      const ytdAlreadyUsed = ytdSummary.sickHalfPayDaysUsed;
      const remainingInCap = Math.max(0, capDays - ytdAlreadyUsed);

      // ── Chain-aware path (Phase 3b.5 Step 6) ──
      //
      // When chainContext is provided AND this is sick_unhospitalized,
      // apply the day-31+ rule from 勞動條3字第1120147882號函:
      //   - workDaysInDays1To30: candidates for half pay (subject to YTD cap)
      //   - nonWorkDaysInDays1To30: full pay per LSA Art. 39 (NOT counted)
      //   - calendarDaysInDay31Plus: ALL unpaid (incl. weekends)
      if (
        chainContext !== undefined &&
        definition.canonicalKey === "sick_unhospitalized"
      ) {
        const work1to30 = chainContext.workDaysInDays1To30;
        const nonWork1to30 = chainContext.nonWorkDaysInDays1To30;
        const cal31Plus = chainContext.calendarDaysInDay31Plus;

        // Apply YTD cap to days-1-30 work days
        const halfPayDays = Math.min(work1to30, remainingInCap);
        const cap1to30Beyond = work1to30 - halfPayDays;

        // Day-31+ region: all unpaid regardless of cap
        // Plus any work-day in days-1-30 that exceeded YTD cap
        const unpaidDays = cap1to30Beyond + cal31Plus;
        const fullPayDays = nonWork1to30; // per LSA Art. 39

        const halfPayDeduction = halfPayDays * dailyRate * 0.5;
        const unpaidDeduction = unpaidDays * dailyRate;
        const totalDeduction = roundHalfUpToInt(
          halfPayDeduction + unpaidDeduction,
        );

        const notes: string[] = [
          `Chain-aware sick leave (per 勞動部 勞動條3字第1120147882號函): ` +
            `record's portion contributes ${work1to30} work-day(s) + ` +
            `${nonWork1to30} non-work-day(s) in chain's days-1-30 region, ` +
            `${cal31Plus} calendar day(s) in chain's day-31+ region`,
        ];
        if (cap1to30Beyond > 0) {
          notes.push(
            `${cap1to30Beyond} day(s) exceed the ${capDays}-day annual cap ` +
              `(YTD used: ${ytdAlreadyUsed}); treated as unpaid`,
          );
        }
        if (cal31Plus > 0) {
          notes.push(
            `${cal31Plus} day(s) fall in chain's day-31+ region; per 函釋, ` +
              `all such days (incl. weekends/holidays) are unpaid`,
          );
        }

        const detailParts: string[] = [];
        if (halfPayDays > 0) {
          detailParts.push(
            `${halfPayDays} half-pay work-day(s) (within ${capDays}-day cap)`,
          );
        }
        if (fullPayDays > 0) {
          detailParts.push(
            `${fullPayDays} full-pay non-work-day(s) (LSA Art. 39, days 1-30)`,
          );
        }
        if (cap1to30Beyond > 0) {
          detailParts.push(`${cap1to30Beyond} unpaid (annual cap exhausted)`);
        }
        if (cal31Plus > 0) {
          detailParts.push(
            `${cal31Plus} unpaid calendar day(s) in day-31+ region`,
          );
        }

        const detail =
          `${daysInPeriod} day(s) of ${definition.canonicalNameZh} via chain rule: ` +
          detailParts.join(" + ") +
          ` → ${totalDeduction} NTD deduction`;

        return {
          deductionAmount: totalDeduction,
          fullPayDays,
          halfPayDays,
          unpaidDays,
          treatmentKind: "half_pay_with_ytd_cap",
          dailyRateUsed: dailyRate,
          calculationDetail: detail,
          notes,
          attendanceBonusInteraction,
        };
      }

      // ── Legacy path: no chain context, treat daysInPeriod uniformly ──

      const halfPayDays = Math.min(daysInPeriod, remainingInCap);
      const beyondCapDays = daysInPeriod - halfPayDays;

      // Apply thenTreatment for beyondCapDays (currently always 'unpaid')
      let beyondCapDeduction = 0;
      let unpaidDays = 0;
      const notes: string[] = [];

      if (treatment.thenTreatment.kind === "unpaid") {
        beyondCapDeduction = beyondCapDays * dailyRate;
        unpaidDays = beyondCapDays;
      } else {
        // Defensive: if a future ontology adds another thenTreatment kind,
        // surface it loudly in the audit trail rather than silently
        // miscalculating.
        notes.push(
          `WARNING: unsupported thenTreatment kind ` +
            `'${treatment.thenTreatment.kind}'; treated as unpaid for safety`,
        );
        beyondCapDeduction = beyondCapDays * dailyRate;
        unpaidDays = beyondCapDays;
      }

      const halfPayDeduction = halfPayDays * dailyRate * 0.5;
      const totalDeduction = roundHalfUpToInt(
        halfPayDeduction + beyondCapDeduction,
      );

      // Audit notes for cap-edge events
      if (beyondCapDays > 0) {
        notes.push(
          `${beyondCapDays} day(s) exceed the ${capDays}-day annual ` +
            `half-pay cap (YTD already used: ${ytdAlreadyUsed}); ` +
            `treated as unpaid`,
        );
      }
      if (ytdAlreadyUsed >= capDays) {
        notes.push(
          `Employee has already exhausted the ${capDays}-day half-pay ` +
            `cap before this period; all current days are unpaid`,
        );
      }

      const detail =
        halfPayDays > 0 && beyondCapDays > 0
          ? `${halfPayDays} day(s) at half pay (within ${capDays}-day cap, ` +
            `YTD used: ${ytdAlreadyUsed}) + ${beyondCapDays} day(s) unpaid ` +
            `(beyond cap): ${halfPayDays} × ${dailyRate.toFixed(2)} × 0.5 ` +
            `+ ${beyondCapDays} × ${dailyRate.toFixed(2)} = ${totalDeduction} NTD`
          : halfPayDays > 0
            ? `${halfPayDays} day(s) of ${definition.canonicalNameZh} at half pay ` +
              `(within ${capDays}-day cap; YTD used: ${ytdAlreadyUsed}): ` +
              `${halfPayDays} × ${dailyRate.toFixed(2)} × 0.5 = ${totalDeduction} NTD`
            : `${beyondCapDays} day(s) of ${definition.canonicalNameZh} unpaid ` +
              `(${capDays}-day cap exhausted, YTD used: ${ytdAlreadyUsed}): ` +
              `${beyondCapDays} × ${dailyRate.toFixed(2)} = ${totalDeduction} NTD`;

      return {
        deductionAmount: totalDeduction,
        fullPayDays: 0,
        halfPayDays,
        unpaidDays,
        treatmentKind: "half_pay_with_ytd_cap",
        dailyRateUsed: dailyRate,
        calculationDetail: detail,
        notes,
        attendanceBonusInteraction,
      };
    }

    // ── tenure_dependent: 產假 — 6mo+ full pay, <6mo half pay ──
    case "tenure_dependent": {
      if (!employee.hireDate) {
        // Defensive: maternity without hire_date can't be calculated.
        // Fail safe: treat as unpaid with a loud note. Orchestrator
        // should surface this and prompt admin.
        const fallbackDeduction = roundHalfUpToInt(daysInPeriod * dailyRate);
        return {
          deductionAmount: fallbackDeduction,
          fullPayDays: 0,
          halfPayDays: 0,
          unpaidDays: daysInPeriod,
          treatmentKind: "tenure_dependent",
          dailyRateUsed: dailyRate,
          calculationDetail:
            `${daysInPeriod} day(s) of ${definition.canonicalNameZh} ` +
            `treated as unpaid: hire_date missing, cannot determine tenure. ` +
            `${daysInPeriod} × ${dailyRate.toFixed(2)} = ${fallbackDeduction} NTD`,
          notes: [
            `WARNING: employee has no hire_date; LSA Art. 50 tenure ` +
              `eligibility cannot be determined. Treated as unpaid; ` +
              `please add hire_date and re-run.`,
          ],
          attendanceBonusInteraction,
        };
      }

      const meets = computeTenureSatisfies(
        employee.hireDate,
        effectiveStart,
        treatment.ifTenureMonthsAtLeast,
      );

      if (meets) {
        return {
          deductionAmount: 0,
          fullPayDays: daysInPeriod,
          halfPayDays: 0,
          unpaidDays: 0,
          treatmentKind: "tenure_dependent",
          dailyRateUsed: dailyRate,
          calculationDetail:
            `${daysInPeriod} day(s) of ${definition.canonicalNameZh} ` +
            `at full pay (tenure ≥ ${treatment.ifTenureMonthsAtLeast} months: ` +
            `hired ${employee.hireDate.toISOString().split("T")[0]}, leave ` +
            `started ${effectiveStart.toISOString().split("T")[0]}) → 0 NTD`,
          notes: [],
          attendanceBonusInteraction,
        };
      } else {
        // Half pay (deduction = days × dailyRate × 0.5)
        const deduction = roundHalfUpToInt(daysInPeriod * dailyRate * 0.5);
        return {
          deductionAmount: deduction,
          fullPayDays: 0,
          halfPayDays: daysInPeriod,
          unpaidDays: 0,
          treatmentKind: "tenure_dependent",
          dailyRateUsed: dailyRate,
          calculationDetail:
            `${daysInPeriod} day(s) of ${definition.canonicalNameZh} ` +
            `at half pay (tenure < ${treatment.ifTenureMonthsAtLeast} months: ` +
            `hired ${employee.hireDate.toISOString().split("T")[0]}, leave ` +
            `started ${effectiveStart.toISOString().split("T")[0]}): ` +
            `${daysInPeriod} × ${dailyRate.toFixed(2)} × 0.5 = ${deduction} NTD`,
          notes: [
            `LSA Art. 50: employee tenure < ${treatment.ifTenureMonthsAtLeast} ` +
              `months at leave start, so 工資減半發給 applies`,
          ],
          attendanceBonusInteraction,
        };
      }
    }

    // ── employer_full_pay_with_insurance_offset: 公傷病假 ──
    // Per LSA Art. 59: employer pays full salary; can offset by labor
    // insurance benefit received. For payroll deduction purposes,
    // deduction = 0. Insurance offset is an accounting entry handled
    // outside the payroll calculation.
    case "employer_full_pay_with_insurance_offset": {
      return {
        deductionAmount: 0,
        fullPayDays: daysInPeriod,
        halfPayDays: 0,
        unpaidDays: 0,
        treatmentKind: "employer_full_pay_with_insurance_offset",
        dailyRateUsed: dailyRate,
        calculationDetail:
          `${daysInPeriod} day(s) of ${definition.canonicalNameZh} ` +
          `(LSA Art. 59): employer pays full salary; insurance offset ` +
          `handled separately → 0 NTD payroll deduction`,
        notes: [
          `Note: any 勞工保險職業傷病給付 received by the employee should ` +
            `be tracked separately as an insurance offset against the ` +
            `employer's wage payment. This is not reflected in the ` +
            `payroll deduction.`,
        ],
        attendanceBonusInteraction,
      };
    }

    // ── menstrual_leave_treatment: 生理假 — three-bucket logic ──
    // Per GEAW Art. 14 + 勞動部 函釋 勞動條4字第1040131594號令 (104年9月8日):
    //
    //   Bucket 1 (separate, first 3 days/year):
    //     ALWAYS half pay, regardless of sick cap. Doesn't count
    //     toward the 30-day shared cap.
    //
    //   Bucket 2 (merged with sick, days 4+ within shared cap):
    //     Half pay if combined sick+menstrual_overflow ≤ 30 days.
    //     Counts INTO the 30-day cap (already reflected in
    //     ytdSummary.sickHalfPayDaysUsed by ytdCaps.summarizeYtd).
    //
    //   Bucket 3 (beyond combined 33-day ceiling):
    //     thenTreatment — currently `unpaid`. Per 函釋: "雇主應給假，
    //     但得不給薪" (employer must grant leave but may pay nothing).
    //
    // The bucket assignment is determined by:
    //   - menstrualSeparateDaysUsed: how much of bucket 1 is already used
    //   - sickHalfPayDaysUsed: how much of the shared 30-day cap is used
    //     (this includes prior menstrual overflow merged in by ytdCaps)
    case "menstrual_leave_treatment": {
      const separateBucketDays = treatment.separateBucketDays;
      const sharedCapDays = treatment.sharedCapDays;

      // How much room remains in bucket 1 (separate)?
      const separateRoom = Math.max(
        0,
        separateBucketDays - ytdSummary.menstrualSeparateDaysUsed,
      );
      const bucket1Days = Math.min(daysInPeriod, separateRoom);

      // After filling bucket 1, what's left flows toward bucket 2 (merged cap)?
      const afterBucket1 = daysInPeriod - bucket1Days;
      const capRoom = Math.max(
        0,
        sharedCapDays - ytdSummary.sickHalfPayDaysUsed,
      );
      const bucket2Days = Math.min(afterBucket1, capRoom);

      // Anything beyond falls into bucket 3 (thenTreatment)
      const bucket3Days = daysInPeriod - bucket1Days - bucket2Days;

      // Buckets 1 and 2 both pay half — combine them
      const halfPayDays = bucket1Days + bucket2Days;

      // Apply thenTreatment to bucket 3 (currently always 'unpaid')
      const notes: string[] = [];
      let bucket3Deduction = 0;
      let unpaidDays = 0;

      if (bucket3Days > 0) {
        if (treatment.thenTreatment.kind === "unpaid") {
          bucket3Deduction = bucket3Days * dailyRate;
          unpaidDays = bucket3Days;
        } else {
          // Defensive: future ontology change to thenTreatment kind
          notes.push(
            `WARNING: unsupported thenTreatment kind ` +
              `'${treatment.thenTreatment.kind}'; treated as unpaid for safety`,
          );
          bucket3Deduction = bucket3Days * dailyRate;
          unpaidDays = bucket3Days;
        }

        notes.push(
          `${bucket3Days} day(s) of 生理假 fall beyond the combined ` +
            `${separateBucketDays + sharedCapDays}-day ceiling ` +
            `(${separateBucketDays} separate + ${sharedCapDays} shared cap; ` +
            `YTD: ${ytdSummary.menstrualSeparateDaysUsed} separate, ` +
            `${ytdSummary.sickHalfPayDaysUsed} sick+overflow). ` +
            `Per 勞動部 函釋 勞動條4字第1040131594號: employer must grant ` +
            `the leave but may pay nothing for these days.`,
        );
      }

      const halfPayDeduction = halfPayDays * dailyRate * 0.5;
      const totalDeduction = roundHalfUpToInt(
        halfPayDeduction + bucket3Deduction,
      );

      // Build informative calculation_detail
      const detailParts: string[] = [];
      if (bucket1Days > 0) {
        detailParts.push(
          `${bucket1Days} day(s) in separate bucket (first 3 days/year, half pay)`,
        );
      }
      if (bucket2Days > 0) {
        detailParts.push(
          `${bucket2Days} day(s) merged with sick cap (half pay; YTD sick+overflow: ${ytdSummary.sickHalfPayDaysUsed})`,
        );
      }
      if (bucket3Days > 0) {
        detailParts.push(`${bucket3Days} day(s) beyond cap (unpaid)`);
      }

      const detail =
        `${daysInPeriod} day(s) of 生理假: ` +
        detailParts.join(" + ") +
        ` → ${totalDeduction} NTD deduction`;

      return {
        deductionAmount: totalDeduction,
        fullPayDays: 0,
        halfPayDays,
        unpaidDays,
        treatmentKind: "menstrual_leave_treatment",
        dailyRateUsed: dailyRate,
        calculationDetail: detail,
        notes,
        attendanceBonusInteraction,
      };
    }

    // ── skip_from_payroll: 育嬰留停 — caller must filter ──
    case "skip_from_payroll": {
      throw new Error(
        `[payTreatment] Received ${definition.canonicalKey} (kind=skip_from_payroll). ` +
          `The orchestrator must filter employees with parental_leave records ` +
          `from the payroll run BEFORE calling applyPayTreatment.`,
      );
    }

    // ── Exhaustiveness check ──
    default: {
      // TypeScript should make this unreachable, but defensive coding
      // catches the case where a new payTreatment.kind is added to the
      // ontology without updating this switch.
      const _exhaustive: never = treatment;
      throw new Error(
        `[payTreatment] Unhandled payTreatment kind: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
}
