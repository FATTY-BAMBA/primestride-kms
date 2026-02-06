import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to get user's org membership
async function getUserOrgMembership(userId: string) {
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!memberships || memberships.length === 0) return null;
  if (memberships.length === 1) return memberships[0];

  for (const m of memberships) {
    const { count } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", m.organization_id);
    if (count && count > 0) return m;
  }

  return memberships[0];
}

// POST add member to team
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const membership = await getUserOrgMembership(userId);
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Check permissions: org admin/owner OR team lead
    const isOrgAdmin = ["owner", "admin"].includes(membership.role);
    
    const { data: teamMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .single();

    const isTeamLead = teamMembership?.role === "lead";

    if (!isOrgAdmin && !isTeamLead) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const { userIds, role = "member" } = await request.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "User IDs are required" }, { status: 400 });
    }

    // Verify team belongs to org
    const { data: team } = await supabase
      .from("teams")
      .select("id")
      .eq("id", teamId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Verify all users are members of the organization
    const { data: orgMembers } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", membership.organization_id)
      .eq("is_active", true)
      .in("user_id", userIds);

    const validUserIds = (orgMembers || []).map(m => m.user_id);
    const invalidUserIds = userIds.filter(id => !validUserIds.includes(id));

    if (invalidUserIds.length > 0) {
      return NextResponse.json({ 
        error: "Some users are not members of this organization",
        invalid_users: invalidUserIds 
      }, { status: 400 });
    }

    // Add members (upsert to handle duplicates)
    const membersToAdd = validUserIds.map(uid => ({
      team_id: teamId,
      user_id: uid,
      role: role,
      added_by: userId,
    }));

    const { error } = await supabase
      .from("team_members")
      .upsert(membersToAdd, { onConflict: "team_id,user_id" });

    if (error) {
      console.error("Error adding team members:", error);
      return NextResponse.json({ error: "Failed to add members" }, { status: 500 });
    }

    return NextResponse.json({ 
      message: `${validUserIds.length} member(s) added to team`,
      added_count: validUserIds.length,
    });
  } catch (error) {
    console.error("Team members POST error:", error);
    return NextResponse.json({ error: "Failed to add members" }, { status: 500 });
  }
}

// DELETE remove member from team
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const membership = await getUserOrgMembership(userId);
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Users can remove themselves, or admins/leads can remove others
    const isSelf = targetUserId === userId;
    const isOrgAdmin = ["owner", "admin"].includes(membership.role);
    
    const { data: teamMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .single();

    const isTeamLead = teamMembership?.role === "lead";

    if (!isSelf && !isOrgAdmin && !isTeamLead) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Don't allow removing the last team lead
    if (!isSelf) {
      const { data: targetMember } = await supabase
        .from("team_members")
        .select("role")
        .eq("team_id", teamId)
        .eq("user_id", targetUserId)
        .single();

      if (targetMember?.role === "lead") {
        const { count } = await supabase
          .from("team_members")
          .select("*", { count: "exact", head: true })
          .eq("team_id", teamId)
          .eq("role", "lead");

        if (count && count <= 1) {
          return NextResponse.json({ 
            error: "Cannot remove the last team lead. Promote another member first." 
          }, { status: 400 });
        }
      }
    }

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", targetUserId);

    if (error) {
      console.error("Error removing team member:", error);
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
    }

    return NextResponse.json({ message: "Member removed from team" });
  } catch (error) {
    console.error("Team members DELETE error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}

// PATCH update member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const membership = await getUserOrgMembership(userId);
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Check permissions: org admin/owner OR team lead
    const isOrgAdmin = ["owner", "admin"].includes(membership.role);
    
    const { data: teamMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .single();

    const isTeamLead = teamMembership?.role === "lead";

    if (!isOrgAdmin && !isTeamLead) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const { targetUserId, role } = await request.json();

    if (!targetUserId || !role) {
      return NextResponse.json({ error: "User ID and role are required" }, { status: 400 });
    }

    if (!["lead", "member"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // If demoting a lead, ensure there's at least one other lead
    if (role === "member") {
      const { data: currentRole } = await supabase
        .from("team_members")
        .select("role")
        .eq("team_id", teamId)
        .eq("user_id", targetUserId)
        .single();

      if (currentRole?.role === "lead") {
        const { count } = await supabase
          .from("team_members")
          .select("*", { count: "exact", head: true })
          .eq("team_id", teamId)
          .eq("role", "lead");

        if (count && count <= 1) {
          return NextResponse.json({ 
            error: "Cannot demote the last team lead" 
          }, { status: 400 });
        }
      }
    }

    const { error } = await supabase
      .from("team_members")
      .update({ role })
      .eq("team_id", teamId)
      .eq("user_id", targetUserId);

    if (error) {
      console.error("Error updating member role:", error);
      return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
    }

    return NextResponse.json({ message: "Member role updated" });
  } catch (error) {
    console.error("Team members PATCH error:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}