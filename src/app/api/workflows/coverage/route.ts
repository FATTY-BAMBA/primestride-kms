import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/workflows/coverage?submission_id=xxx
 *
 * Returns teammates who are also on approved leave during the
 * same date range as the given pending submission.
 * Admin-only. Used to show coverage warnings on the review card.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getUserOrganization(userId);
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });
    if (!["owner", "admin"].includes(org.role || ""))
      return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const orgId = org.organization_id;
    const submissionId = req.nextUrl.searchParams.get("submission_id");
    if (!submissionId) return NextResponse.json({ error: "submission_id required" }, { status: 400 });

    // 1. Get the pending submission
    const { data: sub } = await supabase
      .from("workflow_submissions")
      .select("submitted_by, form_type, form_data")
      .eq("id", submissionId)
      .eq("organization_id", orgId)
      .single();

    if (!sub || sub.form_type !== "leave") {
      return NextResponse.json({ teammates_off: [], team_names: [] });
    }

    const startDate = sub.form_data?.start_date;
    const endDate = sub.form_data?.end_date || startDate;
    if (!startDate) return NextResponse.json({ teammates_off: [], team_names: [] });

    // 2. Find which teams the submitter belongs to
    const { data: submitterTeams } = await supabase
      .from("team_members")
      .select("team_id, teams(name)")
      .eq("user_id", sub.submitted_by)
      .eq("organization_id", orgId);

    const teamIds = (submitterTeams || []).map((t: any) => t.team_id);
    const teamNames = (submitterTeams || []).map((t: any) => t.teams?.name).filter(Boolean);

    // 3. Find all teammates (same teams, excluding submitter)
    let teammateIds: string[] = [];
    if (teamIds.length > 0) {
      const { data: teammates } = await supabase
        .from("team_members")
        .select("user_id")
        .in("team_id", teamIds)
        .eq("organization_id", orgId)
        .neq("user_id", sub.submitted_by);
      teammateIds = [...new Set((teammates || []).map((t: any) => t.user_id))];
    }

    // If no teams, fall back to whole org
    if (teammateIds.length === 0) {
      const { data: orgMembers } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .neq("user_id", sub.submitted_by);
      teammateIds = (orgMembers || []).map((m: any) => m.user_id);
    }

    if (teammateIds.length === 0) {
      return NextResponse.json({ teammates_off: [], team_names: teamNames });
    }

    // 4. Find approved leaves that overlap with the requested date range
    const { data: overlapping } = await supabase
      .from("workflow_submissions")
      .select("submitted_by, form_data, submitter_name")
      .eq("organization_id", orgId)
      .eq("form_type", "leave")
      .eq("status", "approved")
      .in("submitted_by", teammateIds);

    const teammatesOff = (overlapping || []).filter(s => {
      const oStart = s.form_data?.start_date;
      const oEnd = s.form_data?.end_date || oStart;
      if (!oStart) return false;
      // Date ranges overlap if: oStart <= endDate AND oEnd >= startDate
      return oStart <= endDate && oEnd >= startDate;
    }).map(s => ({
      name: s.submitter_name || s.submitted_by?.slice(0, 12) || "?",
      start_date: s.form_data?.start_date,
      end_date: s.form_data?.end_date || s.form_data?.start_date,
      leave_type: s.form_data?.leave_type || "請假",
      days: s.form_data?.days || 1,
    }));

    return NextResponse.json({
      teammates_off: teammatesOff,
      team_names: teamNames,
      date_range: { start: startDate, end: endDate },
    });
  } catch (err: any) {
    console.error("Coverage check error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}