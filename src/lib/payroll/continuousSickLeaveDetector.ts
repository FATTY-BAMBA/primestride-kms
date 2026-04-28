// src/lib/payroll/continuousSickLeaveDetector.ts
//
// Atlas EIP — Continuous Sick Leave Detector (Phase 3b.5 Step 6)
// ──────────────────────────────────────────────────────────────────────
//
// Implements the "continuous over 30 work-days" rule from
// 勞動部 112年5月1日 勞動條3字第1120147882號函:
//
//   "勞工請普通傷病假一次連續超過30日以上計算，以其提出假單請假期間
//    為據，惟請假證明所載治療或休養期間含括其連續二次以上請假期間者，
//    得合併計算；即於計算30個工作日後自第31日起，病假期間依曆計算。"
//
// Translation: Continuous 病假 of 30+ days is counted by working days
// for the first 30 days, then by calendar days from day 31 onward.
// Multiple leave records can be combined IF the medical certificate's
// treatment period covers them.
//
// LEGAL FRAMEWORK:
//   - First 30 work-days: 例假/休息日/國定假日 NOT counted, paid full
//     per LSA Art. 39; sick work-days at half pay per 勞工請假規則 第4條.
//   - From day 31 onward: ALL calendar days (incl. weekends/holidays)
//     count as sick period, employer may withhold all wages.
//
// DETECTION APPROACH (Q1 = Option A):
//   Calendar-day adjacency + non-work-day bridging.
//   Two records form a chain if the gap between them consists ONLY of
//   non-work days (weekends, holidays). This captures the canonical
//   "大壯 cancer" case (weekly Mon-Fri leave records).
//
// FALSE POSITIVE HANDLING (Q2 = Option A):
//   Soft warn. We can't see medical certificates, so two distinct
//   illnesses with no work-day gap will be combined. Caller surfaces
//   warning so HR can override.
//
// YEAR BOUNDARY (Q3 = Option A):
//   Each fiscal year has its own 30-day work-day budget. A chain
//   spanning years has independent budgets per year (per
//   勞動2字第41739號函 calendar-year reset principle).
//
// MODULE BOUNDARY (Q4 = Option B):
//   This module is PURE: takes records + working-day service in,
//   returns chain metadata out. payTreatment.ts consumes the result
//   to apply pay rules.

import type { LeaveOccurrenceInPeriod } from "./leaveAggregator";
import type { WorkingDayService } from "../calendar/workingDayService";
import { classify } from "./leaveClassifier";

// ── Public types ─────────────────────────────────────────────────────

/**
 * Per-fiscal-year breakdown of a chain's day counts.
 *
 * Each fiscal year that the chain touches has its own entry, because
 * the 30-day budget resets every January 1 per 勞動2字第41739號函.
 */
export type ChainYearBreakdown = {
  /** Fiscal year (e.g., 2026) */
  year: number;
  /** Working days within this fiscal year, summed across the chain's records */
  workDaysInYear: number;
  /** Calendar days within this fiscal year, summed across the chain's records */
  calendarDaysInYear: number;
  /**
   * The first calendar date in this year where day-31+ rule applies,
   * or null if this year's chain portion never exceeded 30 work-days.
   *
   * Once this date is non-null, every calendar day FROM this date onward
   * (within the chain's records and within this year) counts as sick
   * leave at zero pay (employer may withhold).
   */
  thirtyFirstDayDate: Date | null;
};

/**
 * A continuous sick leave chain — one or more records linked by the
 * adjacency-or-non-work-day-bridging rule.
 */
export type ContinuousSickLeaveChain = {
  /** Records in this chain, sorted by originalStart ascending */
  records: ReadonlyArray<LeaveOccurrenceInPeriod>;
  /** Earliest originalStart across all records */
  chainStart: Date;
  /** Latest originalEnd across all records */
  chainEnd: Date;
  /** Per-fiscal-year breakdown */
  yearBreakdowns: ReadonlyArray<ChainYearBreakdown>;
  /** True if this chain is multi-record (i.e., needs warning per Q2) */
  isMultiRecord: boolean;
};

/**
 * Result of running the detector across an employee's sick records.
 */
export type DetectionResult = {
  /** All chains found (1+ chains; even single records form a chain of 1) */
  chains: ReadonlyArray<ContinuousSickLeaveChain>;
  /**
   * For each input record, a stable lookup of which chain it belongs to.
   * Map keys are sourceWorkflowSubmissionId; values are 0-indexed positions
   * in the chains array.
   */
  recordToChainIndex: ReadonlyMap<string, number>;
};

// ── Internals ────────────────────────────────────────────────────────

