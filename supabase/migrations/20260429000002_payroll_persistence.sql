-- supabase/migrations/20260429000002_payroll_persistence.sql
--
-- Atlas EIP — Phase 3d.1+3d.2
-- Created: 2026-04-29
--
-- Adds persistence layer for payroll calculations:
--   * payroll_runs: per-run audit log (one row per (org, period, version, run))
--   * payroll_line_items: per-employee per-leave detail (audit chain)
--
-- DESIGN DECISIONS LOCKED:
--   3d.1: Two tables, normalized (payroll_runs as parent, line_items references runs)
--   3d.2: Soft-replace via superseded_at — re-running a period marks the prior
--         run as superseded; new run gets fresh ID + new line items
--   3d.3: Hybrid storage — typed columns for amount/days/line_type/etc.,
--         JSONB audit_payload for the long-tail calculation_detail/notes
--   3d.4: One line per leave occurrence + 1 line per attendance bonus result
--
-- AUDIT NOTE:
--   The payroll_runs table IS the audit log. Every run is logged here with
--   calculator version, who triggered, when, and full run-level warnings.
--   For a 勞動局 inspection, this table answers "what was computed for
--   period X, when, by whom, on what calculator version."
--
-- Migration is idempotent: rerunning produces no errors.

BEGIN;

-- ── Table 1: payroll_runs (parent / audit log) ──────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_runs (
  -- Identity
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,

  -- Period identification
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  period_start_date date NOT NULL,
  period_end_date date NOT NULL,

  -- Calculator provenance
  calculator_version text NOT NULL,

  -- Run lifecycle
  triggered_by text,                 -- Clerk user_id of whoever triggered
  triggered_by_name text,            -- Snapshot for audit (in case profile changes later)
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL DEFAULT now(),
  compute_time_ms integer,

  -- Soft-replace pattern (Decision 3d.2)
  superseded_at timestamptz,         -- NULL = current; non-null = replaced by a later run
  superseded_by_run_id uuid,         -- FK to the run that replaced this one (forward link)

  -- Run-level summary (denormalized for fast queries)
  total_employees integer NOT NULL DEFAULT 0,
  total_leave_deduction_amount numeric NOT NULL DEFAULT 0,
  total_attendance_bonus_deduction numeric NOT NULL DEFAULT 0,

  -- Audit blobs
  run_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,    -- aggregator + run-level warnings
  audit_payload jsonb,                                 -- reserved for future audit detail

  -- Bookkeeping
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT payroll_runs_period_month_valid
    CHECK (period_month BETWEEN 1 AND 12),
  CONSTRAINT payroll_runs_period_year_valid
    CHECK (period_year BETWEEN 2020 AND 2100),
  CONSTRAINT payroll_runs_dates_consistent
    CHECK (period_end_date >= period_start_date),
  CONSTRAINT payroll_runs_completed_after_started
    CHECK (completed_at >= started_at),
  CONSTRAINT payroll_runs_amounts_non_negative
    CHECK (
      total_leave_deduction_amount >= 0
      AND total_attendance_bonus_deduction >= 0
      AND total_employees >= 0
    ),
  CONSTRAINT payroll_runs_superseded_consistency
    CHECK (
      (superseded_at IS NULL AND superseded_by_run_id IS NULL)
      OR (superseded_at IS NOT NULL AND superseded_by_run_id IS NOT NULL)
    )
);

COMMENT ON TABLE public.payroll_runs IS
  'Atlas EIP payroll run audit log. One row per execution of computeLeaveDeductions for an (org, period). Soft-replace pattern: re-runs mark prior runs as superseded but preserve history for audit. Required for 勞動局 inspections.';

COMMENT ON COLUMN public.payroll_runs.superseded_at IS
  'NULL = this is the current authoritative run for the period. Non-NULL = this run was replaced by a later one (see superseded_by_run_id). Default queries should filter WHERE superseded_at IS NULL.';

COMMENT ON COLUMN public.payroll_runs.calculator_version IS
  'Stable version stamp from leaveDeduction.CALCULATOR_VERSION. Bumps on any behavioral change. Required to reproduce a historical calculation.';

-- Indexes

-- Primary access pattern: "show me the current run for this org/period"
CREATE INDEX IF NOT EXISTS payroll_runs_org_period_current_idx
  ON public.payroll_runs (organization_id, period_year, period_month)
  WHERE superseded_at IS NULL;

