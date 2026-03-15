import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/shadow-audit
 * Returns real-time overtime risk alerts per employee.
 * Admin only. Used on the admin dashboard overview tab.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getUserOrganization(userId);
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });
    if (!["owner", "admin"].includes(org.role || ""))
      return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const orgId = org.organization_id;
    const now = new Date();

    // ── Date ranges ──
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();

    // ── Get all approved OT submissions this month and last 3 months ──
    const { data: allOT } = await supabase
      .from("workflow_submissions")
      .select("submitted_by, form_data, created_at, submitter_name")
      .eq("organization_id", orgId)
      .eq("form_type", "overtime")
      .eq("status", "approved")
      .gte("created_at", threeMonthsAgo);

    // ── Get member profiles ──
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("is_active", true);

    const userIds = (members || []).map(m => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map(p => [
      p.id,
      p.full_name || p.email?.split("@")[0] || p.id.slice(0, 12)
    ]));

    // ── Calculate per-employee risk ──
    const employeeRisks: Record<string, {
      user_id: string;
      name: string;
      monthly_hours: number;
      quarterly_hours: number;
      monthly_status: "safe" | "warning" | "critical";
      quarterly_status: "safe" | "warning" | "critical";
      monthly_remaining: number;
      quarterly_remaining: number;
      risk_level: "safe" | "warning" | "critical";
      alerts: { type: string; message_zh: string; message_en: string; law: string; fine?: string }[];
    }> = {};

    for (const sub of (allOT || [])) {
      const uid = sub.submitted_by;
      if (!employeeRisks[uid]) {
        employeeRisks[uid] = {
          user_id: uid,
          name: sub.submitter_name || profileMap.get(uid) || uid.slice(0, 12),
          monthly_hours: 0,
          quarterly_hours: 0,
          monthly_status: "safe",
          quarterly_status: "safe",
          monthly_remaining: 46,
          quarterly_remaining: 138,
          risk_level: "safe",
          alerts: [],
        };
      }
      const hours = parseFloat(sub.form_data?.hours) || 0;
      const subDate = new Date(sub.created_at);
      if (subDate >= new Date(monthStart)) {
        employeeRisks[uid].monthly_hours += hours;
      }
      employeeRisks[uid].quarterly_hours += hours;
    }

    // ── Classify risk levels and build alerts ──
    for (const emp of Object.values(employeeRisks)) {
      emp.monthly_remaining = Math.max(0, 46 - emp.monthly_hours);
      emp.quarterly_remaining = Math.max(0, 138 - emp.quarterly_hours);

      // Monthly assessment
      if (emp.monthly_hours >= 46) {
        emp.monthly_status = "critical";
        emp.alerts.push({
          type: "monthly_exceeded",
          message_zh: `⚠️ 本月加班已達 ${emp.monthly_hours} 小時，超過法定46小時上限`,
          message_en: `Monthly OT reached ${emp.monthly_hours}h — exceeds 46h legal limit`,
          law: "LSA Art. 32",
          fine: "NT$20,000–1,000,000",
        });
      } else if (emp.monthly_hours >= 38) {
        emp.monthly_status = "warning";
        emp.alerts.push({
          type: "monthly_approaching",
          message_zh: `📊 本月加班 ${emp.monthly_hours} 小時，距46小時上限僅剩 ${emp.monthly_remaining} 小時`,
          message_en: `Monthly OT at ${emp.monthly_hours}h — only ${emp.monthly_remaining}h remaining before cap`,
          law: "LSA Art. 32",
        });
      }

      // Quarterly assessment
      if (emp.quarterly_hours >= 138) {
        emp.quarterly_status = "critical";
        emp.alerts.push({
          type: "quarterly_exceeded",
          message_zh: `🚫 近3個月加班已達 ${emp.quarterly_hours} 小時，超過138小時絕對上限`,
          message_en: `3-month OT at ${emp.quarterly_hours}h — exceeds absolute 138h cap`,
          law: "LSA Art. 32 — Quarterly Hard Cap",
          fine: "NT$20,000–1,000,000",
        });
      } else if (emp.quarterly_hours >= 120) {
        emp.quarterly_status = "warning";
        emp.alerts.push({
          type: "quarterly_approaching",
          message_zh: `⚠️ 近3個月加班 ${emp.quarterly_hours} 小時，距138小時上限僅剩 ${emp.quarterly_remaining} 小時`,
          message_en: `3-month OT at ${emp.quarterly_hours}h — ${emp.quarterly_remaining}h remaining before quarterly cap`,
          law: "LSA Art. 32 — Quarterly Cap",
        });
      }

      // Overall risk level
      if (emp.monthly_status === "critical" || emp.quarterly_status === "critical") {
        emp.risk_level = "critical";
      } else if (emp.monthly_status === "warning" || emp.quarterly_status === "warning") {
        emp.risk_level = "warning";
      }
    }

    const risks = Object.values(employeeRisks);
    const critical = risks.filter(r => r.risk_level === "critical");
    const warnings = risks.filter(r => r.risk_level === "warning");

    return NextResponse.json({
      risks: risks.filter(r => r.risk_level !== "safe"),
      summary: {
        total_monitored: risks.length,
        critical: critical.length,
        warning: warnings.length,
        safe: risks.filter(r => r.risk_level === "safe").length,
      },
    });
  } catch (err: any) {
    console.error("Shadow audit error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
