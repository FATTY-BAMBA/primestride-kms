// src/lib/__tests__/attendanceToday.test.ts
import { describe, it, expect } from 'vitest';
import {
  getMyStatus,
  aggregateForAdmin,
  monthlyDaysCount,
  isWorkDay,
  type AttendanceRecord,
} from '../attendanceToday';

const baseRecord: AttendanceRecord = {
  user_id: 'u1',
  user_name: 'Alice',
  work_date: '2026-04-26',
  clock_in: null,
  clock_out: null,
  total_minutes: null,
  late_minutes: null,
  overtime_minutes: null,
  clock_in_method: 'qr',
};

describe('getMyStatus', () => {
  it('returns not_in when record is null', () => {
    const r = getMyStatus(null);
    expect(r.status).toBe('not_in');
    expect(r.clockInISO).toBeNull();
  });

  it('returns in when clocked in but not out', () => {
    const r = getMyStatus({ ...baseRecord, clock_in: '2026-04-26T00:08:00Z' });
    expect(r.status).toBe('in');
    expect(r.clockInISO).toBe('2026-04-26T00:08:00Z');
    expect(r.clockOutISO).toBeNull();
  });

  it('returns out when clocked in and out', () => {
    const r = getMyStatus({
      ...baseRecord,
      clock_in: '2026-04-26T00:08:00Z',
      clock_out: '2026-04-26T09:00:00Z',
      total_minutes: 480,
    });
    expect(r.status).toBe('out');
    expect(r.totalMinutes).toBe(480);
  });
});

describe('aggregateForAdmin', () => {
  const config = { late_grace_minutes: 5, ot_threshold_minutes: 30 };

  it('counts zero attendance for empty membership', () => {
    const summary = aggregateForAdmin([], [], config);
    expect(summary).toEqual({
      total: 0, in: 0, late: 0, notIn: 0, overtime: 0, attendanceRate: 0,
    });
  });

  it('counts not_in when no records exist', () => {
    const summary = aggregateForAdmin(['u1', 'u2', 'u3'], [], config);
    expect(summary.total).toBe(3);
    expect(summary.notIn).toBe(3);
    expect(summary.in).toBe(0);
    expect(summary.attendanceRate).toBe(0);
  });

  it('counts in vs late based on grace period', () => {
    const records: AttendanceRecord[] = [
      { ...baseRecord, user_id: 'u1', clock_in: '2026-04-26T00:00:00Z', late_minutes: 0 },
      { ...baseRecord, user_id: 'u2', clock_in: '2026-04-26T00:08:00Z', late_minutes: 8 },
    ];
    const summary = aggregateForAdmin(['u1', 'u2'], records, config);
    expect(summary.in).toBe(1);
    expect(summary.late).toBe(1);
    expect(summary.notIn).toBe(0);
    expect(summary.attendanceRate).toBe(100);
  });

  it('counts overtime for clocked-out users past threshold', () => {
    const records: AttendanceRecord[] = [
      {
        ...baseRecord,
        user_id: 'u1',
        clock_in: '2026-04-26T00:00:00Z',
        clock_out: '2026-04-26T10:00:00Z',
        overtime_minutes: 60,
      },
    ];
    const summary = aggregateForAdmin(['u1'], records, config);
    expect(summary.overtime).toBe(1);
    expect(summary.in).toBe(0);
  });

  it('handles mixed roster correctly', () => {
    const records: AttendanceRecord[] = [
      { ...baseRecord, user_id: 'u1', clock_in: '2026-04-26T00:00:00Z', late_minutes: 0 },
      { ...baseRecord, user_id: 'u2', clock_in: '2026-04-26T00:10:00Z', late_minutes: 10 },
    ];
    const summary = aggregateForAdmin(['u1', 'u2', 'u3'], records, config);
    expect(summary.total).toBe(3);
    expect(summary.in).toBe(1);
    expect(summary.late).toBe(1);
    expect(summary.notIn).toBe(1);
    expect(summary.attendanceRate).toBe(67);
  });
});

describe('monthlyDaysCount', () => {
  it('returns zero for empty records', () => {
    expect(monthlyDaysCount([])).toBe(0);
  });

  it('counts unique work_dates with clock_in', () => {
    const records = [
      { work_date: '2026-04-01', clock_in: '2026-04-01T00:00:00Z' },
      { work_date: '2026-04-02', clock_in: '2026-04-02T00:00:00Z' },
      { work_date: '2026-04-02', clock_in: '2026-04-02T00:00:00Z' },
      { work_date: '2026-04-03', clock_in: null },
    ];
    expect(monthlyDaysCount(records)).toBe(2);
  });
});

describe('isWorkDay', () => {
  const mondayToFriday = [1, 2, 3, 4, 5];

  it('treats Monday as work day', () => {
    expect(isWorkDay(new Date('2026-04-27T08:00:00Z'), mondayToFriday)).toBe(true);
  });

  it('treats Saturday as non-work day', () => {
    expect(isWorkDay(new Date('2026-04-25T08:00:00Z'), mondayToFriday)).toBe(false);
  });

  it('treats Sunday as non-work day with default config', () => {
    expect(isWorkDay(new Date('2026-04-26T08:00:00Z'), mondayToFriday)).toBe(false);
  });

  it('respects custom work_days array', () => {
    const tueToSat = [2, 3, 4, 5, 6];
    expect(isWorkDay(new Date('2026-04-25T08:00:00Z'), tueToSat)).toBe(true);
    expect(isWorkDay(new Date('2026-04-27T08:00:00Z'), tueToSat)).toBe(false);
  });
});
