import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";
import { getUsageStats } from "@/lib/usage-logger";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/usage — Admin-only usage stats and logs
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getUserOrganization(userId);
    if (!org) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    // Check if user is admin/owner
    if (org.role !== "owner" && org.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30");
    const view = searchParams.get("view") || "stats"; // "stats" or "logs"

    if (view === "logs") {
      const limit = parseInt(searchParams.get("limit") || "100");
      const action = searchParams.get("action");

      let query = supabase
        .from("usage_logs")
        .select("*")
        .eq("organization_id", org.organization_id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (action) query = query.eq("action", action);

      const since = new Date();
      since.setDate(since.getDate() - days);
      query = query.gte("created_at", since.toISOString());

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ logs: data, total: data?.length || 0 });
    }

    // Default: stats view
    const stats = await getUsageStats(org.organization_id, days);
    if (!stats) {
      return NextResponse.json({ error: "Failed to fetch usage stats" }, { status: 500 });
    }

    return NextResponse.json({
      organization_id: org.organization_id,
      stats,
    });
  } catch (err: any) {
    console.error("Usage API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}