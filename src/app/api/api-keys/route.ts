import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET list API keys for org
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { data: keys } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, scopes, created_at, last_used_at, is_active")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ keys: keys || [] });
  } catch {
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}

// POST create new API key
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
    const { name, scopes } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

    // Generate secure API key
    const rawKey = crypto.randomBytes(32).toString("hex");
    const apiKey = `psa_${rawKey}`;
    const keyPrefix = `psa_${rawKey.slice(0, 8)}...`;
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        name: name.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: scopes || ["read", "write", "search"],
        organization_id: membership.organization_id,
        created_by: userId,
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Return the full key ONLY on creation — it's never stored in plaintext
    return NextResponse.json({
      key: data,
      apiKey, // Show once, never again
      message: "Save this API key — it won't be shown again.",
    });
  } catch {
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}

// DELETE revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("id");
    if (!keyId) return NextResponse.json({ error: "Key ID required" }, { status: 400 });

    const { error } = await supabase
      .from("api_keys")
      .update({ is_active: false })
      .eq("id", keyId)
      .eq("organization_id", membership.organization_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: "Key revoked" });
  } catch {
    return NextResponse.json({ error: "Failed to revoke key" }, { status: 500 });
  }
}
