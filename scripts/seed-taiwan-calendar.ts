// scripts/seed-taiwan-calendar.ts
//
// Atlas EIP — Taiwan Calendar Seed Script
// ──────────────────────────────────────────────────────────────────────
// Loads scripts/data/taiwan-calendar.ts and upserts rows into
// public.taiwan_calendar_days. Idempotent: rerunning is safe.
//
// VALIDATION (fails fast if any of these fail):
//   1. Each entry's date is a valid YYYY-MM-DD
//   2. Each entry's `year` (extracted from date) matches its date
//   3. is_working_day is consistent with day_type:
//      - national_holiday/compensatory_off/memorial_day/typhoon_day → false
//      - adjustment_workday/regular_workday → true
//   4. No duplicate dates within the seed data
//   5. Each entry has source_url
//
// USAGE:
//   npx tsx scripts/seed-taiwan-calendar.ts
//
// SAFETY: Uses upsert (INSERT ... ON CONFLICT). Existing rows are
// updated, missing rows inserted. Does NOT delete rows for years
// not in the seed data — historical rows are preserved.

import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { adminClient } from "../src/lib/supabase/admin";
import {
  ALL_CALENDAR_ENTRIES,
  SEEDED_YEARS,
  LATEST_SEEDED_YEAR,
  type CalendarDayInput,
} from "./data/taiwan-calendar";

// ── ANSI helpers ────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

// ── Validation ──────────────────────────────────────────────────────

const NON_WORKING_TYPES = new Set([
  "national_holiday",
  "compensatory_off",
  "memorial_day",
  "typhoon_day",
]);
const WORKING_TYPES = new Set(["adjustment_workday", "regular_workday"]);

