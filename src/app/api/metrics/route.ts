import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get user's organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!membership) return NextResponse.json({ error: "No organization found" }, { status: 404 });

    const orgId = membership.organization_id;
    const days = parseInt(request.nextUrl.searchParams.get("days") || "30");
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    // Get branding org name
    const { data: branding } = await supabase
      .from("org_branding")
      .select("org_name")
      .eq("organization_id", orgId)
      .single();

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    const orgName = branding?.org_name?.trim() || org?.name || "Your Organization";

    // Get usage logs for this org within period
    const { data: logs, error } = await supabase
      .from("usage_logs")
      .select("action, created_at")
      .eq("organization_id", orgId)
      .gte("created_at", sinceStr)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching usage logs:", error);
      return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
    }

    // Get member count
    const { count: memberCount } = await supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("is_active", true);

    // Build daily stats — fill in all days in range even if 0
    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = 0;
    }
    (logs || []).forEach(log => {
      const key = new Date(log.created_at).toISOString().split("T")[0];
      if (key in dailyMap) dailyMap[key]++;
    });

    const dailyStats = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

    // Build action stats
    const actionMap: Record<string, number> = {};
    (logs || []).forEach(log => {
      actionMap[log.action] = (actionMap[log.action] || 0) + 1;
    });
    const actionStats = Object.entries(actionMap)
      .sort((a, b) => b[1] - a[1])
      .map(([action, count]) => ({ action, count }));

    const totalEvents = (logs || []).length;
    const activeDays = Object.values(dailyMap).filter(v => v > 0).length;
    const topAction = actionStats[0]?.action || "";

    return NextResponse.json({
      orgName,
      totalEvents,
      activeDays,
      totalMembers: memberCount || 0,
      topAction,
      dailyStats,
      actionStats,
    });
  } catch (error) {
    console.error("Error in metrics API:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}