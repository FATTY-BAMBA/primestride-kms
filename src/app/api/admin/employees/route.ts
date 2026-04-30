import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";
import {
  EmployeeUpdateSchema,
  buildSupabaseUpdate,
} from "@/lib/admin/employeeUpdateSchema";
import { applyTaiwanPayrollDefaults } from "@/lib/admin/employeeUpdateDefaults";
import { fetchPayrollReferenceData } from "@/lib/payroll/fetchBrackets";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ══════════════════════════════════════════════════════════════
// GET /api/admin/employees
// ══════════════════════════════════════════════════════════════
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getUserOrganization(userId);
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 403 });

    const isAdmin = ["owner", "admin"].includes(org.role || "");
    if (!isAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const orgId = org.organization_id;

    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", orgId)
      .eq("is_active", true);

    if (!members || members.length === 0) return NextResponse.json({ employees: [] });

    const userIds = members.map(m => m.user_id);
    const memberRoleMap = new Map(members.map(m => [m.user_id, m.role]));

    // Get full profiles including all new HRM fields
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, birth_date, national_id, phone, address, emergency_contact_name, emergency_contact_phone, hire_date, department, job_title, employee_id, employment_type, salary_base, salary_currency, bank_code, bank_account, labor_insurance_id, health_insurance_id, gender, nationality, termination_date, notes, nhi_insured_salary, labor_insured_salary, attendance_bonus_monthly, pension_contribution_wage")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const { data: allSubmissions } = await supabase
      .from("workflow_submissions")
      .select("submitted_by, form_type, form_data, status, created_at")
      .eq("organization_id", orgId);

    const { data: leaveBalances } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("organization_id", orgId)
      .eq("year", new Date().getFullYear());

    const balanceMap = new Map((leaveBalances || []).map(b => [b.user_id, b]));

    // Get departments
    const { data: departments } = await supabase
      .from("departments")
      .select("id, name")
      .eq("organization_id", orgId);

    const employees = userIds.map(uid => {
      const profile = profileMap.get(uid);
      const subs = (allSubmissions || []).filter(s => s.submitted_by === uid);
      const lb = balanceMap.get(uid);

      let leaveDays = 0;
      let overtimeHours = 0;
      subs.forEach(s => {
        if (s.status === "approved" || s.status === "pending") {
          if (s.form_type === "leave" && s.form_data?.days) leaveDays += Number(s.form_data.days) || 0;
          if (s.form_type === "overtime" && s.form_data?.hours) overtimeHours += Number(s.form_data.hours) || 0;
        }
      });

      // Calculate tenure
      const hireDate = profile?.hire_date ? new Date(profile.hire_date) : null;
      const tenureMonths = hireDate
        ? Math.floor((Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
        : null;

      // Birthday this month
      const today = new Date();
      const birthDate = profile?.birth_date ? new Date(profile.birth_date) : null;
      const birthdayThisMonth = birthDate
        ? birthDate.getMonth() === today.getMonth()
        : false;
      const birthdayToday = birthDate
        ? birthDate.getMonth() === today.getMonth() && birthDate.getDate() === today.getDate()
        : false;

      return {
        user_id: uid,
        role: memberRoleMap.get(uid) || "member",
        name: profile?.full_name || uid.slice(0, 16),
        email: profile?.email || "",
        avatar_url: profile?.avatar_url || null,
        // HRM fields
        birth_date: profile?.birth_date || null,
        national_id: profile?.national_id || null,
        phone: profile?.phone || null,
        address: profile?.address || null,
        emergency_contact_name: profile?.emergency_contact_name || null,
        emergency_contact_phone: profile?.emergency_contact_phone || null,
        hire_date: profile?.hire_date || null,
        department: profile?.department || null,
        job_title: profile?.job_title || null,
        employee_id: profile?.employee_id || null,
        employment_type: profile?.employment_type || "full_time",
        salary_base: profile?.salary_base || null,
        salary_currency: profile?.salary_currency || "TWD",
        // Phase 3j: payroll calculator fields
        nhi_insured_salary: profile?.nhi_insured_salary || null,
        labor_insured_salary: profile?.labor_insured_salary || null,
        attendance_bonus_monthly: profile?.attendance_bonus_monthly || null,
        pension_contribution_wage: profile?.pension_contribution_wage || null,
        bank_code: profile?.bank_code || null,
        bank_account: profile?.bank_account || null,
        labor_insurance_id: profile?.labor_insurance_id || null,
        health_insurance_id: profile?.health_insurance_id || null,
        gender: profile?.gender || null,
        nationality: profile?.nationality || "TW",
        termination_date: profile?.termination_date || null,
        notes: profile?.notes || null,
        // Computed
        tenure_months: tenureMonths,
        birthday_this_month: birthdayThisMonth,
        birthday_today: birthdayToday,
        // Stats
        total_submissions: subs.length,
        pending: subs.filter(s => s.status === "pending").length,
        approved: subs.filter(s => s.status === "approved").length,
        rejected: subs.filter(s => s.status === "rejected").length,
        leave_days_taken: leaveDays,
        overtime_hours: overtimeHours,
        leave_balance: lb ? {
          annual_total: lb.annual_total || 7,
          annual_used: lb.annual_used || 0,
          sick_total: lb.sick_total || 30,
          sick_used: lb.sick_used || 0,
          personal_total: lb.personal_total || 14,
          personal_used: lb.personal_used || 0,
          family_care_total: lb.family_care_total || 7,
          family_care_used: lb.family_care_used || 0,
          family_care_hours_total: lb.family_care_hours_total || 56,
          family_care_hours_used: lb.family_care_hours_used || 0,
        } : {
          annual_total: 7, annual_used: 0,
          sick_total: 30, sick_used: 0,
          personal_total: 14, personal_used: 0,
          family_care_total: 7, family_care_used: 0,
          family_care_hours_total: 56, family_care_hours_used: 0,
        },
      };
    });

    return NextResponse.json({ employees, departments: departments || [] });
  } catch (err: any) {
    console.error("Admin employees error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ====================================================================
// PATCH /api/admin/employees
// Update employee profile fields - admin only
//
// Architecture (Phase 3j hardening, Apr 30 2026):
//   1. Auth + org membership check (unchanged from original)
//   2. Parse body via EmployeeUpdateSchema (Zod)
//   3. Verify the user being edited is in the same org
//   4. Fetch payroll reference data (effective today)
//   5. Apply Taiwan payroll smart-defaults (bracket-aware)
//   6. Build Supabase update payload (strips undefined fields)
//   7. Write to DB
//
// Smart-defaults are bracket-aware: nhi/labor/pension amounts snap to
// the correct bracket tier from the database, not hardcoded constants.
// This automatically handles annual bracket changes without code edits.
// =====================================================================
export async function PATCH(req: NextRequest) {
  try {
    // 1. Auth
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getUserOrganization(userId);
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 403 });

    const isAdmin = ["owner", "admin"].includes(org.role || "");
    if (!isAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    // 2. Parse body via schema
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = EmployeeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path.length ? issue.path.join(".") + ": " : "";
      return NextResponse.json(
        { error: `${path}${issue?.message ?? "Validation failed"}` },
        { status: 400 },
      );
    }

    const validated = parsed.data;

    // 3. Verify target user is in same org
    const { data: member } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", org.organization_id)
      .eq("user_id", validated.user_id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Employee not in organization" }, { status: 403 });
    }

    // 4. Fetch payroll reference data
    // Effective date = today. Smart-defaults use whatever brackets are
    // active right now. Future enhancement: could use the employee's
    // hire_date or the next payroll period's start.
    const refData = await fetchPayrollReferenceData(new Date());

    // 5. Apply Taiwan payroll smart-defaults
    const withDefaults = applyTaiwanPayrollDefaults(validated, refData);

    // 6. Build DB update payload
    // buildSupabaseUpdate strips user_id (used as WHERE), adds updated_at,
    // and removes undefined fields (so untouched columns stay untouched).
    const updatePayload = buildSupabaseUpdate(withDefaults);

    // 7. Write to Supabase
    const { error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", validated.user_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, message: "Employee profile updated" });
  } catch (err: any) {
    console.error("Employee update error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
