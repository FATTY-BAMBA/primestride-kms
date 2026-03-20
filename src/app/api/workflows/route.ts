import { auth } from "@clerk/nextjs/server";
import { logAudit } from "@/lib/audit-log";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";
import { notifyAdminsNewSubmission, notifySubmitterStatus } from "@/lib/workflow-notifications";
import { logUsage } from "@/lib/usage-logger";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Default balance values for new members ────────────────────────────────
const DEFAULT_BALANCE = {
  annual_total: 7,       annual_used: 0,
  sick_total: 30,        sick_used: 0,
  personal_total: 14,    personal_used: 0,
  family_care_total: 7,  family_care_used: 0,
  family_care_hours_total: 56, family_care_hours_used: 0,
  maternity_total: 56,   maternity_used: 0,   // days
  paternity_total: 7,    paternity_used: 0,
  marriage_total: 8,     marriage_used: 0,
  bereavement_total: 8,  bereavement_used: 0,
  official_total: 0,     official_used: 0,
  comp_time_total: 0,    comp_time_used: 0,
};

// ── Map leave_type string → leave_balances column ────────────────────────
// Handles all formats the NLP parser produces:
// "特休 Annual", "特休", "annual", "sick leave", etc.
function getLeaveColumn(leaveType: string): string {
  const t = leaveType.toLowerCase();

  if (t.includes("特休") || t.includes("annual") || t.includes("pto")) return "annual_used";
  if (t.includes("補休") || t.includes("comp") || t.includes("調休") || t.includes("換休")) return "comp_time_used";
  if (t.includes("病假") || t.includes("sick") || t.includes("生理")) return "sick_used";
  if (t.includes("事假") || t.includes("personal")) return "personal_used";
  if (t.includes("家庭") || t.includes("family") || t.includes("family care")) return "family_care_used";
  if (t.includes("婚假") || t.includes("marriage") || t.includes("wedding")) return "marriage_used";
  if (t.includes("喪假") || t.includes("bereavement") || t.includes("funeral")) return "bereavement_used";
  if (t.includes("產假") || t.includes("maternity")) return "maternity_used";
  if (t.includes("陪產") || t.includes("paternity")) return "paternity_used";
  if (t.includes("公假") || t.includes("official")) return "official_used";
  if (t.includes("育嬰") || t.includes("parental")) return "annual_used"; // map to annual as closest

  return ""; // unknown type — do not deduct
}

// ── Ensure leave balance row exists for a user, create if missing ─────────
async function ensureLeaveBalance(
  orgId: string,
  userId: string,
  year: number
): Promise<any> {
  const { data: existing } = await supabase
    .from("leave_balances")
    .select("*")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("year", year)
    .single();

  if (existing) return existing;

  // Create with defaults
  const { data: created } = await supabase
    .from("leave_balances")
    .insert({
      organization_id: orgId,
      user_id: userId,
      year,
      ...DEFAULT_BALANCE,
    })
    .select()
    .single();

  return created;
}

// ── Helper: Resolve user IDs to names from profiles table ─────────────────
async function resolveUserNames(submissions: any[]): Promise<any[]> {
  if (!submissions || submissions.length === 0) return [];

  const userIds = new Set<string>();
  submissions.forEach(s => {
    if (s.submitted_by) userIds.add(s.submitted_by);
    if (s.reviewed_by) userIds.add(s.reviewed_by);
  });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", Array.from(userIds));

  const nameMap = new Map(
    (profiles || []).map((p: any) => [p.id, p.full_name || p.email?.split("@")[0] || p.id.slice(0, 12)])
  );

  return submissions.map(s => ({
    ...s,
    submitter_name: nameMap.get(s.submitted_by) || s.submitted_by?.slice(0, 12) || "Unknown",
    reviewer_name: s.reviewed_by ? (nameMap.get(s.reviewed_by) || s.reviewed_by?.slice(0, 12)) : null,
  }));
}

