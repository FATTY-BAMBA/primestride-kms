-- 20260501000001_pay_basis_and_statutory_minimums.sql
--
-- Phase 3k.1: Wage validation foundation.
--
-- Context: Taiwan's Labor Standards Act sets a minimum wage that applies
-- differently depending on how a worker is paid (monthly vs hourly vs daily
-- vs piecework), not solely on whether they are full-time or part-time.
-- Yesterday's Zod schema (Phase 3j) hardcoded a NT$29,500 floor against
-- salary_base regardless of pay basis or employment type, which is wrong
-- for hourly workers, contractors, interns, and part-timers paid below
-- a prorated monthly rate.
--
-- This migration adds the pay_basis column and the statutory_minimums
-- reference table that subsequent application-layer validation will use.
-- It deliberately does NOT add a wage-floor CHECK constraint, because
-- the correct rule is date-versioned (the minimum changes annually) and
-- multi-field (depends on pay_basis + employment_type). Such a rule
-- belongs in app code that can read the date-versioned reference table,
-- not in a CHECK clause that future maintainers would have to ALTER each
-- January.
--
-- The only DB-level CHECK we add for salary_base here is shape:
-- salary_base >= 0. That is safe to enforce regardless of jurisdiction,
-- year, or worker type.

BEGIN;

-- ----------------------------------------------------------------------
-- 1. statutory_minimums: date-versioned reference table for wage floors.
-- ----------------------------------------------------------------------
-- Keyed by (jurisdiction, effective_date). Application code looks up the
-- row whose effective_date is the latest one <= the period being computed.
-- Adding next year's minimum is a single INSERT, not a schema change.
--
-- We store both monthly and hourly minimums together because Taiwan's
-- MOL announces them as a pair and they always change together.

CREATE TABLE IF NOT EXISTS statutory_minimums (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction    text NOT NULL DEFAULT 'TW',
  effective_date  date NOT NULL,
  monthly_minimum integer NOT NULL,
  hourly_minimum  integer NOT NULL,
  source_url      text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT statutory_minimums_jurisdiction_date_unique
    UNIQUE (jurisdiction, effective_date),

  CONSTRAINT statutory_minimums_monthly_positive
    CHECK (monthly_minimum > 0),

  CONSTRAINT statutory_minimums_hourly_positive
    CHECK (hourly_minimum > 0)
);

COMMENT ON TABLE statutory_minimums IS
  'Date-versioned statutory minimum wages by jurisdiction. App code reads '
  'the latest row whose effective_date <= the period being computed. Add '
  'next year''s minimum with an INSERT, not a schema change.';

-- ----------------------------------------------------------------------
-- 1a. Seed Taiwan minimum wage history.
-- ----------------------------------------------------------------------
-- 2025 row included for retrospective payroll calculations (e.g., late-
-- approved December 2025 manual entries). 2026 row is current.
-- Source: Ministry of Labor, https://english.mol.gov.tw/

INSERT INTO statutory_minimums (
  jurisdiction, effective_date, monthly_minimum, hourly_minimum,
  source_url, notes
) VALUES
  ('TW', '2025-01-01', 28590, 190,
   'https://english.mol.gov.tw/',
   'Effective 2025-01-01. Up from NT$27,470/NT$183 in 2024.'),
  ('TW', '2026-01-01', 29500, 196,
   'https://english.mol.gov.tw/21139/40790/87087/',
   'Effective 2026-01-01 per MOL announcement 2025-09-26. '
   'Up from NT$28,590/NT$190 in 2025.')
ON CONFLICT (jurisdiction, effective_date) DO NOTHING;

-- ----------------------------------------------------------------------
-- 1b. RLS for statutory_minimums.
-- ----------------------------------------------------------------------
-- Following the convention from taiwan_calendar_days: read-allowed for
-- authenticated users, writes restricted to service-role (which bypasses
-- RLS automatically). The data is public statutory information, not
-- secret, but we keep anon users out for consistency with the codebase.

ALTER TABLE statutory_minimums ENABLE ROW LEVEL SECURITY;

CREATE POLICY statutory_minimums_read_authenticated
  ON statutory_minimums
  FOR SELECT
  TO authenticated
  USING (true);

-- ----------------------------------------------------------------------
-- 2. profiles.pay_basis: how the worker is paid.
-- ----------------------------------------------------------------------
-- Following the codebase convention (no Postgres ENUMs in public schema),
-- we use text + CHECK constraint. This is consistent with how language
-- and other categorical fields are enforced today.
--
-- Allowed values:
--   'monthly'        - Monthly-paid. Salary is a fixed monthly amount.
--   'hourly'         - Hourly-paid. Pay is per hour worked.
--   'daily'          - Daily-paid. Pay is per day worked.
--   'piecework'      - Piecework. Pay is per unit produced.
--   'not_applicable' - For independent contractors who are outside LSA.
--                      salary_base may store contract value or be NULL.
--
-- Default 'monthly' is the safe choice for backfilling existing rows:
-- the legacy salary_base field has always represented a monthly amount
-- in this codebase, so 'monthly' preserves the meaning of existing data
-- across all tenants.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pay_basis text NOT NULL DEFAULT 'monthly';

ALTER TABLE profiles
  ADD CONSTRAINT profiles_pay_basis_check
  CHECK (pay_basis IN ('monthly', 'hourly', 'daily', 'piecework', 'not_applicable'));

COMMENT ON COLUMN profiles.pay_basis IS
  'How the worker is paid. Determines which minimum-wage rule applies. '
  'Allowed values: monthly, hourly, daily, piecework, not_applicable. '
  'not_applicable is for independent contractors who are outside LSA.';

-- ----------------------------------------------------------------------
-- 3. profiles.salary_base: shape-only non-negative constraint.
-- ----------------------------------------------------------------------
-- Wage-floor logic stays in app code. This constraint only catches
-- obvious data errors (negative salaries) and is jurisdiction-, year-,
-- and worker-type-independent.
--
-- NULL is permitted because salary_base is nullable today (13 of 17
-- production rows are NULL, representing users whose org has not yet
-- entered HR data).

ALTER TABLE profiles
  ADD CONSTRAINT profiles_salary_base_non_negative
  CHECK (salary_base IS NULL OR salary_base >= 0);

COMMIT;
