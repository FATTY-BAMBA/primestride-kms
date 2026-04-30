// src/app/api/admin/payroll/runs/route.ts
//
// Atlas EIP — Admin Payroll Runs History API
// ──────────────────────────────────────────────────────────────────────
// Phase 3f early implementation.
//
// GET /api/admin/payroll/runs?include_superseded=false&limit=20
//
// Returns past payroll runs for the current user's organization.
// By default returns only current (non-superseded) runs.

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ADMIN_ROLES = new Set(["admin", "owner"]);

export async function GET(req: NextRequest) {
  try {
    // 1. Auth
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Org + role
    const org = await getUserOrganization(userId);
    if (!org) {
      return NextResponse.json(
        { error: "No organization context" },
        { status: 403 },
      );
    }
    if (!ADMIN_ROLES.has(org.role)) {
      return NextResponse.json(
        { error: "Forbidden — admin or owner role required" },
        { status: 403 },
      );
    }

    // 3. Query params
    const { searchParams } = new URL(req.url);
    const includeSuperseded =
      searchParams.get("include_superseded") === "true";
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || 20, 1),
      100,
    );

    // 4. Build query
    let query = supabase
      .from("payroll_runs")
      .select(
        "id, period_year, period_month, calculator_version, " +
          "triggered_by, triggered_by_name, started_at, completed_at, " +
          "compute_time_ms, superseded_at, superseded_by_run_id, " +
          "total_employees, total_leave_deduction_amount, " +
          "total_attendance_bonus_deduction, run_warnings, created_at",
      )
      .eq("organization_id", org.organization_id)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .order("started_at", { ascending: false })
      .limit(limit);

    if (!includeSuperseded) {
      query = query.is("superseded_at", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[/api/admin/payroll/runs] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Cast: select-string concatenation defeats TS inference; rows are known shape
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      period_year: number;
      period_month: number;
      calculator_version: string;
      triggered_by: string | null;
      triggered_by_name: string | null;
      started_at: string;
      completed_at: string;
      compute_time_ms: number | null;
      superseded_at: string | null;
      superseded_by_run_id: string | null;
      total_employees: number;
      total_leave_deduction_amount: number | string;
      total_attendance_bonus_deduction: number | string;
      run_warnings: unknown;
      created_at: string;
    }>;

    return NextResponse.json({
      organization_id: org.organization_id,
      include_superseded: includeSuperseded,
      runs: rows.map((r) => ({
        id: r.id,
        period_year: r.period_year,
        period_month: r.period_month,
        calculator_version: r.calculator_version,
        triggered_by: r.triggered_by,
        triggered_by_name: r.triggered_by_name,
        started_at: r.started_at,
        completed_at: r.completed_at,
        compute_time_ms: r.compute_time_ms,
        superseded_at: r.superseded_at,
        superseded_by_run_id: r.superseded_by_run_id,
        total_employees: r.total_employees,
        total_leave_deduction_amount: Number(r.total_leave_deduction_amount),
        total_attendance_bonus_deduction: Number(
          r.total_attendance_bonus_deduction,
        ),
        run_warnings_count: Array.isArray(r.run_warnings)
          ? r.run_warnings.length
          : 0,
        created_at: r.created_at,
      })),
    });
  } catch (err: any) {
    console.error("[/api/admin/payroll/runs] error:", err);
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
