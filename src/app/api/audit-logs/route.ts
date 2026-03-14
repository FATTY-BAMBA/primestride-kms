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

    // Fetch from audit_logs (explicit admin actions)
    let auditQuery = supabase
      .from("audit_logs")
      .select("id, action, user_id, user_name, target_type, target_id, target_title, details, created_at", { count: "exact" })
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (actionFilter) auditQuery = auditQuery.eq("action", actionFilter);
    if (userFilter) auditQuery = auditQuery.eq("user_id", userFilter);

    const { data: auditLogs, error: auditError, count: auditCount } = await auditQuery;
    if (auditError) return NextResponse.json({ error: auditError.message }, { status: 500 });

    // Fetch from usage_logs (AI/search/view events) as supplementary source
    let usageQuery = supabase
      .from("usage_logs")
      .select("id, action, user_id, resource_type, resource_id, metadata, created_at")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (actionFilter) usageQuery = usageQuery.eq("action", actionFilter);
    if (userFilter) usageQuery = usageQuery.eq("user_id", userFilter);

    const { data: usageLogs } = await usageQuery;

    // Resolve user names for usage_logs entries
    const userIds = [...new Set([
      ...(auditLogs || []).filter(l => !l.user_name).map(l => l.user_id),
      ...(usageLogs || []).map(l => l.user_id),
    ].filter(Boolean))];

    const profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      (profiles || []).forEach(p => {
        profileMap.set(p.id, p.full_name || p.email?.split("@")[0] || p.id.slice(0, 12));
      });
    }

    // Normalize usage_logs to audit_log shape
    const normalizedUsage = (usageLogs || []).map(u => ({
      id: u.id,
      action: u.action,
      user_id: u.user_id,
      user_name: profileMap.get(u.user_id) || u.user_id?.slice(0, 12),
      target_type: u.resource_type || null,
      target_id: u.resource_id || null,
      target_title: u.metadata?.title || u.resource_id || null,
      details: u.metadata ? JSON.stringify(u.metadata) : null,
      created_at: u.created_at,
      source: "usage",
    }));

    // Normalize audit_logs
    const normalizedAudit = (auditLogs || []).map(l => ({
      ...l,
      user_name: l.user_name || profileMap.get(l.user_id) || l.user_id?.slice(0, 12),
      source: "audit",
    }));

    // Merge and sort by created_at desc, deduplicate by id
    const seenIds = new Set<string>();
    const merged = [...normalizedAudit, ...normalizedUsage]
      .filter(l => { if (seenIds.has(l.id)) return false; seenIds.add(l.id); return true; })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    const total = (auditCount || 0) + (usageLogs?.length || 0);

    return NextResponse.json({ logs: merged, total, limit, offset });
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