// src/lib/calendar/workingDayService.ts
//
// Atlas EIP — Taiwan Working-Day Service
// ──────────────────────────────────────────────────────────────────────
// Industry-standard layered calendar API:
//
//   Layer 1 (primitives):
//     - isWorkingDay(date): boolean
//     - getDayInfo(date): CalendarDayInfo | null
//
//   Layer 2 (general-purpose helpers, built on primitives):
//     - countWorkingDaysBetween(start, end): number   [inclusive on both ends]
//
// Domain-specific logic (e.g., 病假 30-day rule) lives in consumers
// like payTreatment.ts — NOT here.
//
// USAGE PATTERN (matches bracketLookup):
//
//   const service = await getCalendarService([2025, 2026]);
//   service.isWorkingDay(new Date("2026-04-15"));      // sync
//   service.countWorkingDaysBetween(start, end);        // sync, year-spanning
//
// Caching is per-process: subsequent loads of the same year are O(1)
// Map lookups. The first call hits Supabase once per year.
//
// FAIL-LOUD on missing data: querying a year that wasn't seeded
// throws TaiwanCalendarMissingDataError with a remediation message.
// This is intentional — silent fallback to weekday/weekend defaults
// would mask the data freshness problem and produce silently-wrong
// payroll calculations.

import { adminClient } from "../supabase/admin";

// ── Public types ─────────────────────────────────────────────────────

/**
 * Information about a single calendar date.
 *
 * Shape mirrors the public.taiwan_calendar_days row, but only the
 * fields relevant to runtime decisions (day_type, is_working_day) and
 * audit (name_zh, source_url).
 */
export type CalendarDayInfo = {
  date: string;            // YYYY-MM-DD
  year: number;
  dayType:
    | "national_holiday"
    | "compensatory_off"
    | "adjustment_workday"
    | "memorial_day"
    | "typhoon_day"
    | "regular_workday";
  isWorkingDay: boolean;
  nameZh: string | null;
  nameEn: string | null;
  notes: string | null;
  sourceUrl: string;
};

/**
 * Read-only service object returned by getCalendarService().
 * All methods are sync after construction. Construction is async
 * because it loads data from Supabase.
 */
export type WorkingDayService = {
  /** Years covered by this service instance. */
  readonly years: ReadonlySet<number>;

  /**
   * True if `date` is a working day per the Taiwan calendar.
   *
   * Default behavior for dates without a calendar row:
   *   - Mon-Fri: workday (true)
   *   - Saturday: 休息日 (false)
   *   - Sunday: 例假 (false)
   *
   * Dates with a calendar row use the row's is_working_day value.
   * (e.g., 2024-02-17 was a Saturday adjustment_workday → true)
   *
   * @throws TaiwanCalendarMissingDataError if date's year not loaded
   */
  isWorkingDay(date: Date): boolean;

  /**
   * Returns calendar metadata for `date`, or null if no row exists
   * (date follows the weekday/weekend default).
   *
   * @throws TaiwanCalendarMissingDataError if date's year not loaded
   */
  getDayInfo(date: Date): CalendarDayInfo | null;

  /**
   * Number of working days in [start, end] (inclusive on both ends).
   *
   * If start === end, returns 1 if start is a working day, else 0.
   * If start > end, returns 0.
   * If the range spans multiple years, all those years must have been
   * loaded into this service instance.
   *
   * @throws TaiwanCalendarMissingDataError if any year in range not loaded
   */
  countWorkingDaysBetween(start: Date, end: Date): number;
};

// ── Errors ───────────────────────────────────────────────────────────

/**
 * Thrown when the service is asked about a date in a year that wasn't
 * seeded into public.taiwan_calendar_days. Loud failure mode — see
 * top-of-file comment for rationale.
 */
export class TaiwanCalendarMissingDataError extends Error {
  readonly year: number;
  readonly seededYears: number[];

