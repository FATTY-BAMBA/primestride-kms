// src/lib/payroll/leaveAggregator.ts
//
// Atlas EIP — Leave Data Aggregator
// ──────────────────────────────────────────────────────────────────────
// Phase 3b layer 1 of 4. Reads raw data from Supabase and assembles a
// per-employee, per-period view that the rest of the calculator consumes.
//
// Pure read-only function. No deductions computed, no classifications
// applied, no DB writes.
//
// Inputs:  organizationId, periodYear, periodMonth
// Outputs: AggregatedLeaveData — all employees in scope plus their leaves
//          intersected with the period.
//
// Used by: leaveDeduction.ts (Phase 3b layer 4) — orchestrator calls this
//          first, then feeds the result through classifier → ytdCaps →
//          payTreatment.

import { adminClient } from "../supabase/admin";

// ── Period helpers ───────────────────────────────────────────────────

/**
 * Returns inclusive [startDate, endDate] for a given payroll period.
 * Uses UTC midnight to avoid TZ drift.
 *
 * @example
 *   periodBoundaries(2026, 4)
 *   // → { startDate: 2026-04-01T00:00:00Z, endDate: 2026-04-30T00:00:00Z }
 */
export function periodBoundaries(
  year: number,
  month: number,
): { startDate: Date; endDate: Date } {
  if (month < 1 || month > 12) {
    throw new Error(
      `[leaveAggregator] Invalid month ${month}; must be 1..12`,
    );
  }
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  // last day = day 0 of next month
  const endDate = new Date(Date.UTC(year, month, 0));
  return { startDate, endDate };
}

/**
 * Returns the inclusive number of calendar days between two dates.
 * @example daysBetween(2026-04-01, 2026-04-30) → 30
 */
