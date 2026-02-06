import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET all organizations the user belongs to
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all active memberships with org details
    const { data: memberships, error } = await supabase
      .from("organization_members")
      .select("organization_id, role, joined_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("joined_at", { ascending: false });

    if (error) {
      console.error("Error fetching memberships:", error);
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ organizations: [] });
    }

    // Get org details and document counts for each membership
    const orgsWithDetails = await Promise.all(
      memberships.map(async (m) => {
        // Get org name
        const { data: org } = await supabase
          .from("organizations")
          .select("id, name")
          .eq("id", m.organization_id)
          .single();

        // Get document count
        const { count } = await supabase
          .from("documents")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", m.organization_id);

        // Get member count
        const { count: memberCount } = await supabase
          .from("organization_members")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", m.organization_id)
          .eq("is_active", true);

        return {
          id: m.organization_id,
          name: org?.name || "Unknown Organization",
          role: m.role,
          joined_at: m.joined_at,
          document_count: count || 0,
          member_count: memberCount || 0,
        };
      })
    );

    return NextResponse.json({ organizations: orgsWithDetails });
  } catch (error) {
    console.error("Error in organizations API:", error);
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
  }
}

// POST to switch active organization (stores preference)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    // Verify user is a member of this org
    const { data: membership, error } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .single();

    if (error || !membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    // Update user's active_organization_id in profiles
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ active_organization_id: organizationId })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating active org:", updateError);
      // Don't fail - column might not exist yet
    }

    return NextResponse.json({ 
      success: true, 
      organization_id: organizationId,
      role: membership.role 
    });
  } catch (error) {
    console.error("Error switching organization:", error);
    return NextResponse.json({ error: "Failed to switch organization" }, { status: 500 });
  }
}