-- supabase/migrations/20260429000003_payroll_persist_run_function.sql
--
-- Atlas EIP — Phase 3d.1+3d.2 (continued)
-- Created: 2026-04-29
--
-- Atomic persistence function for payroll runs.
--
-- ATOMICITY GUARANTEE:
--   PostgreSQL function bodies execute inside an implicit transaction.
--   If any statement fails (constraint violation, missing FK target,
--   bad JSONB shape, etc.), the entire function rolls back. Caller sees
--   the error; database state is unchanged.
--
-- DESIGN:
--   Input is a single JSONB payload mirroring the LeaveDeductionRunResult
--   shape from leaveDeduction.ts. Function:
--     1. Marks prior non-superseded run for (org, period) as superseded
--     2. INSERTs new payroll_runs row, captures run_id
--     3. UPDATEs prior run's superseded_by_run_id to point forward
--     4. Bulk INSERTs all line items
--   Returns the new run_id.
--
-- USAGE FROM TYPESCRIPT:
--   const { data, error } = await supabase.rpc('payroll_persist_run', {
--     payload: { ...runData }
--   });
--
-- IDEMPOTENCY:
--   This function is NOT idempotent by design. Each call creates a NEW
--   run row. To re-run a period, just call again — soft-replace handles
--   the previous one. Calling twice with the same input creates TWO
--   runs (the second supersedes the first). That's intentional.

BEGIN;

CREATE OR REPLACE FUNCTION public.payroll_persist_run(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_run_id uuid;
  v_prior_run_id uuid;
  v_org_id uuid;
  v_period_year integer;
  v_period_month integer;
  v_line_items_inserted integer;
BEGIN
  -- ── Validate required top-level fields ──

  IF payload IS NULL THEN
    RAISE EXCEPTION 'payroll_persist_run: payload is null';
  END IF;

  v_org_id := (payload->>'organization_id')::uuid;
  v_period_year := (payload->>'period_year')::integer;
  v_period_month := (payload->>'period_month')::integer;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'payroll_persist_run: organization_id is required';
  END IF;
  IF v_period_year IS NULL THEN
    RAISE EXCEPTION 'payroll_persist_run: period_year is required';
  END IF;
  IF v_period_month IS NULL THEN
    RAISE EXCEPTION 'payroll_persist_run: period_month is required';
  END IF;

  -- ── Step 1: Find prior non-superseded run for this (org, period) ──

  SELECT id INTO v_prior_run_id
  FROM public.payroll_runs
  WHERE organization_id = v_org_id
    AND period_year = v_period_year
    AND period_month = v_period_month
    AND superseded_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;

  -- ── Step 2: Insert the new run row ──

  INSERT INTO public.payroll_runs (
    organization_id,
    period_year,
    period_month,
    period_start_date,
    period_end_date,
    calculator_version,
    triggered_by,
    triggered_by_name,
    started_at,
    completed_at,
    compute_time_ms,
    total_employees,
    total_leave_deduction_amount,
    total_attendance_bonus_deduction,
    run_warnings,
    audit_payload
  )
  VALUES (
    v_org_id,
    v_period_year,
    v_period_month,
    (payload->>'period_start_date')::date,
    (payload->>'period_end_date')::date,
    payload->>'calculator_version',
    payload->>'triggered_by',
    payload->>'triggered_by_name',
    COALESCE((payload->>'started_at')::timestamptz, now()),
    COALESCE((payload->>'completed_at')::timestamptz, now()),
    NULLIF((payload->>'compute_time_ms'), '')::integer,
    COALESCE((payload->>'total_employees')::integer, 0),
    COALESCE((payload->>'total_leave_deduction_amount')::numeric, 0),
    COALESCE((payload->>'total_attendance_bonus_deduction')::numeric, 0),
    COALESCE(payload->'run_warnings', '[]'::jsonb),
    payload->'audit_payload'
  )
  RETURNING id INTO v_new_run_id;

  -- ── Step 3: Mark prior run (if any) as superseded ──

  IF v_prior_run_id IS NOT NULL THEN
    UPDATE public.payroll_runs
    SET
      superseded_at = now(),
      superseded_by_run_id = v_new_run_id
    WHERE id = v_prior_run_id;
  END IF;

  -- ── Step 4: Bulk insert line items ──
  --
  -- Iterate the JSONB array. PostgreSQL's json* functions are well-suited
  -- for this. Each element should have the shape documented in the
  -- payroll_line_items table.

  IF payload->'line_items' IS NOT NULL
     AND jsonb_typeof(payload->'line_items') = 'array' THEN
    INSERT INTO public.payroll_line_items (
      run_id,
      organization_id,
      user_id,
      period_year,
      period_month,
      line_type,
      amount,
      days,
      half_pay_days,
      full_pay_days,
      unpaid_days,
      source_workflow_submission_id,
      leave_type_raw,
      canonical_key,
      audit_payload
    )
    SELECT
      v_new_run_id,
      v_org_id,
      item->>'user_id',
      v_period_year,
      v_period_month,
      item->>'line_type',
      COALESCE((item->>'amount')::numeric, 0),
      COALESCE((item->>'days')::numeric, 0),
      COALESCE((item->>'half_pay_days')::numeric, 0),
      COALESCE((item->>'full_pay_days')::numeric, 0),
      COALESCE((item->>'unpaid_days')::numeric, 0),
      item->>'source_workflow_submission_id',
      item->>'leave_type_raw',
      item->>'canonical_key',
      COALESCE(item->'audit_payload', '{}'::jsonb)
    FROM jsonb_array_elements(payload->'line_items') AS item;

    GET DIAGNOSTICS v_line_items_inserted = ROW_COUNT;
  ELSE
    v_line_items_inserted := 0;
  END IF;

  -- Return the new run_id; line item count is implicit in the insert.
  RETURN v_new_run_id;
END;
$$;

COMMENT ON FUNCTION public.payroll_persist_run(jsonb) IS
  'Atomically persists a payroll run. Soft-supersedes any prior current run for the same (org, period). All inserts/updates roll back if any step fails. Called via Supabase RPC from payrollPersistence.ts.';

-- ── Grant execute to service_role (which is what admin client uses) ──
-- The function is SECURITY DEFINER, so it runs as the function owner
-- (typically postgres) and bypasses RLS. This is intentional — only the
-- backend's admin client should be calling it.

REVOKE EXECUTE ON FUNCTION public.payroll_persist_run(jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.payroll_persist_run(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.payroll_persist_run(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_persist_run(jsonb) TO service_role;

COMMIT;
