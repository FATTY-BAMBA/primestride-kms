// src/lib/clockPunch.ts
// Pure business logic for clock-in/out calculations.
// No side effects. Fully unit-testable.

import {
  taipeiDateString,
  taipeiDateTimeToUtc,
  diffMinutes,
} from '@/lib/time';
import type { ClockConfig } from '@/lib/clockConfig';

export type PunchInput = {
  config: ClockConfig;
  now: Date;
  existingClockIn?: string | null;
};

export type ClockInResult = {
  kind: 'clock_in';
  workDate: string;
  clockInTime: string;
  lateMinutes: number;
};

export type ClockOutResult = {
  kind: 'clock_out';
  clockOutTime: string;
  totalHours: number;
  overtimeHours: number;
};

export function computeClockIn({ config, now }: PunchInput): ClockInResult {
  const workDate = taipeiDateString(now);
  const workStartUtc = taipeiDateTimeToUtc(workDate, config.work_start_time.slice(0, 5));
  const minutesLate = diffMinutes(workStartUtc, now);
  const lateMinutes = minutesLate > config.late_grace_minutes ? minutesLate : 0;

  return {
    kind: 'clock_in',
    workDate,
    clockInTime: now.toISOString(),
    lateMinutes,
  };
}

export function computeClockOut({ config, now, existingClockIn }: PunchInput): ClockOutResult {
  if (!existingClockIn) {
    throw new Error('computeClockOut: existingClockIn required');
  }
  const clockInDate = new Date(existingClockIn);
  const totalMinutes = diffMinutes(clockInDate, now);
  const workedMinutes = Math.max(0, totalMinutes - config.lunch_break_minutes);
  const totalHours = roundHours(workedMinutes / 60);

  const workDate = taipeiDateString(clockInDate);
  const workEndUtc = taipeiDateTimeToUtc(workDate, config.work_end_time.slice(0, 5));
  const minutesPastEnd = diffMinutes(workEndUtc, now);
  const overtimeMinutes = minutesPastEnd > config.ot_threshold_minutes ? minutesPastEnd : 0;
  const overtimeHours = roundHours(overtimeMinutes / 60);

  return {
    kind: 'clock_out',
    clockOutTime: now.toISOString(),
    totalHours,
    overtimeHours,
  };
}

function roundHours(h: number): number {
  return Math.round(h * 100) / 100;
}