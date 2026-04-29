// src/lib/payroll/payrollPersistence.ts
//
// Atlas EIP — Payroll Persistence Layer
// ──────────────────────────────────────────────────────────────────────
// Phase 3d.1+3d.2 implementation.
//
// Wraps the public.payroll_persist_run() Postgres function which atomically:
//   1. Marks any prior non-superseded run for (org, period) as superseded
//   2. Inserts a new payroll_runs row
//   3. Updates the prior run's superseded_by_run_id (forward link)
//   4. Bulk inserts all line items
//
// All four steps execute in a single Postgres function — atomicity
// guaranteed. If any step fails, the entire write rolls back.
//
// USAGE:
//   const { runId } = await persistPayrollRun({
//     runResult,           // from computeLeaveDeductions
//     triggeredBy: 'user_xxx',
//     triggeredByName: 'Jane Doe',
//   });
//
// READ-BACK:
//   getPayrollRun(runId)              — fetch a specific run
//   getCurrentPayrollRun(org, year, month) — fetch the current run for a period
//   getPayrollLineItems(runId)        — fetch all line items for a run

import { adminClient } from "../supabase/admin";
import type {
  LeaveDeductionRunResult,
  EmployeeLeaveDeductionResult,
  LeaveOccurrenceResult,
} from "./leaveDeduction";

// ── Public types ─────────────────────────────────────────────────────

/**
 * Line item types that can appear in payroll_line_items.line_type.
 * Mirrors the CHECK constraint on the table.
 */
export type PayrollLineType =
  | "leave_deduction"
  | "attendance_bonus_deduction"
  | "attendance_bonus_paid"
  | "leave_filtered";

/**
 * Result of a successful persistence call.
 */
export type PersistPayrollRunResult = {
  /** UUID of the newly-created payroll_runs row */
  runId: string;
  /**
   * UUID of the run that was superseded (marked superseded_at = now())
   * by this new run, or null if this is the first run for the period.
   */
  supersededRunId: string | null;
  /** Number of line items written */
  lineItemsWritten: number;
};

/**
 * Read-back: a payroll_runs row with full detail.
 */
