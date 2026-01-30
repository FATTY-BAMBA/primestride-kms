import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Get organization membership
    const { data: membership, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (memberError || !membership) {
      console.error("Membership error:", memberError);
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