  constructor(year: number, seededYears: number[]) {
    const remediation = [
      `No Taiwan calendar data for year ${year}.`,
      `Years currently loaded into this service: ${seededYears.join(", ") || "(none)"}`,
      "",
      "DGPA publishes the next year's 行事曆 around June each year.",
      "To update:",
      "  1. Visit https://www.dgpa.gov.tw/informationlist?uid=30",
      `  2. Edit scripts/data/taiwan-calendar.ts to add ${year} entries`,
      "  3. Run: npx tsx scripts/seed-taiwan-calendar.ts",
      "  4. Pass the new year to getCalendarService([..., " + year + "])",
    ].join("\n");
    super(remediation);
    this.name = "TaiwanCalendarMissingDataError";
    this.year = year;
    this.seededYears = seededYears.slice().sort();
  }
}

// ── Internals ────────────────────────────────────────────────────────

/**
 * Convert a Date to YYYY-MM-DD string in UTC.
 * We use UTC consistently because Taiwan calendar dates are
 * date-only (no timezone). Treating them as UTC midnight avoids
 * any DST or local-tz weirdness when callers pass `new Date("2026-02-17")`.
 */
function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Get UTC year from a Date.
 */
function utcYear(d: Date): number {
  return d.getUTCFullYear();
}

/**
 * Default rule for dates without a calendar row.
 */
function defaultIsWorkingDay(d: Date): boolean {
  const dow = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return dow >= 1 && dow <= 5;
}

/**
 * Internal data shape — Map<isoDate, CalendarDayInfo>.
 * Keys are YYYY-MM-DD strings; only dates with explicit rows are present.
 * Dates not in the map fall through to defaultIsWorkingDay().
 */
type CalendarMap = Map<string, CalendarDayInfo>;

/**
 * Convert raw Supabase row to CalendarDayInfo.
 */
type RawRow = {
  date: string;
  year: number;
  day_type: string;
  is_working_day: boolean;
  name_zh: string | null;
  name_en: string | null;
  notes: string | null;
  source_url: string;
};

function rowToInfo(row: RawRow): CalendarDayInfo {
  return {
    date: row.date,
    year: row.year,
    dayType: row.day_type as CalendarDayInfo["dayType"],
    isWorkingDay: row.is_working_day,
    nameZh: row.name_zh,
    nameEn: row.name_en,
    notes: row.notes,
    sourceUrl: row.source_url,
  };
}

// ── Module-level cache ───────────────────────────────────────────────

/**
 * Per-process cache of loaded years. Maps year → Map<isoDate, CalendarDayInfo>.
 * In Vercel serverless, the cache persists across invocations within a
 * warm container. Cold invocations re-fetch (acceptable: one DB roundtrip
 * per year, very fast).
 *
 * For tests: clearCalendarCache() resets this. NOT exported in normal use.
 */
const yearCache = new Map<number, CalendarMap>();

/**
 * In-flight load tracking to prevent two concurrent calls for the same
 * year from making two DB roundtrips. Returns the same Promise both
 * callers await.
 */
const inFlightLoads = new Map<number, Promise<CalendarMap>>();

/**
 * Test-only: clear the module cache. Not exported from the public surface.
 * Call directly via `import { __clearCalendarCacheForTests } from ...`.
 */
export function __clearCalendarCacheForTests(): void {
  yearCache.clear();
  inFlightLoads.clear();
}

/**
 * Load one year from Supabase. Returns a Map<isoDate, CalendarDayInfo>.
 *
 * Note: an empty result is FINE — it just means no exceptions to defaults
 * exist for that year (theoretically a year with no holidays). But in
 * practice, every Taiwan year will have many entries. We do NOT treat
 * "zero rows returned" as missing data; that's a separate concern.
 *
 * THE ACTUAL "MISSING DATA" CHECK happens at call sites against the
 * service's `years` set, not here. This loader just fetches what's there.
 */
async function loadYearFromDb(year: number): Promise<CalendarMap> {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("taiwan_calendar_days")
    .select(
      "date, year, day_type, is_working_day, name_zh, name_en, notes, source_url",
    )
    .eq("year", year);

  if (error) {
    throw new Error(
      `Failed to load Taiwan calendar for year ${year}: ${error.message}`,
    );
  }

  const map: CalendarMap = new Map();
  for (const row of (data ?? []) as RawRow[]) {
    map.set(row.date, rowToInfo(row));
  }
  return map;
}

/**
 * Get-or-load a single year's data, with concurrency-safe deduplication.
 */
