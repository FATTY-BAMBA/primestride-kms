import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — list submissions (my own or all for admin)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "my"; // "my" or "all"
    const status = searchParams.get("status");
    const formType = searchParams.get("form_type");

    const isAdmin = ["owner", "admin"].includes(membership.role || "");

    let query = supabase
      .from("workflow_submissions")
      .select("*")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false });

    if (view === "my" || !isAdmin) {
      query = query.eq("submitted_by", userId);
    }

    if (status) query = query.eq("status", status);
    if (formType) query = query.eq("form_type", formType);

    const { data, error } = await query.limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ submissions: data || [], isAdmin });
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

    // Get submitter name
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

// PATCH — approve/reject/cancel
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

    const body = await request.json();
    const { id, action, review_note } = body;

    if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

    // Cancel — user can cancel their own
    if (action === "cancel") {
      const { data, error } = await supabase
        .from("workflow_submissions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("submitted_by", userId)
        .eq("organization_id", membership.organization_id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ submission: data });
    }

    // Approve/Reject — admin only
    const isAdmin = ["owner", "admin"].includes(membership.role || "");
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
        .eq("organization_id", membership.organization_id)
        .single();
      if (profileRes.data?.display_name) reviewerName = profileRes.data.display_name;
    } catch {}

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
      .eq("id", id)
      .eq("organization_id", membership.organization_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ submission: data });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
