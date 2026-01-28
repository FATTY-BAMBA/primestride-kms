import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization membership
    const { data: myMembership } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!myMembership?.organization_id) {
      return NextResponse.json(
        { error: "Not a member of any organization" },
        { status: 400 }
      );
    }

    // Get all members of this organization
    const { data: memberships, error: membersError } = await supabase
      .from("organization_members")
      .select(`
        id,
        user_id,
        role,
        joined_at,
        is_active
      `)
      .eq("organization_id", myMembership.organization_id)
      .eq("is_active", true)
      .order("joined_at", { ascending: true });

    if (membersError) {
      console.error("Error fetching members:", membersError);
      throw membersError;
    }

    // Get user details from auth.users for each member
    const memberDetails = await Promise.all(
      (memberships || []).map(async (membership) => {
        // Get user email from profiles or auth
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", membership.user_id)
          .single();

        return {
          id: membership.user_id,
          email: profile?.email || "Unknown",
          full_name: profile?.full_name || null,
          role: membership.role,
          created_at: membership.joined_at,
        };
      })
    );

    // Get pending invitations
    const { data: invitations, error: invitationsError } = await supabase
      .from("invitations")
      .select("id, email, role, created_at, expires_at, status")
      .eq("organization_id", myMembership.organization_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (invitationsError) {
      console.error("Error fetching invitations:", invitationsError);
    }

    return NextResponse.json({
      members: memberDetails,
      pending_invitations: invitations || [],
      current_user_role: myMembership.role,
    });
  } catch (error) {
    console.error("Error in team members API:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}