// src/lib/manualEntry.ts
// Pure business logic for manual entry submissions.
// No side effects — DB queries are passed in via service role client at the route layer.

import { taipeiDateString } from '@/lib/time';
import type { ClockConfig } from '@/lib/clockConfig';

export type ReasonCode = 'phone_dead' | 'forgot' | 'travel' | 'system_issue' | 'other';

export type ManualEntryRequest = {
  workDate: string;            // YYYY-MM-DD (Taipei)
  requestedClockIn: string | null;   // ISO UTC
  requestedClockOut: string | null;  // ISO UTC
  reasonCode: ReasonCode;
  reasonNote: string | null;
};

export type ExistingRecord = {
  id: string;
  clock_in: string | null;
  clock_out: string | null;
};

export type ConflictResult =
  | { kind: 'none' }
  | { kind: 'merge_clock_out'; existingRecordId: string; existingClockIn: string }
  | { kind: 'overlap'; reason: string };

/** Validate the work date is within the manual entry window. */
export function validateRequestWindow(
  workDate: string,
  config: ClockConfig,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: string } {
  const today = taipeiDateString(now);
  const requested = new Date(`${workDate}T00:00:00+08:00`);
  const todayDate = new Date(`${today}T00:00:00+08:00`);

  // Future dates not allowed
  if (requested.getTime() > todayDate.getTime()) {
    return { ok: false, reason: 'work_date_in_future' };
  }

  // Beyond window
  const diffDays = Math.floor(
    (todayDate.getTime() - requested.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays > config.manual_entry_window_days) {
    return { ok: false, reason: 'work_date_too_old' };
  }

  return { ok: true };
}

/** Validate at least one of clock_in/clock_out present, in correct order. */
export function validateTimes(
  clockIn: string | null,
  clockOut: string | null,
): { ok: true } | { ok: false; reason: string } {
  if (!clockIn && !clockOut) {
    return { ok: false, reason: 'missing_times' };
  }
  if (clockIn && clockOut) {
    if (new Date(clockIn).getTime() >= new Date(clockOut).getTime()) {
      return { ok: false, reason: 'clock_in_not_before_clock_out' };
    }
  }
  return { ok: true };
}

/**
 * Detect conflict with an existing attendance_records row for the same date.
 * Smart merge: if existing has clock_in but not clock_out, and request has clock_out,
 * we can fill it in.
 */
export function detectConflict(
  request: ManualEntryRequest,
  existing: ExistingRecord | null,
): ConflictResult {
  if (!existing) return { kind: 'none' };

  // Existing has both clock_in and clock_out — record is complete
  if (existing.clock_in && existing.clock_out) {
    return { kind: 'overlap', reason: 'record_already_complete' };
  }

  // Existing has clock_in but no clock_out → mergeable if request supplies clock_out
  if (existing.clock_in && !existing.clock_out && request.requestedClockOut) {
    // Sanity: requested clock_out must be after existing clock_in
    if (new Date(request.requestedClockOut).getTime() <= new Date(existing.clock_in).getTime()) {
      return { kind: 'overlap', reason: 'clock_out_before_existing_clock_in' };
    }
    return {
      kind: 'merge_clock_out',
      existingRecordId: existing.id,
      existingClockIn: existing.clock_in,
    };
  }

  // Other conflict scenarios
  return { kind: 'overlap', reason: 'unmergeable_conflict' };
}

/**
 * Compliance warnings stub. PR 4 will add real LSA logic.
 * Returns empty array for now — endpoint just stores `null`.
 */
export type ComplianceWarning = {
  code: string;
  article: string;
  message_zh: string;
  message_en: string;
};

export function computeComplianceWarnings(
  _request: ManualEntryRequest,
  _existing: ExistingRecord | null,
  _config: ClockConfig,
): ComplianceWarning[] {
  // Phase 4 will implement: weekly hours, monthly OT cap, rest day check
  return [];
}
