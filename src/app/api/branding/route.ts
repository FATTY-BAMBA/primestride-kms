import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET branding for current org
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

    const { data } = await supabase
      .from("org_branding")
      .select("*")
      .eq("organization_id", membership.organization_id)
      .single();

    return NextResponse.json({ branding: data || null });
  } catch {
    return NextResponse.json({ error: "Failed to fetch branding" }, { status: 500 });
  }
}

// POST/PUT save branding
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await request.json();
    const { org_name, logo_emoji, logo_url, primary_color, accent_color, tagline } = body;

    const brandingData = {
      organization_id: membership.organization_id,
      org_name: org_name?.trim() || null,
      logo_emoji: logo_emoji || null,
      logo_url: logo_url?.trim() || null,
      primary_color: primary_color || "#7C3AED",
      accent_color: accent_color || "#A78BFA",
      tagline: tagline?.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };

    // Upsert
    const { data, error } = await supabase
      .from("org_branding")
      .upsert(brandingData, { onConflict: "organization_id" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ branding: data });
  } catch {
    return NextResponse.json({ error: "Failed to save branding" }, { status: 500 });
  }
}
