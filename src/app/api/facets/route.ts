import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

interface DocRow {
  doc_type: string | null;
  domain: string | null;
  ai_maturity_stage: string | null;
  tags: string[] | null;
  status: string | null;
}

export async function GET() {
  try {
    const { data: docs, error } = await supabase
      .from("documents")
      .select("doc_type,domain,ai_maturity_stage,tags,status");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const docTypes = new Set<string>();
    const domains = new Set<string>();
    const maturityStages = new Set<string>();
    const statuses = new Set<string>();
    const tagCounts: Record<string, number> = {};

    for (const d of (docs ?? []) as DocRow[]) {
      if (d.doc_type) docTypes.add(d.doc_type);
      if (d.domain) domains.add(d.domain);
      if (d.ai_maturity_stage) maturityStages.add(d.ai_maturity_stage);
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
      ai_maturity_stages: Array.from(maturityStages).sort(),
      statuses: Array.from(statuses).sort(),
      top_tags: topTags,
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}