export type PayrollRunRow = {
  id: string;
  organizationId: string;
  periodYear: number;
  periodMonth: number;
  periodStartDate: string;
  periodEndDate: string;
  calculatorVersion: string;
  triggeredBy: string | null;
  triggeredByName: string | null;
  startedAt: string;
  completedAt: string;
  computeTimeMs: number | null;
  supersededAt: string | null;
  supersededByRunId: string | null;
  totalEmployees: number;
  totalLeaveDeductionAmount: number;
  totalAttendanceBonusDeduction: number;
  runWarnings: string[];
  auditPayload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Read-back: a payroll_line_items row.
 */
export type PayrollLineItemRow = {
  id: string;
  runId: string;
  organizationId: string;
  userId: string;
  periodYear: number;
  periodMonth: number;
  lineType: PayrollLineType;
  amount: number;
  days: number;
  halfPayDays: number;
  fullPayDays: number;
  unpaidDays: number;
  sourceWorkflowSubmissionId: string | null;
  leaveTypeRaw: string | null;
  canonicalKey: string | null;
  auditPayload: Record<string, unknown>;
  createdAt: string;
};

// ── Internal: payload assembly ───────────────────────────────────────

/**
 * The shape we send to the Postgres function. Matches what the function
 * expects to deserialize from JSONB.
 */
type PersistPayload = {
  organization_id: string;
  period_year: number;
  period_month: number;
  period_start_date: string;
  period_end_date: string;
  calculator_version: string;
  triggered_by: string | null;
  triggered_by_name: string | null;
  started_at: string;
  completed_at: string;
  compute_time_ms: number | null;
  total_employees: number;
  total_leave_deduction_amount: number;
  total_attendance_bonus_deduction: number;
  run_warnings: string[];
  audit_payload: Record<string, unknown> | null;
  line_items: PersistLineItemPayload[];
};

type PersistLineItemPayload = {
  user_id: string;
  line_type: PayrollLineType;
  amount: number;
  days: number;
  half_pay_days: number;
  full_pay_days: number;
  unpaid_days: number;
  source_workflow_submission_id: string | null;
  leave_type_raw: string | null;
  canonical_key: string | null;
  audit_payload: Record<string, unknown>;
};

/**
 * Build the line item payload from a single LeaveOccurrenceResult.
 *
 * Maps the in-memory result shape to the DB row shape. One leave
 * occurrence becomes one line item.
 *
 * Note: filtered leaves (e.g., parental_leave skipped from payroll)
 * still produce a line for audit purposes — line_type='leave_filtered',
 * amount=0. This preserves the audit chain back to workflow_submissions.
 */
function buildLeaveLineItem(
  userId: string,
  occ: LeaveOccurrenceResult,
): PersistLineItemPayload {
  // Was the record filtered (e.g., parental_leave)?
  if (occ.filteredAsSkipFromPayroll) {
    return {
      user_id: userId,
      line_type: "leave_filtered",
      amount: 0,
      days: occ.daysInPeriod,
      half_pay_days: 0,
      full_pay_days: 0,
      unpaid_days: 0,
      source_workflow_submission_id: occ.sourceWorkflowSubmissionId,
      leave_type_raw: occ.leaveTypeRaw,
      canonical_key:
        occ.classification.ok === true
          ? occ.classification.canonicalKey
          : null,
      audit_payload: {
        filtered_reason: "parental_leave or other skip_from_payroll",
        ...(occ.payTreatment ? { pay_treatment_kind: occ.payTreatment.treatmentKind } : {}),
      },
    };
  }

  const pt = occ.payTreatment;
  return {
    user_id: userId,
    line_type: "leave_deduction",
    amount: pt?.deductionAmount ?? 0,
    days: occ.daysInPeriod,
    half_pay_days: pt?.halfPayDays ?? 0,
    full_pay_days: pt?.fullPayDays ?? 0,
    unpaid_days: pt?.unpaidDays ?? 0,
    source_workflow_submission_id: occ.sourceWorkflowSubmissionId,
    leave_type_raw: occ.leaveTypeRaw,
    canonical_key:
      occ.classification.ok === true ? occ.classification.canonicalKey : null,
    audit_payload: pt
      ? {
          calculation_detail: pt.calculationDetail,
          notes: pt.notes,
          treatment_kind: pt.treatmentKind,
          daily_rate_used: pt.dailyRateUsed,
          attendance_bonus_interaction: pt.attendanceBonusInteraction,
        }
      : {},
  };
}

/**
 * Build the line items for the attendance bonus result.
 *
 * We emit TWO lines for clarity:
 *   - One 'attendance_bonus_deduction' line with the deduction amount
 *   - One 'attendance_bonus_paid' line with the net bonus actually paid
 *
 * Both reference the same audit payload (the full breakdown). When
 * originalBonus is 0 (employee has no bonus configured), we skip both
 * lines — no need to log zeroed-out non-existent bonus.
 */
function buildAttendanceBonusLineItems(
  emp: EmployeeLeaveDeductionResult,
): PersistLineItemPayload[] {
  const ab = emp.attendanceBonus;
  if (ab.originalBonus <= 0) return [];

  const auditPayload: Record<string, unknown> = {
    original_bonus: ab.originalBonus,
    calculator_version: ab.calculatorVersion,
    breakdown: ab.breakdown,
    notes: ab.notes,
  };

  return [
    {
      user_id: emp.userId,
      line_type: "attendance_bonus_deduction",
      amount: ab.totalDeduction,
      days: 0,
      half_pay_days: 0,
      full_pay_days: 0,
      unpaid_days: 0,
      source_workflow_submission_id: null,
      leave_type_raw: null,
      canonical_key: null,
      audit_payload: auditPayload,
    },
    {
      user_id: emp.userId,
      line_type: "attendance_bonus_paid",
      amount: ab.netBonus,
      days: 0,
      half_pay_days: 0,
      full_pay_days: 0,
      unpaid_days: 0,
      source_workflow_submission_id: null,
      leave_type_raw: null,
      canonical_key: null,
      audit_payload: auditPayload,
    },
  ];
}

/**
 * Roll up an entire LeaveDeductionRunResult into the persistence payload.
 *
 * Aggregates totals across employees for the run-level summary fields.
 * Flattens all line items into a single array.
 */
export function buildPersistPayload(input: {
  runResult: LeaveDeductionRunResult;
  triggeredBy: string | null;
  triggeredByName: string | null;
  startedAt?: string; // ISO; defaults to runResult.computeTime semantics
  completedAt?: string;
}): PersistPayload {
  const { runResult, triggeredBy, triggeredByName } = input;

  // Aggregate totals
  let totalLeaveDeduction = 0;
  let totalAttendanceBonusDeduction = 0;
  const lineItems: PersistLineItemPayload[] = [];

  for (const emp of runResult.employees) {
    totalLeaveDeduction += emp.totalLeaveDeductionAmount;
    totalAttendanceBonusDeduction += emp.attendanceBonus.totalDeduction;

    // Per-leave line items
    for (const occ of emp.leaveOccurrences) {
      lineItems.push(buildLeaveLineItem(emp.userId, occ));
    }

    // Attendance bonus line items (if applicable)
    lineItems.push(...buildAttendanceBonusLineItems(emp));
  }

  // started_at/completed_at: if caller didn't supply, derive from now()
  // and use compute_time_ms to back-date started_at. Defensive default.
  const completedAt =
    input.completedAt ?? new Date().toISOString();
  const startedAt =
    input.startedAt ??
    new Date(
      new Date(completedAt).getTime() - runResult.computeTimeMs,
    ).toISOString();

  return {
    organization_id: runResult.organizationId,
    period_year: runResult.periodYear,
    period_month: runResult.periodMonth,
    period_start_date: runResult.periodStartDate,
    period_end_date: runResult.periodEndDate,
    calculator_version: runResult.calculatorVersion,
    triggered_by: triggeredBy,
    triggered_by_name: triggeredByName,
    started_at: startedAt,
    completed_at: completedAt,
    compute_time_ms: runResult.computeTimeMs,
    total_employees: runResult.employees.length,
    total_leave_deduction_amount: totalLeaveDeduction,
    total_attendance_bonus_deduction: totalAttendanceBonusDeduction,
    run_warnings: runResult.runWarnings,
    audit_payload: null,
    line_items: lineItems,
  };
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Persist a payroll run atomically.
 *
 * Calls public.payroll_persist_run() via Supabase RPC. The function
 * supersedes any prior current run for the same (org, period) and
 * inserts the new run + all line items in one transaction.
 *
 * @throws Error if validation fails or DB write errors
 */
export async function persistPayrollRun(input: {
  runResult: LeaveDeductionRunResult;
  triggeredBy: string | null;
  triggeredByName: string | null;
}): Promise<PersistPayrollRunResult> {
  const payload = buildPersistPayload(input);
  const supabase = adminClient();

  // Find what will be superseded BEFORE the write, so we can return it
  // in the result. (The function itself returns only the new run_id.)
  const { data: priorRun, error: priorErr } = await supabase
    .from("payroll_runs")
    .select("id")
    .eq("organization_id", payload.organization_id)
    .eq("period_year", payload.period_year)
    .eq("period_month", payload.period_month)
    .is("superseded_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (priorErr) {
    throw new Error(
      `[payrollPersistence] Failed to query prior run: ${priorErr.message}`,
    );
  }

  // Call the atomic function
  const { data: newRunId, error: rpcErr } = await supabase.rpc(
    "payroll_persist_run",
    { payload },
  );

  if (rpcErr) {
    throw new Error(
      `[payrollPersistence] payroll_persist_run failed: ${rpcErr.message}`,
    );
  }

  if (typeof newRunId !== "string") {
    throw new Error(
      `[payrollPersistence] Unexpected return from RPC: ${JSON.stringify(newRunId)}`,
    );
  }

  return {
    runId: newRunId,
    supersededRunId: priorRun?.id ?? null,
    lineItemsWritten: payload.line_items.length,
  };
}

// ── Read-back helpers ────────────────────────────────────────────────

/**
 * Fetch a specific payroll run by ID.
 */
export async function getPayrollRun(
  runId: string,
): Promise<PayrollRunRow | null> {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[payrollPersistence] Failed to fetch run ${runId}: ${error.message}`,
    );
  }
  if (!data) return null;
  return mapRunRow(data);
}

/**
 * Fetch the current (non-superseded) run for an (org, period).
 * Returns null if no run exists.
 */
export async function getCurrentPayrollRun(input: {
  organizationId: string;
  periodYear: number;
  periodMonth: number;
}): Promise<PayrollRunRow | null> {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("period_year", input.periodYear)
    .eq("period_month", input.periodMonth)
    .is("superseded_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[payrollPersistence] Failed to fetch current run: ${error.message}`,
    );
  }
  if (!data) return null;
  return mapRunRow(data);
}

