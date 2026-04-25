import { describe, it, expect } from 'vitest';
import {
  validateRequestWindow,
  validateTimes,
  detectConflict,
} from '@/lib/manualEntry';
import type { ClockConfig } from '@/lib/clockConfig';

const config: ClockConfig & { manual_entry_window_days: number } = {
  organization_id: 'test',
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

const taipeiNow = new Date('2026-04-25T12:00:00+08:00');

describe('validateRequestWindow', () => {
  it('allows today', () => {
    const r = validateRequestWindow('2026-04-25', config, taipeiNow);
    expect(r.ok).toBe(true);
  });

  it('allows yesterday', () => {
    const r = validateRequestWindow('2026-04-24', config, taipeiNow);
    expect(r.ok).toBe(true);
  });

  it('allows 7 days ago', () => {
    const r = validateRequestWindow('2026-04-18', config, taipeiNow);
    expect(r.ok).toBe(true);
  });

  it('rejects 8 days ago (beyond window)', () => {
    const r = validateRequestWindow('2026-04-17', config, taipeiNow);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('work_date_too_old');
  });

  it('rejects future date', () => {
    const r = validateRequestWindow('2026-04-26', config, taipeiNow);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('work_date_in_future');
  });
});

describe('validateTimes', () => {
  it('allows clock_in only', () => {
    const r = validateTimes('2026-04-25T08:00:00+08:00', null);
    expect(r.ok).toBe(true);
  });

  it('allows clock_out only', () => {
    const r = validateTimes(null, '2026-04-25T17:00:00+08:00');
    expect(r.ok).toBe(true);
  });

  it('allows both in correct order', () => {
    const r = validateTimes('2026-04-25T08:00:00+08:00', '2026-04-25T17:00:00+08:00');
    expect(r.ok).toBe(true);
  });

  it('rejects neither time present', () => {
    const r = validateTimes(null, null);
    expect(r.ok).toBe(false);
  });

  it('rejects clock_out before clock_in', () => {
    const r = validateTimes('2026-04-25T17:00:00+08:00', '2026-04-25T08:00:00+08:00');
    expect(r.ok).toBe(false);
  });

  it('rejects identical times', () => {
    const r = validateTimes('2026-04-25T08:00:00+08:00', '2026-04-25T08:00:00+08:00');
    expect(r.ok).toBe(false);
  });
});

describe('detectConflict', () => {
  const baseRequest = {
    workDate: '2026-04-25',
    requestedClockIn: '2026-04-25T08:00:00+08:00',
    requestedClockOut: '2026-04-25T17:00:00+08:00',
    reasonCode: 'forgot' as const,
    reasonNote: null,
  };

  it('no existing record → no conflict', () => {
    const r = detectConflict(baseRequest, null);
    expect(r.kind).toBe('none');
  });

  it('existing record complete → overlap', () => {
    const r = detectConflict(baseRequest, {
      id: 'r1',
      clock_in: '2026-04-25T08:00:00+08:00',
      clock_out: '2026-04-25T17:00:00+08:00',
    });
    expect(r.kind).toBe('overlap');
    if (r.kind === 'overlap') expect(r.reason).toBe('record_already_complete');
  });

  it('existing has clock_in only + request supplies clock_out → merge', () => {
    const r = detectConflict(baseRequest, {
      id: 'r1',
      clock_in: '2026-04-25T08:00:00+08:00',
      clock_out: null,
    });
    expect(r.kind).toBe('merge_clock_out');
    if (r.kind === 'merge_clock_out') {
      expect(r.existingRecordId).toBe('r1');
    }
  });

  it('merge with clock_out before existing clock_in → overlap', () => {
    const r = detectConflict(
      { ...baseRequest, requestedClockOut: '2026-04-25T07:00:00+08:00' },
      { id: 'r1', clock_in: '2026-04-25T08:00:00+08:00', clock_out: null },
    );
    expect(r.kind).toBe('overlap');
  });
});