/**
 * Add N days to a Date, returning a new Date at UTC midnight.
 */
function addDays(d: Date, n: number): Date {
  const r = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

/**
 * Check if every calendar day in [start, end] (inclusive) is non-working.
 * Used to determine if the gap between two records is "bridge-able."
 *
 * Returns true if start > end (empty range — trivially "all non-working").
 */
function gapIsAllNonWorkingDays(
  start: Date,
  end: Date,
  svc: WorkingDayService,
): boolean {
  if (start.getTime() > end.getTime()) return true;
  const cursor = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
    ),
  );
  const stop = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
  );
  while (cursor.getTime() <= stop.getTime()) {
    if (svc.isWorkingDay(cursor)) return false;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return true;
}

/**
 * Check if records A then B (A.end < B.start) are linked.
 * Linkage: gap [A.end+1, B.start-1] is empty OR all non-working days.
 *
 * Special cases:
 *   - Overlap (A.end >= B.start): treated as linked (data quality issue;
 *     err on the side of combining)
 *   - Adjacent (A.end + 1 == B.start): trivially linked
 */
function recordsLink(
  a: LeaveOccurrenceInPeriod,
  b: LeaveOccurrenceInPeriod,
  svc: WorkingDayService,
): boolean {
  // Overlap or same day: combine
  if (a.originalEnd.getTime() >= b.originalStart.getTime()) return true;
  // Gap range: [a.end + 1, b.start - 1] inclusive
  const gapStart = addDays(a.originalEnd, 1);
  const gapEnd = addDays(b.originalStart, -1);
  return gapIsAllNonWorkingDays(gapStart, gapEnd, svc);
}

/**
 * Filter input records to only sick leaves (canonical key sick_leave).
 * Returns records sorted by originalStart ascending.
 *
 * Records that fail classification are excluded silently — they're
 * caught by the orchestrator's general warning system.
 */
function filterSickLeaves(
  records: ReadonlyArray<LeaveOccurrenceInPeriod>,
): LeaveOccurrenceInPeriod[] {
  const sick: LeaveOccurrenceInPeriod[] = [];
  for (const r of records) {
    const c = classify(r.leaveTypeRaw);
    // The day-31+ rule per 勞動條3字第1120147882號函 applies to 普通傷病假
    // (sick_unhospitalized). Hospitalized sick leave has a different cap
    // structure (1 year over 2 years) and is not subject to this rule.
    if (c.ok && c.definition.canonicalKey === "sick_unhospitalized") {
      sick.push(r);
    }
  }
  // Sort by originalStart ascending; tiebreak by sourceId for determinism
  sick.sort((a, b) => {
    const t = a.originalStart.getTime() - b.originalStart.getTime();
    if (t !== 0) return t;
    return a.sourceWorkflowSubmissionId.localeCompare(
      b.sourceWorkflowSubmissionId,
    );
  });
  return sick;
}

/**
 * Group sorted sick records into chains via the linkage rule.
 * Each group is a maximal set of records where consecutive pairs link.
 */
function groupIntoChains(
  sortedSick: ReadonlyArray<LeaveOccurrenceInPeriod>,
  svc: WorkingDayService,
): LeaveOccurrenceInPeriod[][] {
  if (sortedSick.length === 0) return [];
  const chains: LeaveOccurrenceInPeriod[][] = [];
  let current: LeaveOccurrenceInPeriod[] = [sortedSick[0]];
  for (let i = 1; i < sortedSick.length; i++) {
    const prev = current[current.length - 1];
    const next = sortedSick[i];
    if (recordsLink(prev, next, svc)) {
      current.push(next);
    } else {
      chains.push(current);
      current = [next];
    }
  }
  chains.push(current);
  return chains;
}

/**
 * Compute the per-fiscal-year breakdown for a chain, including the
 * day-31+ trigger date if any.
 *
 * Walks through the chain's records day by day. Within each fiscal
 * year independently:
 *   - If the day is within a record's date range AND is a working day,
 *     increment workDaysInYear.
 *   - If the day is within a record's date range, increment
 *     calendarDaysInYear.
 *   - If workDaysInYear hits 31 on a working day, mark thirtyFirstDayDate.
 *
 * The 30-day budget RESETS at January 1 each year (Q3 = Option A).
 */