/**
 * Fetch all line items for a given run.
 */
export async function getPayrollLineItems(
  runId: string,
): Promise<PayrollLineItemRow[]> {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("payroll_line_items")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `[payrollPersistence] Failed to fetch line items: ${error.message}`,
    );
  }
  return (data ?? []).map(mapLineItemRow);
}

// ── Row mappers (snake_case DB → camelCase TS) ──────────────────────

function mapRunRow(r: Record<string, unknown>): PayrollRunRow {
  return {
    id: r.id as string,
    organizationId: r.organization_id as string,
    periodYear: r.period_year as number,
    periodMonth: r.period_month as number,
    periodStartDate: r.period_start_date as string,
    periodEndDate: r.period_end_date as string,
    calculatorVersion: r.calculator_version as string,
    triggeredBy: (r.triggered_by as string | null) ?? null,
    triggeredByName: (r.triggered_by_name as string | null) ?? null,
    startedAt: r.started_at as string,
    completedAt: r.completed_at as string,
    computeTimeMs: (r.compute_time_ms as number | null) ?? null,
    supersededAt: (r.superseded_at as string | null) ?? null,
    supersededByRunId: (r.superseded_by_run_id as string | null) ?? null,
    totalEmployees: r.total_employees as number,
    totalLeaveDeductionAmount: Number(r.total_leave_deduction_amount),
    totalAttendanceBonusDeduction: Number(
      r.total_attendance_bonus_deduction,
    ),
    runWarnings: (r.run_warnings as string[]) ?? [],
    auditPayload:
      (r.audit_payload as Record<string, unknown> | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function mapLineItemRow(r: Record<string, unknown>): PayrollLineItemRow {
  return {
    id: r.id as string,
    runId: r.run_id as string,
    organizationId: r.organization_id as string,
    userId: r.user_id as string,
    periodYear: r.period_year as number,
    periodMonth: r.period_month as number,
    lineType: r.line_type as PayrollLineType,
    amount: Number(r.amount),
    days: Number(r.days),
    halfPayDays: Number(r.half_pay_days),
    fullPayDays: Number(r.full_pay_days),
    unpaidDays: Number(r.unpaid_days),
    sourceWorkflowSubmissionId:
      (r.source_workflow_submission_id as string | null) ?? null,
    leaveTypeRaw: (r.leave_type_raw as string | null) ?? null,
    canonicalKey: (r.canonical_key as string | null) ?? null,
    auditPayload:
      (r.audit_payload as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
  };
}