function validateEntries(entries: CalendarDayInput[]): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const seenDates = new Set<string>();

  for (const e of entries) {
    // 1. Date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
      errors.push(`Invalid date format: "${e.date}"`);
      continue;
    }

    // Parse for further checks
    const parsed = new Date(e.date + "T00:00:00Z");
    if (isNaN(parsed.getTime())) {
      errors.push(`Date does not parse: "${e.date}"`);
      continue;
    }

    // 2. Year matches date (we don't store year as input field — DB derives — but verify ranges)
    const year = parsed.getUTCFullYear();
    if (!SEEDED_YEARS.includes(year as 2024 | 2025 | 2026)) {
      errors.push(
        `Date "${e.date}" has year ${year} which is not in SEEDED_YEARS (${SEEDED_YEARS.join(", ")})`,
      );
    }

    // 3. is_working_day consistent with day_type
    if (NON_WORKING_TYPES.has(e.day_type) && e.is_working_day !== false) {
      errors.push(
        `Inconsistency on ${e.date}: day_type "${e.day_type}" should have is_working_day=false, got ${e.is_working_day}`,
      );
    }
    if (WORKING_TYPES.has(e.day_type) && e.is_working_day !== true) {
      errors.push(
        `Inconsistency on ${e.date}: day_type "${e.day_type}" should have is_working_day=true, got ${e.is_working_day}`,
      );
    }

    // 4. No duplicate dates
    if (seenDates.has(e.date)) {
      errors.push(`Duplicate date in seed data: "${e.date}"`);
    }
    seenDates.add(e.date);

    // 5. source_url present
    if (!e.source_url || e.source_url.trim().length === 0) {
      errors.push(`Missing source_url for ${e.date}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

// ── DB row construction ─────────────────────────────────────────────

function entryToRow(e: CalendarDayInput): {
  date: string;
  year: number;
  day_type: string;
  is_working_day: boolean;
  name_zh: string | null;
  name_en: string | null;
  notes: string | null;
  source_url: string;
  source_published_at: string | null;
} {
  const year = parseInt(e.date.substring(0, 4), 10);
  return {
    date: e.date,
    year,
    day_type: e.day_type,
    is_working_day: e.is_working_day,
    name_zh: e.name_zh ?? null,
    name_en: e.name_en ?? null,
    notes: e.notes ?? null,
    source_url: e.source_url,
    source_published_at: e.source_published_at ?? null,
  };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    `\n${c.bold}Atlas EIP — Taiwan Calendar Seed${c.reset}`,
  );
  console.log(`Latest seeded year: ${LATEST_SEEDED_YEAR}`);
  console.log(`Years covered: ${SEEDED_YEARS.join(", ")}`);
  console.log(`Total entries: ${ALL_CALENDAR_ENTRIES.length}`);

  // ── 1. Validate ──
  console.log(`\n${c.dim}[1/3] Validating seed data...${c.reset}`);
  const { ok, errors } = validateEntries(ALL_CALENDAR_ENTRIES);
  if (!ok) {
    console.error(`\n${c.red}${c.bold}❌ Validation FAILED:${c.reset}\n`);
    for (const e of errors) {
      console.error(`  ${c.red}✗${c.reset} ${e}`);
    }
    process.exit(1);
  }
  console.log(`  ${c.green}✓${c.reset} All ${ALL_CALENDAR_ENTRIES.length} entries valid`);

  // Distribution by type & year
  const byYear = new Map<number, number>();
  const byType = new Map<string, number>();
  for (const e of ALL_CALENDAR_ENTRIES) {
    const yr = parseInt(e.date.substring(0, 4), 10);
    byYear.set(yr, (byYear.get(yr) ?? 0) + 1);
    byType.set(e.day_type, (byType.get(e.day_type) ?? 0) + 1);
  }
  console.log(`  ${c.dim}By year:${c.reset}`);
  for (const [yr, count] of [...byYear.entries()].sort()) {
    console.log(`    ${yr}: ${count} entries`);
  }
  console.log(`  ${c.dim}By type:${c.reset}`);
  for (const [type, count] of [...byType.entries()].sort()) {
    console.log(`    ${type}: ${count}`);
  }

  // ── 2. Upsert ──
  console.log(`\n${c.dim}[2/3] Upserting to public.taiwan_calendar_days...${c.reset}`);
  const supabase = adminClient();
  const rows = ALL_CALENDAR_ENTRIES.map(entryToRow);

  const { error: upsertError, data } = await supabase
    .from("taiwan_calendar_days")
    .upsert(rows, { onConflict: "date" })
    .select();

  if (upsertError) {
    console.error(`\n${c.red}${c.bold}❌ Upsert failed:${c.reset}`);
    console.error(`  ${c.red}${upsertError.message}${c.reset}`);
    if (upsertError.details) console.error(`  Details: ${upsertError.details}`);
    if (upsertError.hint) console.error(`  Hint: ${upsertError.hint}`);
    process.exit(1);
  }

  console.log(`  ${c.green}✓${c.reset} Upserted ${data?.length ?? rows.length} rows`);

  // ── 3. Verify by re-reading ──
  console.log(`\n${c.dim}[3/3] Verifying via re-read...${c.reset}`);
  const { data: verified, error: readError } = await supabase
    .from("taiwan_calendar_days")
    .select("date, year, day_type, is_working_day")
    .in("year", [...SEEDED_YEARS])
    .order("date", { ascending: true });

  if (readError) {
    console.error(`\n${c.red}❌ Verification read failed:${c.reset} ${readError.message}`);
    process.exit(1);
  }

  if (!verified || verified.length !== rows.length) {
    console.error(
      `\n${c.red}❌ Row count mismatch:${c.reset} expected ${rows.length}, got ${verified?.length}`,
    );
    process.exit(1);
  }

  // Spot-check a few critical entries
  const checks = [
    { date: "2026-02-17", expectedType: "national_holiday", desc: "2026 春節初一" },
    { date: "2026-05-01", expectedType: "national_holiday", desc: "2026 勞動節" },
    { date: "2024-02-17", expectedType: "adjustment_workday", desc: "2024 補班 (pre-reform)" },
    { date: "2025-02-08", expectedType: "adjustment_workday", desc: "2025 補班 (pre-reform)" },
    { date: "2026-12-25", expectedType: "national_holiday", desc: "2026 行憲紀念日" },
  ];

  let checkPasses = 0;
  for (const check of checks) {
    const row = verified.find((r) => r.date === check.date);
    if (row && row.day_type === check.expectedType) {
      console.log(`  ${c.green}✓${c.reset} ${check.date} (${check.desc}) → ${row.day_type}`);
      checkPasses++;
    } else {
      console.error(
        `  ${c.red}✗${c.reset} ${check.date} (${check.desc}) → expected ${check.expectedType}, got ${row?.day_type ?? "MISSING"}`,
      );
    }
  }

  if (checkPasses !== checks.length) {
    console.error(
      `\n${c.red}❌ Spot-check failed: ${checkPasses}/${checks.length} passed${c.reset}`,
    );
    process.exit(1);
  }

  console.log(
    `\n${c.green}${c.bold}✅ Calendar seed complete — ${rows.length} rows verified.${c.reset}`,
  );
  console.log(
    `${c.dim}Years available: ${SEEDED_YEARS.join(", ")}. Update in June/July ${LATEST_SEEDED_YEAR} for next year.${c.reset}\n`,
  );
}

main().catch((err) => {
  console.error(`\n${c.red}${c.bold}FATAL ERROR:${c.reset} ${(err as Error).message}`);
  console.error((err as Error).stack);
  process.exit(1);
});
