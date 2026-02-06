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

// GET single team with members
export async function GET(
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

    // Get team details
    const { data: team, error } = await supabase
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (error || !team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Get team members with profile info
    const { data: members } = await supabase
      .from("team_members")
      .select("user_id, role, added_at")
      .eq("team_id", teamId);

    // Get profile info for each member
    const membersWithProfiles = await Promise.all(
      (members || []).map(async (m) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name, avatar_url")
          .eq("id", m.user_id)
          .single();

        return {
          user_id: m.user_id,
          role: m.role,
          added_at: m.added_at,
          email: profile?.email || "Unknown",
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
        };
      })
    );

    // Get documents in this team
    const { data: documents } = await supabase
      .from("documents")
      .select("doc_id, title, updated_at")
      .eq("team_id", teamId)
      .order("updated_at", { ascending: false })
      .limit(10);

    // Check if current user is a member
    const userMembership = membersWithProfiles.find(m => m.user_id === userId);

    return NextResponse.json({
      team,
      members: membersWithProfiles,
      documents: documents || [],
      user_role: userMembership?.role || null,
      is_member: !!userMembership,
      user_org_role: membership.role,
    });
  } catch (error) {
    console.error("Team GET error:", error);
    return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
  }
}

// PUT update team details
export async function PUT(
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

    const { name, description, color } = await request.json();

    // Build update object
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (color !== undefined) updates.color = color;

    // Check for duplicate name
    if (name) {
      const { data: existing } = await supabase
        .from("teams")
        .select("id")
        .eq("organization_id", membership.organization_id)
        .eq("name", name.trim())
        .neq("id", teamId)
        .single();

      if (existing) {
        return NextResponse.json({ error: "A team with this name already exists" }, { status: 400 });
      }
    }

    const { data: team, error } = await supabase
      .from("teams")
      .update(updates)
      .eq("id", teamId)
      .eq("organization_id", membership.organization_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating team:", error);
      return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
    }

    return NextResponse.json({ message: "Team updated", team });
  } catch (error) {
    console.error("Team PUT error:", error);
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
  }
}

// DELETE team
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

    // Only org admins/owners can delete teams
    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Set documents' team_id to null (make them org-wide)
    await supabase
      .from("documents")
      .update({ team_id: null })
      .eq("team_id", teamId);

    // Delete team (cascade will delete team_members)
    const { error } = await supabase
      .from("teams")
      .delete()
      .eq("id", teamId)
      .eq("organization_id", membership.organization_id);

    if (error) {
      console.error("Error deleting team:", error);
      return NextResponse.json({ error: "Failed to delete team" }, { status: 500 });
    }

    return NextResponse.json({ message: "Team deleted successfully" });
  } catch (error) {
    console.error("Team DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete team" }, { status: 500 });
  }
}