// ── GET — list submissions + stats + leave balance ────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "my";
    const status = searchParams.get("status");
    const formType = searchParams.get("form_type");
    const userIdFilter = searchParams.get("user_id");

    const isAdmin = ["owner", "admin"].includes(membership.role || "");
    const orgId = membership.organization_id;

    // Fetch submissions
    let query = supabase
      .from("workflow_submissions")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (view === "my" || !isAdmin) query = query.eq("submitted_by", userId);
    if (status) query = query.eq("status", status);
    if (formType) query = query.eq("form_type", formType);
    if (userIdFilter && isAdmin) query = query.eq("submitted_by", userIdFilter);

    const { data: submissions } = await query.limit(50);
    const enriched = await resolveUserNames(submissions || []);

    // Stats
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: allOrgSubs } = await supabase
      .from("workflow_submissions")
      .select("status, form_type, created_at")
      .eq("organization_id", orgId)
      .gte("created_at", monthStart);

    const stats = {
      pending: (allOrgSubs || []).filter(s => s.status === "pending").length,
      approved_this_month: (allOrgSubs || []).filter(s => s.status === "approved").length,
      rejected_this_month: (allOrgSubs || []).filter(s => s.status === "rejected").length,
      total_this_month: (allOrgSubs || []).filter(s => s.status !== "cancelled").length,
    };

    // Ensure leave balance exists for current user (creates if missing)
    const currentYear = now.getFullYear();
    const balance = await ensureLeaveBalance(orgId, userId, currentYear);

    return NextResponse.json({
      submissions: enriched,
      isAdmin,
      stats,
      leave_balance: balance,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// ── POST — submit a new form ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

    const body = await request.json();
    const { form_type, form_data, original_text, ai_parsed } = body;

    if (!form_type || !form_data) {
      return NextResponse.json({ error: "form_type and form_data required" }, { status: 400 });
    }

    // Get submitter name
    let submitterName = userId;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .single();
      if (profile?.full_name) submitterName = profile.full_name;
      else if (profile?.email) submitterName = profile.email.split("@")[0];
    } catch {}

    const { data, error } = await supabase
      .from("workflow_submissions")
      .insert({
        organization_id: membership.organization_id,
        form_type,
        form_data,
        original_text: original_text || null,
        ai_parsed: ai_parsed || false,
        submitted_by: userId,
        submitter_name: submitterName,
        status: "pending",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Email notify admins
    try {
      const { data: admins } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", membership.organization_id)
        .in("role", ["owner", "admin"])
        .eq("is_active", true);

      if (admins && admins.length > 0) {
        const { data: adminProfiles } = await supabase
          .from("profiles")
          .select("email")
          .in("id", admins.map(a => a.user_id));

        const adminEmails = (adminProfiles || []).map(p => p.email).filter(Boolean) as string[];
        if (adminEmails.length > 0) {
          notifyAdminsNewSubmission({
            adminEmails,
            submitterName,
            formType: form_type,
            formData: form_data,
            originalText: original_text || undefined,
          }).catch(err => console.error("Email notification error:", err));
        }
      }
    } catch (notifyErr) {
      console.error("Failed to send admin notifications:", notifyErr);
    }

    logUsage({
      organization_id: membership.organization_id,
      user_id: userId,
      action: "workflow.submit",
      resource_type: "workflow",
      metadata: { form_type },
    });
    logAudit({
      organizationId: membership.organization_id,
      userId,
      action: "workflow.submit",
      targetType: "workflow",
      details: `Submitted ${form_type} request`,
    }).catch(() => {});

    return NextResponse.json({ submission: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }
}

// ── PATCH — approve / reject / cancel / batch ─────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

    const body = await request.json();
    const { id, ids, action, review_note } = body;

    const isAdmin = ["owner", "admin"].includes(membership.role || "");
    const orgId = membership.organization_id;

    // ── Cancel — user can cancel their own ──────────────────────────────
    if (action === "cancel" || action === "cancelled") {
      const { data, error } = await supabase
        .from("workflow_submissions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("submitted_by", userId)
        .eq("organization_id", orgId)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ submission: data });
    }

    // ── Approve / Reject — admin only ───────────────────────────────────
    if (!isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
    if (!["approved", "rejected"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Get reviewer name
    let reviewerName = userId;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .single();
      if (profile?.full_name) reviewerName = profile.full_name;
      else if (profile?.email) reviewerName = profile.email.split("@")[0];
    } catch {}

    const targetIds = ids || (id ? [id] : []);
    if (targetIds.length === 0) return NextResponse.json({ error: "No IDs provided" }, { status: 400 });

    const results = [];
    const currentYear = new Date().getFullYear();

    for (const targetId of targetIds) {
      const { data: sub } = await supabase
        .from("workflow_submissions")
        .select("*")
        .eq("id", targetId)
        .eq("organization_id", orgId)
        .single();

      if (!sub) continue;

      // Update submission status
      const { data, error } = await supabase
        .from("workflow_submissions")
        .update({
          status: action,
          reviewed_by: userId,
          reviewer_name: reviewerName,
          reviewed_at: new Date().toISOString(),
          review_note: review_note || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId)
        .eq("organization_id", orgId)
        .select()
        .single();

      if (error) continue;

      // ── Deduct leave balance on approval ──────────────────────────────
      if (action === "approved" && sub.form_type === "leave" && sub.form_data) {
        const days = Number(sub.form_data.days) || 0;
        const leaveType = String(sub.form_data.leave_type || "");
        const column = getLeaveColumn(leaveType);

        if (column && days > 0) {
          // ensureLeaveBalance creates the row if it doesn't exist yet
          // (fixes the bug where admin approves before employee visits /workflows)
          const bal = await ensureLeaveBalance(orgId, sub.submitted_by, currentYear);

          if (bal) {
            const currentUsed = Number(bal[column]) || 0;
            const newUsed = Math.round((currentUsed + days) * 1000) / 1000; // avoid float drift

            await supabase
              .from("leave_balances")
              .update({
                [column]: newUsed,
                updated_at: new Date().toISOString(),
              })
              .eq("id", bal.id);
          }
        }

        // ── Also deduct hours for hourly family care leave ─────────────
        if (
          leaveType.toLowerCase().includes("家庭") ||
          leaveType.toLowerCase().includes("family")
        ) {
          const hoursRequested = Number(sub.form_data.hours_requested) || 0;
          if (hoursRequested > 0) {
            const bal = await ensureLeaveBalance(orgId, sub.submitted_by, currentYear);
            if (bal) {
              const currentHrsUsed = Number(bal.family_care_hours_used) || 0;
              await supabase
                .from("leave_balances")
                .update({
                  family_care_hours_used: Math.round((currentHrsUsed + hoursRequested) * 1000) / 1000,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", bal.id);
            }
          }
        }
      }

      results.push(data);

      // Email notify submitter
      try {
        const { data: submitterProfile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", sub.submitted_by)
          .single();

        if (submitterProfile?.email) {
          notifySubmitterStatus({
            submitterEmail: submitterProfile.email,
            submitterName: submitterProfile.full_name || submitterProfile.email.split("@")[0],
            reviewerName,
            formType: sub.form_type,
            formData: sub.form_data || {},
            status: action as "approved" | "rejected",
            reviewNote: review_note || undefined,
          }).catch(err => console.error("Email notification error:", err));
        }
      } catch (notifyErr) {
        console.error("Failed to send submitter notification:", notifyErr);
      }
    }

    return NextResponse.json({
      submissions: results,
      message: `${results.length} submission(s) ${action}`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}