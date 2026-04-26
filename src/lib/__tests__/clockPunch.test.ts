import { describe, it, expect } from 'vitest';
import { computeClockIn, computeClockOut } from '@/lib/clockPunch';
import type { ClockConfig } from '@/lib/clockConfig';

const baseConfig: ClockConfig = {
  organization_id: 'test-org',
  work_start_time: '08:00:00',
  work_end_time: '17:00:00',
  late_grace_minutes: 5,
  work_days: [1, 2, 3, 4, 5],
  lunch_break_minutes: 60,
  ot_threshold_minutes: 30,
  location_label: '總公司',
  timezone: 'Asia/Taipei',
  manual_entry_window_days: 7,
};

// Helper: build a UTC Date from Taipei wall-clock (UTC+8 no DST)
function taipei(iso: string): Date {
  return new Date(`${iso}+08:00`);
}

describe('computeClockIn', () => {
  it('on time — arrives exactly at 08:00', () => {
    const r = computeClockIn({ config: baseConfig, now: taipei('2026-04-25T08:00:00') });
    expect(r.lateMinutes).toBe(0);
    expect(r.workDate).toBe('2026-04-25');
  });

  it('within grace period — arrives 08:04, still on time', () => {
    const r = computeClockIn({ config: baseConfig, now: taipei('2026-04-25T08:04:00') });
    expect(r.lateMinutes).toBe(0);
  });

  it('past grace — arrives 08:10, late by 10 min', () => {
    const r = computeClockIn({ config: baseConfig, now: taipei('2026-04-25T08:10:00') });
    expect(r.lateMinutes).toBe(10);
  });

  it('arrives early — 07:45, not negative late', () => {
    const r = computeClockIn({ config: baseConfig, now: taipei('2026-04-25T07:45:00') });
    expect(r.lateMinutes).toBe(0);
  });

  it('arrives very late — 10:30, late 150 min', () => {
    const r = computeClockIn({ config: baseConfig, now: taipei('2026-04-25T10:30:00') });
    expect(r.lateMinutes).toBe(150);
  });
});

describe('computeClockOut', () => {
  it('full day with lunch — 08:00 to 17:00 = 8 hours', () => {
    const r = computeClockOut({
      config: baseConfig,
      now: taipei('2026-04-25T17:00:00'),
      existingClockIn: taipei('2026-04-25T08:00:00').toISOString(),
    });
    expect(r.totalHours).toBe(8);
    expect(r.overtimeHours).toBe(0);
  });

  it('short day — 09:00 to 13:00 = 3 hours (lunch still subtracted)', () => {
    const r = computeClockOut({
      config: baseConfig,
      now: taipei('2026-04-25T13:00:00'),
      existingClockIn: taipei('2026-04-25T09:00:00').toISOString(),
    });
    expect(r.totalHours).toBe(3);
  });

  it('overtime past threshold — 08:00 to 18:00 = 9 hrs work + 1 hr OT', () => {
    const r = computeClockOut({
      config: baseConfig,
      now: taipei('2026-04-25T18:00:00'),
      existingClockIn: taipei('2026-04-25T08:00:00').toISOString(),
    });
    expect(r.totalHours).toBe(9);
    expect(r.overtimeHours).toBe(1);
  });

  it('within OT threshold — 17:20 is not OT (under 30 min grace)', () => {
    const r = computeClockOut({
      config: baseConfig,
      now: taipei('2026-04-25T17:20:00'),
      existingClockIn: taipei('2026-04-25T08:00:00').toISOString(),
    });
    expect(r.overtimeHours).toBe(0);
  });

  it('very short shift — cannot produce negative hours', () => {
    const r = computeClockOut({
      config: baseConfig,
      now: taipei('2026-04-25T08:30:00'),
      existingClockIn: taipei('2026-04-25T08:00:00').toISOString(),
    });
    expect(r.totalHours).toBe(0);
  });

  it('throws when existingClockIn missing', () => {
    expect(() =>
      computeClockOut({ config: baseConfig, now: new Date() } as never),
    ).toThrow();
  });
});