export function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  // Add 1 because the range is inclusive on both ends
  return Math.round(ms / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Returns the intersection of [start1, end1] and [start2, end2], or null
 * if they don't overlap.
 */
function intersectRanges(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
): { start: Date; end: Date } | null {
  const start = start1 > start2 ? start1 : start2;
  const end = end1 < end2 ? end1 : end2;
  if (end < start) return null;
  return { start, end };
}

/**
 * Apportion a leave's `daysClaimed` to a specific fiscal year when the
 * leave spans a year boundary.
 *
 * LEGAL BASIS (verbatim from 勞動部 函釋):
 *   "病假之一年，係以曆年計算，非以勞工到職日起算" (calendar year)
 *   "若勞工跨年請假，應分年計算，並依各年度上限分別適用"
 *   (year-spanning leaves are calculated separately by year, with each
 *    year's limit applied independently)
 *   — 勞動2字第41739號函 + 民法第123條
 *
 * APPORTIONMENT METHOD: calendar-day count.
 *   For a leave from Dec 28, 2025 to Jan 5, 2026 (9 calendar days):
 *     - 4 days fall in 2025 (Dec 28-31)
 *     - 5 days fall in 2026 (Jan 1-5)
 *   When apportioning to fiscal year 2026, this function returns
 *   { apportionedDays: 5, splitForYearBoundary: true, ... }
 *
 * EDGE CASES:
 *   - Leave entirely within fiscal year → apportionedDays = original
 *     daysClaimed, splitForYearBoundary = false
 *   - Leave entirely outside fiscal year → apportionedDays = 0,
 *     splitForYearBoundary = false (caller should filter these out)
 *   - daysClaimed != calendar span (e.g., half-day leaves with
 *     daysClaimed=0.5 across 1 calendar day): we proportionally
 *     scale: apportionedDays = daysClaimed * (overlap / totalSpan)
 *
 * @param originalStart leave's actual start date (may be in prior year)
 * @param originalEnd leave's actual end date (may be in following year)
 * @param originalDaysClaimed days as recorded on workflow_submission
 * @param fiscalYear the calendar year to apportion to (e.g., 2026)
 * @returns apportionment result; if apportionedDays is 0, caller should skip
 */
export function apportionDaysToFiscalYear(
  originalStart: Date,
  originalEnd: Date,
  originalDaysClaimed: number,
  fiscalYear: number,
): {
  apportionedDays: number;
  splitForYearBoundary: boolean;
  fiscalYearStart: Date;
  fiscalYearEnd: Date;
} {
  // Fiscal year boundaries: [Jan 1 00:00 UTC, Jan 1 next year 00:00 UTC)
  const fiscalYearStart = new Date(Date.UTC(fiscalYear, 0, 1));
  const fiscalYearEnd = new Date(Date.UTC(fiscalYear + 1, 0, 1));

  // Treat fiscal year as [start, end_exclusive). The leave end_date is
  // inclusive (a leave ending Dec 31 occupies that day). For interval
  // math, treat the leave as [start, end + 1 day) too.
  const leaveStartTs = originalStart.getTime();
  // Add 1 day to make end exclusive
  const leaveEndExclusiveTs =
    originalEnd.getTime() + 24 * 60 * 60 * 1000;

  const fyStartTs = fiscalYearStart.getTime();
  const fyEndTs = fiscalYearEnd.getTime();

  // Overlap of [leaveStart, leaveEndExclusive) and [fyStart, fyEnd)
  const overlapStartTs = Math.max(leaveStartTs, fyStartTs);
  const overlapEndTs = Math.min(leaveEndExclusiveTs, fyEndTs);

  if (overlapEndTs <= overlapStartTs) {
    // No overlap — leave entirely outside this fiscal year
    return {
      apportionedDays: 0,
      splitForYearBoundary: false,
      fiscalYearStart,
      fiscalYearEnd,
    };
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const overlapCalendarDays = Math.round((overlapEndTs - overlapStartTs) / dayMs);
  const totalCalendarDays = Math.round(
    (leaveEndExclusiveTs - leaveStartTs) / dayMs,
  );

  // Did the leave straddle the fiscal year boundary?
  const splitForYearBoundary =
    leaveStartTs < fyStartTs || leaveEndExclusiveTs > fyEndTs;

  // Apportion daysClaimed proportionally.
  // Common case: daysClaimed === totalCalendarDays (whole days)
  //   → apportionedDays = overlapCalendarDays exactly
  // Edge case: half-day record (daysClaimed = 0.5, totalCalendar = 1)
  //   → apportionedDays = 0.5 * (overlap/total)
  // Edge case: daysClaimed > totalCalendar (data anomaly, very rare)
  //   → still proportional
  let apportionedDays: number;
  if (originalDaysClaimed === totalCalendarDays) {
    apportionedDays = overlapCalendarDays;
  } else {
    apportionedDays =
      (originalDaysClaimed * overlapCalendarDays) / totalCalendarDays;
  }

  return {
    apportionedDays,
    splitForYearBoundary,
    fiscalYearStart,
    fiscalYearEnd,
  };
}

// ── Public types ─────────────────────────────────────────────────────

/**
 * Snapshot of an employee's profile at the time of payroll calculation.
 * These values flow directly into payroll.line_items snapshot columns.
 *
 * All numeric fields are integers (whole NTD) per Atlas convention.
 */
export type EmployeeProfileSnapshot = {
  // Identity
  userId: string;
  fullName: string | null;
  nationalId: string | null;
  employeeId: string | null;
  department: string | null;
  jobTitle: string | null;

  // Compensation
  salaryBase: number;
  salaryCurrency: string; // typically 'TWD'

  // Insurance config
  laborInsuredSalary: number | null;
  nhiInsuredSalary: number | null;
  pensionContributionWage: number | null;
  voluntaryPensionRate: number; // e.g., 0.06 for 6%
  nhiDependents: number;

  // Banking (for snapshot; not used in calc)
  bankCode: string | null;
  bankAccount: string | null;

  // Eligibility-relevant
  hireDate: Date | null;
  gender: string | null; // for menstrual leave eligibility check
  terminationDate: Date | null;
};

/**
 * A single leave occurrence as it pertains to the current payroll period.
 * If a leave spans multiple periods, this represents only the portion
 * intersecting THIS period.
 *
 * The full original leave is traceable via sourceWorkflowSubmissionId.
 */
export type LeaveOccurrenceInPeriod = {
  /** workflow_submissions.id */
  sourceWorkflowSubmissionId: string;
  /** form_data.leave_type — passed to classifier downstream */
  leaveTypeRaw: string;
  /** form_data.days — total days as submitted (across all periods) */
  daysClaimedFull: number;
  /** Days in THIS period after intersection */
  daysInPeriod: number;
  /** form_data.duration_type, e.g., 'full_day' / 'half_day' / 'hourly' */
  durationType: string | null;
  /** form_data.hours_requested for hourly leaves */
  hoursRequested: number | null;
  /** form_data.reason — preserved for audit */
  reason: string | null;
  /** Original leave start date (may be before period start) */
  originalStart: Date;
  /** Original leave end date (may be after period end) */
  originalEnd: Date;
  /** Effective start within period (max(originalStart, period.startDate)) */
  effectiveStart: Date;
  /** Effective end within period (min(originalEnd, period.endDate)) */
  effectiveEnd: Date;
  /** True if this leave spans beyond this period in either direction */
  spansBeyondPeriod: boolean;
  /** Approval timestamp from workflow_submissions */
  approvedAt: Date | null;
};

/**
 * Year-to-date context: every approved leave record from Jan 1 of the
 * payroll year up to (but NOT including) the current period start.
 *
 * The aggregator returns RAW records, not classified or summed by type.
 * Classification + summation happens in ytdCaps.ts (next layer) so that
 * this layer remains pure read+structure.
 */
export type YtdContext = {
  /** First moment of the YTD window (Jan 1 of payroll year, UTC) */
  windowStart: Date;
  /** First moment of the current period (exclusive upper bound for YTD) */
  windowEnd: Date;
  /** All approved leaves in [windowStart, windowEnd) for this employee */
  rawRecords: Array<{
    sourceWorkflowSubmissionId: string;
    leaveTypeRaw: string;
    daysClaimed: number;
    startDate: Date;
    endDate: Date;
    durationType: string | null;
    /**
     * True when this YTD record was apportioned from a leave that
     * straddled the fiscal year boundary. The `daysClaimed` here
     * reflects only the days falling in this fiscal year, not the
     * original record's full count. The sourceWorkflowSubmissionId
     * still links back to the original record for audit.
     */
    splitForYearBoundary?: boolean;
  }>;
};

export type AggregatedEmployee = {
  profile: EmployeeProfileSnapshot;
  isActive: boolean;
  ytdContext: YtdContext;
  leavesInPeriod: LeaveOccurrenceInPeriod[];
  /** Data quality issues encountered while aggregating this employee */
  warnings: string[];
};

export type AggregatedLeaveData = {
  organizationId: string;
  period: {
    year: number;
    month: number;
    startDate: Date;
    endDate: Date;
    daysInMonth: number;
  };
  employees: AggregatedEmployee[];
  /** Aggregator-level warnings not tied to a specific employee */
  warnings: string[];
};

// ── Internal: shape of rows from Supabase ────────────────────────────

type ProfileRow = {
  id: string;
  full_name: string | null;
  national_id: string | null;
  employee_id: string | null;
  department: string | null;
  job_title: string | null;
  salary_base: number | null;
  salary_currency: string | null;
  labor_insured_salary: number | null;
  nhi_insured_salary: number | null;
  pension_contribution_wage: number | null;
  voluntary_pension_rate: number | null;
  nhi_dependents: number | null;
  bank_code: string | null;
  bank_account: string | null;
  hire_date: string | null;
  gender: string | null;
  termination_date: string | null;
};

type MembershipRow = {
  user_id: string;
  is_active: boolean | null;
};

type WorkflowSubmissionRow = {
  id: string;
  submitted_by: string;
  status: string;
  reviewed_at: string | null;
  form_data: {
    days?: number | string;
    leave_type?: string;
    start_date?: string;
    end_date?: string;
    duration_type?: string;
    hours_requested?: number | string | null;
    reason?: string;
  } | null;
};

// ── Helper: parse YYYY-MM-DD to UTC Date ─────────────────────────────

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  // Accept YYYY-MM-DD or full ISO string
  const dateStr = s.length === 10 ? s + "T00:00:00Z" : s;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d;
}

function parseNumberLoose(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ── Main entry point ─────────────────────────────────────────────────

/**
 * Aggregate all leave-relevant data for an organization's payroll period.
 *
 * Reads:
 *   - public.profiles (employee identity + compensation)
 *   - public.organization_members (active status)
 *   - public.workflow_submissions (approved leave records — both YTD
 *     window and current period)
 *
 * Returns AggregatedLeaveData with one entry per active employee, even
 * if they have no leaves in the period (the calculator still needs to
 * pay them).
 *
 * Throws on infrastructure errors (DB connection, schema mismatch).
 * Surfaces data quality issues as warnings (not exceptions) so the
 * caller can decide whether to proceed or escalate.
 */
export async function aggregateLeaveData(input: {
  organizationId: string;
  periodYear: number;
  periodMonth: number;
}): Promise<AggregatedLeaveData> {
  const { organizationId, periodYear, periodMonth } = input;

  if (!organizationId) {
    throw new Error("[leaveAggregator] organizationId is required");
  }

  const { startDate: periodStart, endDate: periodEnd } = periodBoundaries(
    periodYear,
    periodMonth,
  );
  const daysInMonth = daysBetween(periodStart, periodEnd);
  const windowStart = new Date(Date.UTC(periodYear, 0, 1));
  const windowEnd = periodStart; // exclusive — current period not in YTD

  const client = adminClient();
  const orgWarnings: string[] = [];

  // ── 1. Fetch active organization members ──
  const { data: members, error: memberErr } = await client
    .from("organization_members")
    .select("user_id, is_active")
    .eq("organization_id", organizationId);

  if (memberErr) {
    throw new Error(
      `[leaveAggregator] Failed to fetch organization_members: ${memberErr.message}`,
    );
  }

  const memberRows = (members ?? []) as unknown as MembershipRow[];
  const activeUserIds = memberRows
    .filter((m) => m.is_active !== false) // null = treat as active (defensive)
    .map((m) => m.user_id);

  if (activeUserIds.length === 0) {
    return {
      organizationId,
      period: {
        year: periodYear,
        month: periodMonth,
        startDate: periodStart,
        endDate: periodEnd,
        daysInMonth,
      },
      employees: [],
      warnings: ["No active organization members found"],
    };
  }

  // ── 2. Fetch profiles for those users ──
  const { data: profiles, error: profileErr } = await client
    .from("profiles")
    .select(
      "id, full_name, national_id, employee_id, department, job_title, " +
        "salary_base, salary_currency, labor_insured_salary, nhi_insured_salary, " +
        "pension_contribution_wage, voluntary_pension_rate, nhi_dependents, " +
        "bank_code, bank_account, hire_date, gender, termination_date",
    )
    .in("id", activeUserIds);

  if (profileErr) {
    throw new Error(
      `[leaveAggregator] Failed to fetch profiles: ${profileErr.message}`,
    );
  }

  const profileRows = (profiles ?? []) as unknown as ProfileRow[];
  const profileById = new Map<string, ProfileRow>();
  for (const p of profileRows) profileById.set(p.id, p);

  // ── 3. Fetch ALL approved leave submissions in the YTD window ──
  //    (period start through period end is included; YTD excludes the
  //     current period). One query, partitioned client-side.
  const { data: leaves, error: leaveErr } = await client
    .from("workflow_submissions")
    .select("id, submitted_by, status, reviewed_at, form_data")
    .eq("organization_id", organizationId)
    .eq("form_type", "leave")
    .eq("status", "approved")
    .in("submitted_by", activeUserIds);

  if (leaveErr) {
    throw new Error(
      `[leaveAggregator] Failed to fetch leave submissions: ${leaveErr.message}`,
    );
  }

  const leaveRows = (leaves ?? []) as unknown as WorkflowSubmissionRow[];

  // ── 4. Per-employee assembly ──
  const employees: AggregatedEmployee[] = [];

  for (const userId of activeUserIds) {
    const profile = profileById.get(userId);

    if (!profile) {
      orgWarnings.push(
        `User ${userId} is in organization_members but has no profile row; skipped`,
      );
      continue;
    }

    if (profile.salary_base === null) {
      orgWarnings.push(
        `User ${userId} (${profile.full_name ?? "unnamed"}) has no salary_base; skipped`,
      );
      continue;
    }

    const hireDate = parseDate(profile.hire_date);
    const terminationDate = parseDate(profile.termination_date);

    // Skip if terminated on or before period start
    if (terminationDate && terminationDate <= periodStart) {
      orgWarnings.push(
        `User ${userId} (${profile.full_name ?? "unnamed"}) terminated on ` +
          `${profile.termination_date} (before period); skipped`,
      );
      continue;
    }

    const profileSnapshot: EmployeeProfileSnapshot = {
      userId,
      fullName: profile.full_name,
      nationalId: profile.national_id,
      employeeId: profile.employee_id,
      department: profile.department,
      jobTitle: profile.job_title,
      salaryBase: profile.salary_base,
      salaryCurrency: profile.salary_currency ?? "TWD",
      laborInsuredSalary: profile.labor_insured_salary,
      nhiInsuredSalary: profile.nhi_insured_salary,
      pensionContributionWage: profile.pension_contribution_wage,
      voluntaryPensionRate: profile.voluntary_pension_rate ?? 0,
      nhiDependents: profile.nhi_dependents ?? 0,
      bankCode: profile.bank_code,
      bankAccount: profile.bank_account,
      hireDate,
      gender: profile.gender,
      terminationDate,
    };

    const userLeaves = leaveRows.filter((l) => l.submitted_by === userId);
    const employeeWarnings: string[] = [];

    // Partition into YTD vs current period
    const leavesInPeriod: LeaveOccurrenceInPeriod[] = [];
    const ytdRecords: YtdContext["rawRecords"] = [];

    for (const leave of userLeaves) {
      const fd = leave.form_data ?? {};
      const start = parseDate(fd.start_date);
      const end = parseDate(fd.end_date);
      const daysClaimed = parseNumberLoose(fd.days) ?? 0;
      const leaveTypeRaw = (fd.leave_type ?? "").trim();

      // Validate basics
      if (!start || !end) {
        employeeWarnings.push(
          `Leave ${leave.id}: missing or invalid start/end date; ignored`,
        );
        continue;
      }
      if (start > end) {
        employeeWarnings.push(
          `Leave ${leave.id}: start_date (${fd.start_date}) > end_date (${fd.end_date}); ignored`,
        );
        continue;
      }
      if (!leaveTypeRaw) {
        employeeWarnings.push(
          `Leave ${leave.id}: empty leave_type; ignored`,
        );
        continue;
      }
      if (daysClaimed <= 0) {
        employeeWarnings.push(
          `Leave ${leave.id}: days=${daysClaimed} (not positive); ignored`,
        );
        continue;
      }

      // Does this leave overlap the current period?
      const intersection = intersectRanges(start, end, periodStart, periodEnd);

      if (intersection) {
        // Compute days in period
        // Approach: respect form_data.days as the source of truth for the
        // total days claimed (which already accounts for half-day / hourly
        // duration types). For multi-day full-day leaves, prorate.
        let daysInPeriod: number;
        if (
          (fd.duration_type ?? "full_day") === "full_day" &&
          // multi-day full-day leaves can be prorated by calendar overlap
          daysBetween(start, end) >= 1
        ) {
          const totalCalendarDays = daysBetween(start, end);
          const overlapCalendarDays = daysBetween(
            intersection.start,
            intersection.end,
          );
          if (totalCalendarDays === overlapCalendarDays) {
            // entire leave is in this period
            daysInPeriod = daysClaimed;
          } else {
            // proportional split
            // If daysClaimed === totalCalendarDays (typical), use overlap directly
            // Otherwise (rare: claimed days less than calendar span), prorate
            if (daysClaimed === totalCalendarDays) {
              daysInPeriod = overlapCalendarDays;
            } else {
              daysInPeriod =
                (daysClaimed * overlapCalendarDays) / totalCalendarDays;
            }
          }
        } else {
          // half_day / hourly / other: attribute fully to the period
          // containing the start_date (no proration)
          if (start >= periodStart && start <= periodEnd) {
            daysInPeriod = daysClaimed;
          } else {
            // Start is outside this period; the half-day/hourly leave
            // belongs to the period containing its start, not this one.
            // Don't add it to leavesInPeriod for this run.
            continue;
          }
        }

        const spansBeyondPeriod =
          start < periodStart || end > periodEnd;

        leavesInPeriod.push({
          sourceWorkflowSubmissionId: leave.id,
          leaveTypeRaw,
          daysClaimedFull: daysClaimed,
          daysInPeriod,
          durationType: fd.duration_type ?? null,
          hoursRequested: parseNumberLoose(fd.hours_requested),
          reason: fd.reason ?? null,
          originalStart: start,
          originalEnd: end,
          effectiveStart: intersection.start,
          effectiveEnd: intersection.end,
          spansBeyondPeriod,
          approvedAt: parseDate(leave.reviewed_at),
        });
      }

      // YTD apportionment (Phase 3b.5 Step 5 — Gap #4 fix):
      //
      // Per 勞動2字第41739號函: "病假之一年，係以曆年計算" — the YTD
      // window is the calendar year [Jan 1, period start). A leave
      // that started in the prior year but extends into this year
      // contributes its overlapping days to THIS year's YTD.
      //
      // We use end-date as the inclusion criterion (not start-date as
      // before) so year-spanning leaves are caught. Days are then
      // apportioned to the current fiscal year via apportionDaysToFiscalYear.
      //
      // CONDITION: leave overlaps the YTD window [windowStart, windowEnd)
      //   - end >= windowStart (some part of leave falls in/after Jan 1)
      //   - start < windowEnd (some part of leave falls before period start)
      const fiscalYear = periodYear;
      if (end >= windowStart && start < windowEnd) {
        const apportioned = apportionDaysToFiscalYear(
          start,
          end,
          daysClaimed,
          fiscalYear,
        );

        // Filter out the days that fall in the CURRENT period (they're
        // already counted in leavesInPeriod and should not double-count
        // in YTD). Subtract: YTD = "apportioned to fiscal year" minus
        // "days in current period".
        //
        // Reuse the existing intersectRanges output: if the leave
        // overlapped the period, periodOverlap.start..end gave the
        // current-period days. We subtract those from apportionedDays.
        const periodOverlap = intersectRanges(
          start,
          end,
          periodStart,
          periodEnd,
        );
        let ytdApportionedDays = apportioned.apportionedDays;
        if (periodOverlap) {
          const periodCalendarDays = daysBetween(
            periodOverlap.start,
            periodOverlap.end,
          );
          // Scale period days proportionally if daysClaimed != calendar span
          const totalCalSpan = daysBetween(start, end);
          const periodApportionedDays =
            daysClaimed === totalCalSpan
              ? periodCalendarDays
              : (daysClaimed * periodCalendarDays) / totalCalSpan;
          ytdApportionedDays = Math.max(
            0,
            ytdApportionedDays - periodApportionedDays,
          );
        }

        if (ytdApportionedDays > 0) {
          ytdRecords.push({
            sourceWorkflowSubmissionId: leave.id,
            leaveTypeRaw,
            daysClaimed: ytdApportionedDays,
            startDate: start,
            endDate: end,
            durationType: fd.duration_type ?? null,
            splitForYearBoundary: apportioned.splitForYearBoundary,
          });
        }
      }
    }

    employees.push({
      profile: profileSnapshot,
      isActive: true,
      ytdContext: {
        windowStart,
        windowEnd,
        rawRecords: ytdRecords,
      },
      leavesInPeriod,
      warnings: employeeWarnings,
    });
  }

  return {
    organizationId,
    period: {
      year: periodYear,
      month: periodMonth,
      startDate: periodStart,
      endDate: periodEnd,
      daysInMonth,
    },
    employees,
    warnings: orgWarnings,
  };
}