async function getOrLoadYear(year: number): Promise<CalendarMap> {
  // Already cached?
  const cached = yearCache.get(year);
  if (cached !== undefined) return cached;

  // In-flight load for this year?
  const inFlight = inFlightLoads.get(year);
  if (inFlight !== undefined) return inFlight;

  // Start a new load
  const loadPromise = loadYearFromDb(year)
    .then((map) => {
      yearCache.set(year, map);
      inFlightLoads.delete(year);
      return map;
    })
    .catch((err) => {
      // On failure, remove from in-flight so retry is possible
      inFlightLoads.delete(year);
      throw err;
    });

  inFlightLoads.set(year, loadPromise);
  return loadPromise;
}

// ── Public factory ───────────────────────────────────────────────────

/**
 * Construct a WorkingDayService loaded with the requested years.
 *
 * Multiple years can be passed; the returned service handles dates in
 * any of them via sync methods. Date queries against years NOT passed
 * here throw TaiwanCalendarMissingDataError.
 *
 * @example
 *   const svc = await getCalendarService([2025, 2026]);
 *   svc.isWorkingDay(new Date("2026-04-15"));  // true (Wed)
 *   svc.isWorkingDay(new Date("2026-02-17"));  // false (春節)
 *   svc.countWorkingDaysBetween(
 *     new Date("2025-12-28"),
 *     new Date("2026-01-05")
 *   );  // year-spanning, OK because both 2025 & 2026 loaded
 *
 *   svc.isWorkingDay(new Date("2027-03-15"));
 *   // throws TaiwanCalendarMissingDataError
 */
export async function getCalendarService(
  years: readonly number[],
): Promise<WorkingDayService> {
  // Deduplicate input years
  const uniqueYears = [...new Set(years)].sort();
  if (uniqueYears.length === 0) {
    throw new Error(
      "getCalendarService requires at least one year — pass [year] " +
        "or [year1, year2, ...]",
    );
  }

  // Load all requested years in parallel
  const yearMaps = await Promise.all(uniqueYears.map(getOrLoadYear));

  // Merge into a single lookup structure for O(1) date resolution.
  // We keep the per-year structure conceptually but use one combined
  // Map for read access since (year, date) is collision-free.
  const combined: CalendarMap = new Map();
  for (const yearMap of yearMaps) {
    for (const [iso, info] of yearMap) {
      combined.set(iso, info);
    }
  }

  const yearsSet = new Set(uniqueYears);

  // ── Service implementation ──

  function checkYearLoaded(d: Date): void {
    const yr = utcYear(d);
    if (!yearsSet.has(yr)) {
      throw new TaiwanCalendarMissingDataError(yr, [...yearsSet]);
    }
  }

  function isWorkingDay(date: Date): boolean {
    checkYearLoaded(date);
    const iso = toIsoDate(date);
    const info = combined.get(iso);
    if (info !== undefined) return info.isWorkingDay;
    return defaultIsWorkingDay(date);
  }

  function getDayInfo(date: Date): CalendarDayInfo | null {
    checkYearLoaded(date);
    const iso = toIsoDate(date);
    return combined.get(iso) ?? null;
  }

  function countWorkingDaysBetween(start: Date, end: Date): number {
    if (start.getTime() > end.getTime()) return 0;
    // Validate every year in the range is loaded BEFORE iterating
    const startYear = utcYear(start);
    const endYear = utcYear(end);
    for (let y = startYear; y <= endYear; y++) {
      if (!yearsSet.has(y)) {
        throw new TaiwanCalendarMissingDataError(y, [...yearsSet]);
      }
    }

    let count = 0;
    // Iterate at UTC midnight to avoid DST issues
    const cursor = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate(),
      ),
    );
    const endUtc = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
    );

    while (cursor.getTime() <= endUtc.getTime()) {
      const iso = toIsoDate(cursor);
      const info = combined.get(iso);
      const isWorking =
        info !== undefined ? info.isWorkingDay : defaultIsWorkingDay(cursor);
      if (isWorking) count++;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return count;
  }

  return {
    years: yearsSet,
    isWorkingDay,
    getDayInfo,
    countWorkingDaysBetween,
  };
}
