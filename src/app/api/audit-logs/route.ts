import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET audit logs
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const actionFilter = searchParams.get("action");
    const userFilter = searchParams.get("user_id");

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (actionFilter) query = query.eq("action", actionFilter);
    if (userFilter) query = query.eq("user_id", userFilter);

    const { data: logs, error, count } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ logs: logs || [], total: count || 0, limit, offset });
  } catch {
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}

// POST create audit log entry (internal use)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization" }, { status: 404 });

    const body = await request.json();
    const { action, target_type, target_id, target_title, details } = body;

    if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });

    const { error } = await supabase
      .from("audit_logs")
      .insert({
        organization_id: membership.organization_id,
        user_id: userId,
        user_name: body.user_name || null,
        action,
        target_type: target_type || null,
        target_id: target_id || null,
        target_title: target_title || null,
        details: details || null,
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
      });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: "Logged" });
  } catch {
    return NextResponse.json({ error: "Failed to log" }, { status: 500 });
  }
}
