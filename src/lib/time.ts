// src/lib/time.ts
// Atlas EIP: centralized Taipei-time helpers.
// All DB timestamps are UTC; all user-facing logic runs in Asia/Taipei.
// Taiwan does not observe DST, so UTC+8 offset is hardcoded.

const TZ = 'Asia/Taipei';

/** Current time as a Date (UTC internally, but semantically "now"). */
export function nowTaipei(): Date {
  return new Date();
}

/** Format a Date as YYYY-MM-DD in Taipei (the work_date we store). */
export function taipeiDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Format a Date as HH:mm in Taipei. */
export function taipeiTimeString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** ISO weekday in Taipei: 1=Mon ... 7=Sun. Matches work_days[] in config. */
export function taipeiIsoWeekday(d: Date = new Date()): number {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).format(d);
  const map: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  return map[short];
}

/** Combine a Taipei date + "HH:mm" time into a UTC Date for comparisons. */
export function taipeiDateTimeToUtc(workDate: string, hhmm: string): Date {
  return new Date(`${workDate}T${hhmm}:00+08:00`);
}

/** Minutes between two Dates (b - a), floored. Negative if b < a. */
export function diffMinutes(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 60000);
}