-- Historical access: "show me all runs for this period (incl. superseded)"
CREATE INDEX IF NOT EXISTS payroll_runs_org_period_all_idx
  ON public.payroll_runs (organization_id, period_year, period_month, started_at DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.payroll_runs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_runs_updated_at_trigger ON public.payroll_runs;
CREATE TRIGGER payroll_runs_updated_at_trigger
  BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.payroll_runs_set_updated_at();

-- ── Table 2: payroll_line_items (children) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_line_items (
  -- Identity
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to parent run (cascading delete preserves referential integrity)
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,

  -- Denormalized for query convenience (avoids JOIN for common filters)
  organization_id uuid NOT NULL,
  user_id text NOT NULL,                       -- Clerk user_id (text, not uuid)
  period_year integer NOT NULL,
  period_month integer NOT NULL,

  -- Line classification
  line_type text NOT NULL,
  -- Allowed values:
  --   'leave_deduction'          : per-leave-occurrence deduction
  --   'attendance_bonus_deduction': bonus deduction from attendanceBonusCalc
  --   'attendance_bonus_paid'    : the bonus amount actually paid (after deduction)
  --   'leave_filtered'           : record was filtered (e.g., parental_leave); $0 line for audit

  -- Materialized typed fields (Decision 3d.3 — hybrid)
  amount numeric NOT NULL DEFAULT 0,           -- positive = deduction, can be 0
  days numeric NOT NULL DEFAULT 0,             -- relevant day count (full-pay, half-pay, unpaid as applicable)
  half_pay_days numeric NOT NULL DEFAULT 0,
  full_pay_days numeric NOT NULL DEFAULT 0,
  unpaid_days numeric NOT NULL DEFAULT 0,

  -- Audit chain to source record
  source_workflow_submission_id text,          -- workflow_submissions.id; NULL for non-leave lines
  leave_type_raw text,                         -- as submitted; NULL for non-leave
  canonical_key text,                          -- classified canonical key; NULL if unclassified

  -- Hybrid: long-tail audit detail in JSONB (Decision 3d.3)
  audit_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Shape varies by line_type:
  --   leave_deduction: {
  --     calculation_detail: string,
  --     notes: string[],
  --     treatment_kind: string,
  --     daily_rate_used: number,
  --     attendance_bonus_interaction: { protected, proportionalDeduction, note },
  --   }
  --   attendance_bonus_deduction: {
  --     original_bonus: number,
  --     calculator_version: string,
  --     breakdown: AttendanceBonusBreakdownEntry[],
  --     notes: string[],
  --   }

  -- Bookkeeping
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT payroll_line_items_amount_non_negative
    CHECK (amount >= 0),
  CONSTRAINT payroll_line_items_days_non_negative
    CHECK (
      days >= 0
      AND half_pay_days >= 0
      AND full_pay_days >= 0
      AND unpaid_days >= 0
    ),
  CONSTRAINT payroll_line_items_line_type_valid
    CHECK (line_type IN (
      'leave_deduction',
      'attendance_bonus_deduction',
      'attendance_bonus_paid',
      'leave_filtered'
    ))
);

COMMENT ON TABLE public.payroll_line_items IS
  'Per-employee per-line-item detail of a payroll run. One row per leave occurrence + one per attendance bonus result. Audit chain to workflow_submissions preserved via source_workflow_submission_id.';

-- Indexes

CREATE INDEX IF NOT EXISTS payroll_line_items_run_idx
  ON public.payroll_line_items (run_id);

CREATE INDEX IF NOT EXISTS payroll_line_items_user_period_idx
  ON public.payroll_line_items (user_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS payroll_line_items_org_period_idx
  ON public.payroll_line_items (organization_id, period_year, period_month);

-- Source workflow lookup for audit ("which line item came from this leave?")
CREATE INDEX IF NOT EXISTS payroll_line_items_source_workflow_idx
  ON public.payroll_line_items (source_workflow_submission_id)
  WHERE source_workflow_submission_id IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_line_items ENABLE ROW LEVEL SECURITY;

-- Read access: ACTIVE organization members can read their own org's runs.
-- Note: is_active is nullable; treat NULL the same as TRUE (legacy rows
-- predate the column being populated). Enforce explicitly to avoid leaks.
DROP POLICY IF EXISTS payroll_runs_read_org_members ON public.payroll_runs;
CREATE POLICY payroll_runs_read_org_members
  ON public.payroll_runs
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = (SELECT auth.jwt() ->> 'sub')
        AND COALESCE(is_active, true) = true
    )
  );

DROP POLICY IF EXISTS payroll_line_items_read_org_members ON public.payroll_line_items;
CREATE POLICY payroll_line_items_read_org_members
  ON public.payroll_line_items
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = (SELECT auth.jwt() ->> 'sub')
        AND COALESCE(is_active, true) = true
    )
  );

-- Writes: deliberately no policy for authenticated. Only the service role
-- (which bypasses RLS) can INSERT/UPDATE. This prevents arbitrary clients
-- from forging payroll history; only the backend (via admin client) writes.

COMMIT;
