// src/lib/attendanceToday.ts
// Pure aggregation logic for today's attendance summary.
// Used by /api/clock/today and tested in isolation.

import type { ClockConfig } from './clockConfig';

export type PunchStatus = 'in' | 'out' | 'not_in';

export interface AttendanceRecord {
  user_id: string;
  user_name: string;
  work_date: string;       // YYYY-MM-DD
  clock_in: string | null;  // ISO timestamp UTC
  clock_out: string | null; // ISO timestamp UTC
  total_minutes: number | null;
  late_minutes: number | null;
  overtime_minutes: number | null;
  clock_in_method: string;
}

export interface AdminSummary {
  total: number;       // expected attendees today (active members)
  in: number;          // clocked in, not yet out, not late
  late: number;        // clocked in but past grace period
  notIn: number;       // expected but no clock-in record
  overtime: number;    // currently in overtime range
  attendanceRate: number; // percentage 0-100, rounded
}

export interface MyStatusToday {
  status: PunchStatus;
  clockInISO: string | null;
  clockOutISO: string | null;
  totalMinutes: number | null;
  lateMinutes: number | null;
  overtimeMinutes: number | null;
}

/**
 * Determine a single user's punch status for today.
 */
export function getMyStatus(record: AttendanceRecord | null): MyStatusToday {
  if (!record) {
    return {
      status: 'not_in',
      clockInISO: null,
      clockOutISO: null,
      totalMinutes: null,
      lateMinutes: null,
      overtimeMinutes: null,
    };
  }

  const status: PunchStatus = record.clock_out ? 'out' : (record.clock_in ? 'in' : 'not_in');

  return {
    status,
    clockInISO: record.clock_in,
    clockOutISO: record.clock_out,
    totalMinutes: record.total_minutes,
    lateMinutes: record.late_minutes,
    overtimeMinutes: record.overtime_minutes,
  };
}

/**
 * Aggregate today's attendance for admin view.
 *
 * @param expectedMemberIds — list of user_ids who should be working today
 *                            (filtered by work_days from clockConfig)
 * @param todayRecords — attendance_records for today's date for the org
 * @param config — org clock config (for grace period, OT threshold)
 * @param nowMinutesPastStart — for OT calc: minutes since work_start_time
 */
export function aggregateForAdmin(
  expectedMemberIds: string[],
  todayRecords: AttendanceRecord[],
  config: Pick<ClockConfig, 'late_grace_minutes' | 'ot_threshold_minutes'>,
): AdminSummary {
  const total = expectedMemberIds.length;
  const recordsByUser = new Map<string, AttendanceRecord>();
  for (const r of todayRecords) recordsByUser.set(r.user_id, r);

  let inCount = 0;
  let lateCount = 0;
  let overtimeCount = 0;

  for (const userId of expectedMemberIds) {
    const r = recordsByUser.get(userId);
    if (!r || !r.clock_in) continue;

    if (r.clock_out) {
      // Already clocked out — count toward overtime if applicable
      if ((r.overtime_minutes ?? 0) >= config.ot_threshold_minutes) overtimeCount++;
      continue;
    }

    // Currently in
    if ((r.late_minutes ?? 0) > config.late_grace_minutes) {
      lateCount++;
    } else {
      inCount++;
    }
  }

  const notIn = total - inCount - lateCount - overtimeCount;
  const attended = inCount + lateCount + overtimeCount;
  const attendanceRate = total === 0 ? 0 : Math.round((attended / total) * 100);

  return {
    total,
    in: inCount,
    late: lateCount,
    notIn: Math.max(0, notIn),
    overtime: overtimeCount,
    attendanceRate,
  };
}

/**
 * Count days the user clocked in this calendar month (for employee stat card).
 *
 * @param records — attendance_records for current month, this user only
 */
export function monthlyDaysCount(records: Array<Pick<AttendanceRecord, 'work_date' | 'clock_in'>>): number {
  const days = new Set<string>();
  for (const r of records) {
    if (r.clock_in) days.add(r.work_date);
  }
  return days.size;
}

/**
 * Determine if today is a working day according to org config.
 * work_days uses ISO day-of-week: 1 = Mon, 7 = Sun.
 */
export function isWorkDay(date: Date, workDays: number[]): boolean {
  // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
  // ISO: 1=Mon, ..., 7=Sun
  const jsDay = date.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  return workDays.includes(isoDay);
}