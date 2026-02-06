import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to get user's active organization (handles multiple memberships)
async function getUserOrganization(userId: string) {
  // Get all active memberships for this user
  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching memberships:", error);
    return null;
  }

  if (!memberships || memberships.length === 0) {
    return null;
  }

  // If only one membership, return it
  if (memberships.length === 1) {
    return memberships[0];
  }

  // Multiple memberships: find the one with documents
  for (const membership of memberships) {
    const { count } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", membership.organization_id);

    if (count && count > 0) {
      return membership;
    }
  }

  // If no org has docs, return the first one
  return memberships[0];
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Profile error:", profileError);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get organization membership (handles multiple memberships)
    const membership = await getUserOrganization(userId);

    if (!membership) {
      console.log("No membership found for user:", userId);
      return NextResponse.json({ 
        ...profile,
        organization_id: null,
        org_role: null 
      });
    }

    return NextResponse.json({
      ...profile,
      organization_id: membership.organization_id,
      role: membership.role, // org role (owner/admin/member)
    });
  } catch (error) {
    console.error("Profile API error:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}