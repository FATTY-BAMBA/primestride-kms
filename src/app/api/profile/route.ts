import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, role, language")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Profile error:", profileError);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const membership = await getUserOrganization(userId);

    if (!membership) {
      return NextResponse.json({
        ...profile,
        language: profile.language || "zh",
        organization_id: null,
        org_role: null,
      });
    }

    return NextResponse.json({
      ...profile,
      language: profile.language || "zh",
      organization_id: membership.organization_id,
      role: membership.role,
    });
  } catch (error) {
    console.error("Profile API error:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Only allow safe fields to be updated
    const allowedFields: Record<string, unknown> = {};
    if (body.language && ["zh", "en"].includes(body.language)) {
      allowedFields.language = body.language;
    }
    if (body.full_name && typeof body.full_name === "string") {
      allowedFields.full_name = body.full_name.trim().slice(0, 100);
    }

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update(allowedFields)
      .eq("id", userId);

    if (error) {
      console.error("Profile update error:", error);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: allowedFields });
  } catch (error) {
    console.error("Profile PATCH error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}