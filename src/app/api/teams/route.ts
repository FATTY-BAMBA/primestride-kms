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

  // If multiple, find one with docs or use first
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

// GET all teams in user's organization
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrgMembership(userId);
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Get all teams in the organization
    const { data: teams, error } = await supabase
      .from("teams")
      .select("*")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching teams:", error);
      return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
    }

    // Get member counts and document counts for each team
    const teamsWithCounts = await Promise.all(
      (teams || []).map(async (team) => {
        const { count: memberCount } = await supabase
          .from("team_members")
          .select("*", { count: "exact", head: true })
          .eq("team_id", team.id);

        const { count: docCount } = await supabase
          .from("documents")
          .select("*", { count: "exact", head: true })
          .eq("team_id", team.id);

        // Check if current user is a member of this team
        const { data: userMembership } = await supabase
          .from("team_members")
          .select("role")
          .eq("team_id", team.id)
          .eq("user_id", userId)
          .single();

        return {
          ...team,
          member_count: memberCount || 0,
          document_count: docCount || 0,
          user_role: userMembership?.role || null,
          is_member: !!userMembership,
        };
      })
    );

    return NextResponse.json({ 
      teams: teamsWithCounts,
      user_org_role: membership.role,
    });
  } catch (error) {
    console.error("Teams GET error:", error);
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}

// POST create a new team
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrgMembership(userId);
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Only owners and admins can create teams
    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const { name, description, color } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }

    // Check if team name already exists in org
    const { data: existing } = await supabase
      .from("teams")
      .select("id")
      .eq("organization_id", membership.organization_id)
      .eq("name", name.trim())
      .single();

    if (existing) {
      return NextResponse.json({ error: "A team with this name already exists" }, { status: 400 });
    }

    // Create the team
    const { data: team, error } = await supabase
      .from("teams")
      .insert({
        organization_id: membership.organization_id,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || "#7C3AED",
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating team:", error);
      return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
    }

    // Automatically add creator as team lead
    await supabase
      .from("team_members")
      .insert({
        team_id: team.id,
        user_id: userId,
        role: "lead",
        added_by: userId,
      });

    return NextResponse.json({ 
      message: "Team created successfully",
      team: {
        ...team,
        member_count: 1,
        document_count: 0,
        is_member: true,
        user_role: "lead",
      }
    });
  } catch (error) {
    console.error("Teams POST error:", error);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
}