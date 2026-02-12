import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DocRow {
  doc_type: string | null;
  domain: string | null;
  tags: string[] | null;
  status: string | null;
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const membership = await getUserOrganization(userId);

    if (!membership) {
      return NextResponse.json({
        doc_types: [],
        domains: [],
        statuses: [],
        top_tags: [],
      });
    }

    // Get documents for user's organization only
    const { data: docs, error } = await supabase
      .from("documents")
      .select("doc_type,domain,tags,status")
      .eq("organization_id", membership.organization_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const docTypes = new Set<string>();
    const domains = new Set<string>();
    const statuses = new Set<string>();
    const tagCounts: Record<string, number> = {};

    for (const d of (docs ?? []) as DocRow[]) {
      if (d.doc_type) docTypes.add(d.doc_type);
      if (d.domain) domains.add(d.domain);
      if (d.status) statuses.add(d.status);

      const tags: string[] = Array.isArray(d.tags) ? d.tags : [];
      for (const t of tags) {
        const key = String(t).trim();
        if (!key) continue;
        tagCounts[key] = (tagCounts[key] ?? 0) + 1;
      }
    }

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([tag, count]) => ({ tag, count }));

    return NextResponse.json({
      doc_types: Array.from(docTypes).sort(),
      domains: Array.from(domains).sort(),
      statuses: Array.from(statuses).sort(),
      top_tags: topTags,
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("Facets error:", e);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}