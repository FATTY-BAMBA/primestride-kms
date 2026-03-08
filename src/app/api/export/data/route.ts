import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";
import { logUsage } from "@/lib/usage-logger";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/export?type=documents|workflows|compliance|leave_balances|usage_logs|all
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

    // Only admin/owner can export
    if (org.role !== "owner" && org.role !== "admin") {
      return NextResponse.json({ error: "Admin access required for data export" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const exportType = searchParams.get("type") || "all";
    const format = searchParams.get("format") || "csv"; // csv or json

    const orgId = org.organization_id;
    const results: Record<string, any[]> = {};

    // ── Fetch data based on type ──
    if (exportType === "documents" || exportType === "all") {
      const { data } = await supabase
        .from("documents")
        .select("id, title, doc_type, tags, status, uploaded_by, created_at, updated_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      results.documents = data || [];
    }

    if (exportType === "workflows" || exportType === "all") {
      const { data } = await supabase
        .from("workflow_submissions")
        .select("id, form_type, form_data, status, submitted_by, original_text, ai_parsed, reviewed_by, review_note, reviewed_at, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      results.workflows = data || [];
    }

    if (exportType === "compliance" || exportType === "all") {
      const { data } = await supabase
        .from("compliance_checks")
        .select("id, user_id, check_type, status, rule_reference, message, message_zh, details, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      results.compliance = data || [];
    }

    if (exportType === "leave_balances" || exportType === "all") {
      const { data } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("organization_id", orgId);
      results.leave_balances = data || [];
    }

    if (exportType === "usage_logs" || exportType === "all") {
      const { data } = await supabase
        .from("usage_logs")
        .select("id, user_id, action, resource_type, resource_id, metadata, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(5000);
      results.usage_logs = data || [];
    }

    // Log the export action
    logUsage({
      organization_id: orgId,
      user_id: userId,
      action: "export.download",
      resource_type: exportType,
      metadata: { format, tables: Object.keys(results) },
    });

    // ── Return as JSON ──
    if (format === "json") {
      const filename = `atlas_export_${exportType}_${new Date().toISOString().split("T")[0]}.json`;
      return new NextResponse(JSON.stringify(results, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ── Return as CSV ──
    const csvParts: string[] = [];

    for (const [tableName, rows] of Object.entries(results)) {
      if (rows.length === 0) continue;

      csvParts.push(`\n--- ${tableName.toUpperCase()} (${rows.length} records) ---\n`);

      // Get all unique keys from all rows
      const allKeys = new Set<string>();
      rows.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
      const headers = Array.from(allKeys);

      // Header row
      csvParts.push(headers.map(h => `"${h}"`).join(","));

      // Data rows
      rows.forEach(row => {
        const values = headers.map(h => {
          let val = row[h];
          if (val === null || val === undefined) return '""';
          if (typeof val === "object") val = JSON.stringify(val);
          // Escape quotes and wrap in quotes
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        csvParts.push(values.join(","));
      });
    }

    const csvContent = csvParts.join("\n");
    const filename = `atlas_export_${exportType}_${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("Export error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}