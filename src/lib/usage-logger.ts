import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Log a usage event to the usage_logs table.
 * Non-blocking — fires and forgets so it doesn't slow down API responses.
 *
 * Actions:
 *   - login
 *   - document.upload, document.view, document.delete
 *   - chat.query
 *   - workflow.submit, workflow.review
 *   - compliance.check
 *   - audit.scan (public, no user_id)
 *   - export.download
 */
export function logUsage(params: {
  organization_id: string;
  user_id: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
}) {
  // Fire and forget — don't await, don't block the response
  supabase
    .from("usage_logs")
    .insert({
      organization_id: params.organization_id,
      user_id: params.user_id,
      action: params.action,
      resource_type: params.resource_type || null,
      resource_id: params.resource_id || null,
      metadata: params.metadata || {},
      ip_address: params.ip_address || null,
    })
    .then(({ error }) => {
      if (error) console.error("Usage log error:", error.message);
    });
}

/**
 * Get usage stats for an organization.
 * Used by admin dashboard and the government application reporting.
 */
export async function getUsageStats(organization_id: string, days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: logs, error } = await supabase
    .from("usage_logs")
    .select("action, user_id, created_at, metadata")
    .eq("organization_id", organization_id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error || !logs) return null;

  const stats = {
    total_events: logs.length,
    unique_users: new Set(logs.map(l => l.user_id)).size,
    document_uploads: logs.filter(l => l.action === "document.upload").length,
    chat_queries: logs.filter(l => l.action === "chat.query").length,
    workflow_submissions: logs.filter(l => l.action === "workflow.submit").length,
    compliance_checks: logs.filter(l => l.action === "compliance.check").length,
    exports: logs.filter(l => l.action === "export.download").length,
    logins: logs.filter(l => l.action === "login").length,
    period_days: days,
    since: since.toISOString(),
    daily_breakdown: {} as Record<string, number>,
  };

  // Daily breakdown
  logs.forEach(l => {
    const day = l.created_at.split("T")[0];
    stats.daily_breakdown[day] = (stats.daily_breakdown[day] || 0) + 1;
  });

  return stats;
}