function computeYearBreakdowns(
  chain: ReadonlyArray<LeaveOccurrenceInPeriod>,
  svc: WorkingDayService,
): ChainYearBreakdown[] {
  // Figure out which fiscal years the chain touches
  const startYear = chain[0].originalStart.getUTCFullYear();
  const endYear = chain[chain.length - 1].originalEnd.getUTCFullYear();

  const breakdowns: ChainYearBreakdown[] = [];

  // Build a set of date-strings covered by records (faster lookup than
  // O(n) range checks per day)
  const coveredDays = new Set<string>();
  for (const r of chain) {
    const cursor = new Date(
      Date.UTC(
        r.originalStart.getUTCFullYear(),
        r.originalStart.getUTCMonth(),
        r.originalStart.getUTCDate(),
      ),
    );
    const stop = new Date(
      Date.UTC(
        r.originalEnd.getUTCFullYear(),
        r.originalEnd.getUTCMonth(),
        r.originalEnd.getUTCDate(),
      ),
    );
    while (cursor.getTime() <= stop.getTime()) {
      coveredDays.add(cursor.toISOString().split("T")[0]);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  for (let year = startYear; year <= endYear; year++) {
    let workDaysInYear = 0;
    let calendarDaysInYear = 0;
    let thirtyFirstDayDate: Date | null = null;

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1)); // exclusive
    const cursor = new Date(yearStart.getTime());

    while (cursor.getTime() < yearEnd.getTime()) {
      const iso = cursor.toISOString().split("T")[0];
      if (coveredDays.has(iso)) {
        calendarDaysInYear++;
        const isWorking = svc.isWorkingDay(cursor);
        if (isWorking) {
          workDaysInYear++;
          if (workDaysInYear === 31 && thirtyFirstDayDate === null) {
            thirtyFirstDayDate = new Date(cursor.getTime());
          }
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // Only include years where the chain actually had days
    if (calendarDaysInYear > 0) {
      breakdowns.push({
        year,
        workDaysInYear,
        calendarDaysInYear,
        thirtyFirstDayDate,
      });
    }
  }

  return breakdowns;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Detect continuous sick leave chains across an employee's records.
 *
 * Pure function: no I/O, deterministic, side-effect-free. Takes the
 * employee's sick records (in-period + YTD-relevant ones) and the
 * already-loaded WorkingDayService, returns chain metadata.
 *
 * @param records all sick leave records (will be filtered/sorted internally)
 * @param svc loaded WorkingDayService covering all years touched by records
 * @returns DetectionResult with chains and per-record lookup
 */
export function detectContinuousSickLeaveChains(
  records: ReadonlyArray<LeaveOccurrenceInPeriod>,
  svc: WorkingDayService,
): DetectionResult {
  const sortedSick = filterSickLeaves(records);
  const grouped = groupIntoChains(sortedSick, svc);

  const chains: ContinuousSickLeaveChain[] = grouped.map((groupRecords) => {
    const chainStart = groupRecords[0].originalStart;
    const chainEnd = groupRecords[groupRecords.length - 1].originalEnd;
    const yearBreakdowns = computeYearBreakdowns(groupRecords, svc);
    return {
      records: groupRecords,
      chainStart,
      chainEnd,
      yearBreakdowns,
      isMultiRecord: groupRecords.length > 1,
    };
  });

  const recordToChainIndex = new Map<string, number>();
  chains.forEach((chain, idx) => {
    for (const r of chain.records) {
      recordToChainIndex.set(r.sourceWorkflowSubmissionId, idx);
    }
  });

  return { chains, recordToChainIndex };
}

/**
 * Convenience: given a record's sourceWorkflowSubmissionId and a
 * DetectionResult, return the chain it belongs to (or null if record
 * is not a sick leave record).
 */
export function getChainForRecord(
  result: DetectionResult,
  sourceWorkflowSubmissionId: string,
): ContinuousSickLeaveChain | null {
  const idx = result.recordToChainIndex.get(sourceWorkflowSubmissionId);
  if (idx === undefined) return null;
  return result.chains[idx];
}

/**
 * Determine for a specific calendar date within a chain whether the
 * day-31+ rule applies (i.e., this date should be calendar-counted, not
 * work-day-counted).
 *
 * Returns true if there exists a fiscal year breakdown such that:
 *   1. `date`'s year is the breakdown's year
 *   2. breakdown.thirtyFirstDayDate is non-null
 *   3. date >= breakdown.thirtyFirstDayDate
 */
export function isDateInDay31PlusRegion(
  chain: ContinuousSickLeaveChain,
  date: Date,
): boolean {
  const year = date.getUTCFullYear();
  const breakdown = chain.yearBreakdowns.find((b) => b.year === year);
  if (!breakdown) return false;
  if (breakdown.thirtyFirstDayDate === null) return false;
  return date.getTime() >= breakdown.thirtyFirstDayDate.getTime();
}
