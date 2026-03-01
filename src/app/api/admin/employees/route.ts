import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ══════════════════════════════════════════════════════════════
// GET /api/admin/employees
// Returns employee summaries: names, leave balances, submission stats
// Admin-only endpoint
// ══════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check admin role
    const org = await getUserOrganization(userId);
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 403 });

    const isAdmin = ["owner", "admin"].includes(org.role || "");
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const orgId = org.organization_id;

    // Get all org members
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("is_active", true);

    if (!members || members.length === 0) {
      return NextResponse.json({ employees: [] });
    }

    const userIds = members.map(m => m.user_id);

    // Get profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    // Get all submissions for the org
    const { data: allSubmissions } = await supabase
      .from("workflow_submissions")
      .select("submitted_by, form_type, form_data, status, created_at")
      .eq("organization_id", orgId);

    // Get leave balances
    const { data: leaveBalances } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("organization_id", orgId)
      .eq("year", new Date().getFullYear());

    const balanceMap = new Map((leaveBalances || []).map(b => [b.user_id, b]));

    // Build employee summaries
    const employees = userIds.map(uid => {
      const profile = profileMap.get(uid);
      const subs = (allSubmissions || []).filter(s => s.submitted_by === uid);
      const lb = balanceMap.get(uid);

      // Calculate leave days and overtime hours
      let leaveDays = 0;
      let overtimeHours = 0;
      subs.forEach(s => {
        if (s.status === "approved" || s.status === "pending") {
          if (s.form_type === "leave" && s.form_data?.days) {
            leaveDays += Number(s.form_data.days) || 0;
          }
          if (s.form_type === "overtime" && s.form_data?.hours) {
            overtimeHours += Number(s.form_data.hours) || 0;
          }
        }
      });

      return {
        user_id: uid,
        name: profile?.full_name || uid.slice(0, 16),
        email: profile?.email || "",
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

    return NextResponse.json({ employees });
  } catch (err: any) {
    console.error("Admin employees error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
