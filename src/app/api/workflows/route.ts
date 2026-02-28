import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — list submissions + stats + leave balance
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

    const isAdmin = ["owner", "admin"].includes(membership.role || "");
    const orgId = membership.organization_id;

    // Fetch submissions
    let query = supabase
      .from("workflow_submissions")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (view === "my" || !isAdmin) {
      query = query.eq("submitted_by", userId);
    }
    if (status) query = query.eq("status", status);
    if (formType) query = query.eq("form_type", formType);

    const { data: submissions } = await query.limit(50);

    // Fetch stats
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
      total_this_month: (allOrgSubs || []).length,
    };

    // Fetch leave balance for current user
    const currentYear = now.getFullYear();
    let { data: balance } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("year", currentYear)
      .single();

    // Auto-create balance if not exists
    if (!balance) {
      const { data: newBalance } = await supabase
        .from("leave_balances")
        .insert({
          organization_id: orgId,
          user_id: userId,
          year: currentYear,
          annual_total: 7,
          annual_used: 0,
          sick_total: 30,
          sick_used: 0,
          personal_total: 14,
          personal_used: 0,
        })
        .select()
        .single();
      balance = newBalance;
    }

    return NextResponse.json({
      submissions: submissions || [],
      isAdmin,
      stats,
      leave_balance: balance,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// POST — submit a new form
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

    let submitterName = userId;
    try {
      const profileRes = await supabase
        .from("organization_members")
        .select("display_name")
        .eq("user_id", userId)
        .eq("organization_id", membership.organization_id)
        .single();
      if (profileRes.data?.display_name) submitterName = profileRes.data.display_name;
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
    return NextResponse.json({ submission: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }
}

// PATCH — approve/reject/cancel/batch
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

    // Cancel — user can cancel their own
    if (action === "cancel") {
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

    // Approve/Reject — admin only
    if (!isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
    if (!["approved", "rejected"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    let reviewerName = userId;
    try {
      const profileRes = await supabase
        .from("organization_members")
        .select("display_name")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .single();
      if (profileRes.data?.display_name) reviewerName = profileRes.data.display_name;
    } catch {}

    // Batch approval support
    const targetIds = ids || (id ? [id] : []);
    if (targetIds.length === 0) return NextResponse.json({ error: "No IDs provided" }, { status: 400 });

    const results = [];

    for (const targetId of targetIds) {
      // Fetch submission first for leave deduction
      const { data: sub } = await supabase
        .from("workflow_submissions")
        .select("*")
        .eq("id", targetId)
        .eq("organization_id", orgId)
        .single();

      if (!sub) continue;

      // Update status
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

      // Deduct leave balance on approval
      if (action === "approved" && sub.form_type === "leave" && sub.form_data) {
        const days = parseFloat(sub.form_data.days) || 0;
        const leaveType = (sub.form_data.leave_type || "").toLowerCase();
        const currentYear = new Date().getFullYear();

        let column = "";
        if (leaveType.includes("特休") || leaveType.includes("annual")) column = "annual_used";
        else if (leaveType.includes("病假") || leaveType.includes("sick")) column = "sick_used";
        else if (leaveType.includes("事假") || leaveType.includes("personal")) column = "personal_used";

        if (column && days > 0) {
          // Get current balance
          const { data: bal } = await supabase
            .from("leave_balances")
            .select("*")
            .eq("organization_id", orgId)
            .eq("user_id", sub.submitted_by)
            .eq("year", currentYear)
            .single();

          if (bal) {
            await supabase
              .from("leave_balances")
              .update({
                [column]: (parseFloat(bal[column]) || 0) + days,
                updated_at: new Date().toISOString(),
              })
              .eq("id", bal.id);
          }
        }
      }

      results.push(data);
    }

    return NextResponse.json({
      submissions: results,
      message: `${results.length} submission(s) ${action}`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
