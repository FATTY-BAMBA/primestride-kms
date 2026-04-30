// src/app/api/admin/payroll/run/route.ts
//
// Atlas EIP — Admin Payroll Run API
// ──────────────────────────────────────────────────────────────────────
// Phase 3f early implementation.
//
// POST /api/admin/payroll/run
//
// Body shape:
//   {
//     period_year: number,    // e.g., 2026
//     period_month: number,   // 1-12
//     mode: "preview" | "persist"
//   }
//
// Behavior:
//   - Validates auth (Clerk) and admin/owner role
//   - "preview" mode: runs computeLeaveDeductions, returns result in-memory.
//                     No DB writes. Safe to call repeatedly.
//   - "persist" mode: runs the calculation AND calls persistPayrollRun.
//                     Soft-supersedes any prior current run for the period.
//                     Returns the run_id of the new persisted run.

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";
import { computeLeaveDeductions } from "@/lib/payroll/leaveDeduction";
import { persistPayrollRun } from "@/lib/payroll/payrollPersistence";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // payroll calc can be slow on large orgs

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Helpers ──────────────────────────────────────────────────────────

const ADMIN_ROLES = new Set(["admin", "owner"]);

async function getActorName(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();
  return data?.full_name ?? null;
}

// ── POST handler ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get org context + role check
    const org = await getUserOrganization(userId);
    if (!org) {
      return NextResponse.json(
        { error: "No organization context for user" },
        { status: 403 },
      );
    }
    if (!ADMIN_ROLES.has(org.role)) {
      return NextResponse.json(
        {
          error: "Forbidden — payroll requires admin or owner role",
          your_role: org.role,
        },
        { status: 403 },
      );
    }

    // 3. Parse body
    const body = await req.json();
    const periodYear = Number(body.period_year);
    const periodMonth = Number(body.period_month);
    const mode = body.mode;

    if (
      !Number.isInteger(periodYear) ||
      periodYear < 2020 ||
      periodYear > 2100
    ) {
      return NextResponse.json(
        { error: "period_year must be an integer between 2020 and 2100" },
        { status: 400 },
      );
    }
    if (
      !Number.isInteger(periodMonth) ||
      periodMonth < 1 ||
      periodMonth > 12
    ) {
      return NextResponse.json(
        { error: "period_month must be an integer between 1 and 12" },
        { status: 400 },
      );
    }
    if (mode !== "preview" && mode !== "persist") {
      return NextResponse.json(
        { error: "mode must be 'preview' or 'persist'" },
        { status: 400 },
      );
    }

    // 4. Compute
    const t0 = Date.now();
    const runResult = await computeLeaveDeductions({
      organizationId: org.organization_id,
      periodYear,
      periodMonth,
    });
    const computeMs = Date.now() - t0;

    // 5. If persist mode, write to DB
    let persistedRunId: string | null = null;
    let supersededRunId: string | null = null;
    let lineItemsWritten = 0;

    if (mode === "persist") {
      const triggeredByName = await getActorName(userId);
      const persistResult = await persistPayrollRun({
        runResult,
        triggeredBy: userId,
        triggeredByName,
      });
      persistedRunId = persistResult.runId;
      supersededRunId = persistResult.supersededRunId;
      lineItemsWritten = persistResult.lineItemsWritten;
    }

    // 6. Return result with summary stats
    const totalLeaveDeduction = runResult.employees.reduce(
      (s, e) => s + e.totalLeaveDeductionAmount,
      0,
    );
    const totalAttendanceBonusDeduction = runResult.employees.reduce(
      (s, e) => s + e.attendanceBonus.totalDeduction,
      0,
    );

    return NextResponse.json({
      mode,
      organization_id: org.organization_id,
      period_year: periodYear,
      period_month: periodMonth,
      calculator_version: runResult.calculatorVersion,
      compute_time_ms: computeMs,
      summary: {
        employee_count: runResult.employees.length,
        total_leave_deduction_amount: totalLeaveDeduction,
        total_attendance_bonus_deduction: totalAttendanceBonusDeduction,
        run_warnings_count: runResult.runWarnings.length,
      },
      run_warnings: runResult.runWarnings,
      employees: runResult.employees.map((e) => ({
        user_id: e.userId,
        full_name: e.fullName,
        total_leave_deduction_amount: e.totalLeaveDeductionAmount,
        total_unpaid_leave_days: e.totalUnpaidLeaveDays,
        total_half_pay_leave_days: e.totalHalfPayLeaveDays,
        total_full_pay_leave_days: e.totalFullPayLeaveDays,
        attendance_bonus: {
          original: e.attendanceBonus.originalBonus,
          deduction: e.attendanceBonus.totalDeduction,
          net: e.attendanceBonus.netBonus,
        },
        leave_occurrence_count: e.leaveOccurrences.length,
        warning_count: e.warnings.length,
        warnings: e.warnings,
        leave_occurrences: e.leaveOccurrences.map((o) => ({
          source_workflow_submission_id: o.sourceWorkflowSubmissionId,
          leave_type_raw: o.leaveTypeRaw,
          days_in_period: o.daysInPeriod,
          effective_start: o.effectiveStart,
          canonical_key:
            o.classification.ok === true ? o.classification.canonicalKey : null,
          deduction_amount: o.payTreatment?.deductionAmount ?? 0,
          treatment_kind: o.payTreatment?.treatmentKind ?? null,
          calculation_detail: o.payTreatment?.calculationDetail ?? null,
          notes: o.payTreatment?.notes ?? [],
          filtered: o.filteredAsSkipFromPayroll === true,
        })),
      })),
      // Persistence-specific fields (null in preview mode)
      persisted_run_id: persistedRunId,
      superseded_run_id: supersededRunId,
      line_items_written: lineItemsWritten,
    });
  } catch (err: any) {
    console.error("[/api/admin/payroll/run] error:", err);
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
