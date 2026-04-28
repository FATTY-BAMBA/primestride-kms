-- supabase/migrations/20260428000001_taiwan_calendar_days.sql
--
-- Atlas EIP — Phase 3b.5 Step 1
-- Created: 2026-04-28
--
-- Authoritative reference table for Taiwan's official 行政院 行事曆
-- (DGPA — Directorate-General of Personnel Administration).
--
-- Supports working-day calculations for:
--   - payroll Gap #1 fix (病假 day-31+ work-day vs calendar-day distinction
--     per 勞動條3字第1120147882號函)
--   - clock-in validation
--   - overtime detection
--   - attendance reporting
--
-- DESIGN NOTES:
--   - Primary key is `date` (natural key, one row per date)
--   - is_working_day is materialized for query speed; seed script validates
--     consistency with day_type
--   - Default behavior (NO row exists for a date):
--       Mon-Fri = workday, Saturday = 休息日 (rest day), Sunday = 例假
--     Rows in this table represent EXCEPTIONS to that default.
--   - 6 day_type values cover all observed cases per 行政院 行事曆
--   - RLS: read for authenticated users; writes only via service role (seed)
--
-- Migration is idempotent: rerunning produces no errors and no duplicates.
-- Seed data is loaded separately via scripts/seed-taiwan-calendar.ts.

BEGIN;

-- ── Table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.taiwan_calendar_days (
  -- Identity
  date date PRIMARY KEY,
  year integer NOT NULL,

  -- Classification
  day_type text NOT NULL,
  is_working_day boolean NOT NULL,

  -- Display & audit
  name_zh text,
  name_en text,
  notes text,

  -- Source attribution (for verifiability)
  source_url text NOT NULL,
  source_published_at date,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Validation: day_type enum
  CONSTRAINT taiwan_calendar_days_day_type_valid CHECK (day_type IN (
    'national_holiday',     -- 國定假日 (元旦, 春節, 清明節, 端午, 中秋, 雙十, etc.)
    'compensatory_off',     -- 補假 (when holiday falls on weekend → make-up off-day)
    'adjustment_workday',   -- 調整工作日 (Saturday worked to give a long weekend)
    'memorial_day',         -- 紀念日 (e.g., 二二八 if treated specially)
    'typhoon_day',          -- 颱風假 (declared by local government, ad-hoc)
    'regular_workday'       -- explicit override: this IS a workday despite calendar default
  )),

  -- Year denormalization integrity
  CONSTRAINT taiwan_calendar_days_year_matches_date 
    CHECK (year = EXTRACT(YEAR FROM date)::integer)
);

COMMENT ON TABLE public.taiwan_calendar_days IS 
  'Authoritative Taiwan calendar (行政院 行事曆) — exceptions to default working-day rules. Default: Mon-Fri workday, Sat 休息日, Sun 例假. Seeded via scripts/seed-taiwan-calendar.ts.';

COMMENT ON COLUMN public.taiwan_calendar_days.is_working_day IS 
  'Materialized for query speed. Seed script validates consistency with day_type: national_holiday/compensatory_off/memorial_day/typhoon_day → false; adjustment_workday/regular_workday → true.';

-- ── Indexes ──────────────────────────────────────────────────────────

-- Year-bucket lookups (WorkingDayService loads one year at a time)
CREATE INDEX IF NOT EXISTS taiwan_calendar_days_year_idx 
  ON public.taiwan_calendar_days (year);

-- Composite for type-filtered year queries (e.g., "all national holidays in 2026")
CREATE INDEX IF NOT EXISTS taiwan_calendar_days_year_type_idx 
  ON public.taiwan_calendar_days (year, day_type);

-- ── updated_at trigger ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.taiwan_calendar_days_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS taiwan_calendar_days_updated_at_trigger 
  ON public.taiwan_calendar_days;

CREATE TRIGGER taiwan_calendar_days_updated_at_trigger
  BEFORE UPDATE ON public.taiwan_calendar_days
  FOR EACH ROW
  EXECUTE FUNCTION public.taiwan_calendar_days_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.taiwan_calendar_days ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user (calendar is reference data, not tenant-scoped)
DROP POLICY IF EXISTS "calendar_days_read_authenticated" 
  ON public.taiwan_calendar_days;

CREATE POLICY "calendar_days_read_authenticated" 
  ON public.taiwan_calendar_days
  FOR SELECT
  TO authenticated
  USING (true);

-- Writes: deliberately no policy. Only service role (which bypasses RLS)
-- can INSERT/UPDATE/DELETE. This means seed scripts using admin.ts work,
-- but no client/user code can modify calendar data.

COMMIT;
