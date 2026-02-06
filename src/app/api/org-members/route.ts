import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

// GET all members in the user's organization (for adding to teams)
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrgMembership(userId);
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Get all members of the organization
    const { data: orgMembers, error } = await supabase
      .from("organization_members")
      .select("user_id, role, joined_at")
      .eq("organization_id", membership.organization_id)
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching org members:", error);
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
    }

    // Get profile info for each member
    const membersWithProfiles = await Promise.all(
      (orgMembers || []).map(async (m) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name, avatar_url")
          .eq("id", m.user_id)
          .single();

        return {
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          email: profile?.email || "Unknown",
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
        };
      })
    );

    return NextResponse.json({ 
      members: membersWithProfiles,
      organization_id: membership.organization_id,
    });
  } catch (error) {
    console.error("Org members GET error:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}