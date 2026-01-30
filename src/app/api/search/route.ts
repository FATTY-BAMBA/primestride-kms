import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DocRecord {
  doc_id: string;
  title: string;
  current_version: string;
  status: string;
  file_url: string | null;
  doc_type: string | null;
  domain: string | null;
  tags: string[] | null;
  content: string | null;
  organization_id: string;
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!membership) {
      return NextResponse.json({ results: [] });
    }

    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") || "").trim();
    const docType = (searchParams.get("doc_type") || "").trim();
    const domain = (searchParams.get("domain") || "").trim();
    const tag = (searchParams.get("tag") || "").trim();
    const status = (searchParams.get("status") || "").trim();

    if (!q && !docType && !domain && !tag && !status) {
      return NextResponse.json({ results: [] });
    }

    // Get documents with filters - scoped to user's organization
    let docsQuery = supabase
      .from("documents")
      .select("doc_id,title,current_version,status,file_url,doc_type,domain,tags,content,organization_id")
      .eq("organization_id", membership.organization_id);

    if (docType) docsQuery = docsQuery.eq("doc_type", docType);
    if (domain) docsQuery = docsQuery.eq("domain", domain);
    if (tag) docsQuery = docsQuery.contains("tags", [tag]);
    if (status) docsQuery = docsQuery.eq("status", status);

    const { data: docs, error: docsErr } = await docsQuery;

    console.log("ROUTE: /api/search");
    console.log("USER:", userId);
    console.log("ORG:", membership.organization_id);
    console.log("DOC IDS:", (docs ?? []).map((d: any) => d.doc_id));
    console.log("DOCS ERR:", docsErr);

    if (docsErr) return NextResponse.json({ error: docsErr.message }, { status: 500 });

    if (!docs || docs.length === 0) return NextResponse.json({ results: [] });

    const docRecords = docs as DocRecord[];

    // If no text query, return filtered docs list
    if (!q) {
      const results = docRecords.map((d) => ({
        doc_id: d.doc_id,
        title: d.title,
        version: d.current_version,
        doc_type: d.doc_type,
        domain: d.domain,
        tags: d.tags ?? [],
        status: d.status,
        file_url: d.file_url,
        score: 0,
        snippet: d.content?.substring(0, 200) || "",
        section_title: "",
        section_path: "",
        why_matched: [],
      }));
      return NextResponse.json({ results });
    }

    // Text search in content
    const results = docRecords
      .filter((d) => {
        const content = (d.content || "").toLowerCase();
        const title = (d.title || "").toLowerCase();
        const qLower = q.toLowerCase();
        return content.includes(qLower) || title.includes(qLower);
      })
      .map((d) => {
        const scoring = scoreDocMatch({ 
          title: d.title, 
          content: d.content || "", 
          query: q 
        });
        const snippet = makeSnippet(d.content || "", q);

        return {
          doc_id: d.doc_id,
          title: d.title,
          version: d.current_version,
          doc_type: d.doc_type,
          domain: d.domain,
          tags: d.tags ?? [],
          status: d.status,
          file_url: d.file_url,
          score: scoring.score,
          snippet,
          section_title: "",
          section_path: "",
          why_matched: scoring.why_matched,
        };
      })
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({ results });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("Search error:", e);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Scoring function
function scoreDocMatch(params: { title: string; content: string; query: string }) {
  const { title, content, query } = params;

  const q = (query || "").trim();
  if (!q) return { score: 0, why_matched: [] as string[] };

  const qLower = q.toLowerCase();
  const titleLower = (title || "").toLowerCase();
  const contentLower = (content || "").toLowerCase();

  const why: string[] = [];
  let score = 0;

  // Title match (big boost)
  if (titleLower.includes(qLower)) {
    score += 120;
    why.push("keyword in title");
  }

  // Body frequency
  const bodyCount = countOccurrences(contentLower, qLower);
  if (bodyCount > 0) {
    score += Math.min(bodyCount, 12) * 6;
    why.push("keyword in content (" + bodyCount + ")");
  }

  // Early match
  const firstIdx = contentLower.indexOf(qLower);
  if (firstIdx >= 0 && firstIdx < 800) {
    score += 18;
    why.push("match appears early");
  }

  if (why.length === 0) why.push("keyword matched");

  return { score, why_matched: why };
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    const found = haystack.indexOf(needle, idx);
    if (found === -1) break;
    count += 1;
    idx = found + needle.length;
  }
  return count;
}

function makeSnippet(content: string, q: string): string {
  if (!content.trim()) return "";

  const lower = content.toLowerCase();
  const qLower = q.toLowerCase();
  const matchIdx = lower.indexOf(qLower);

  const clean = content.replace(/\s+/g, " ").trim();

  if (matchIdx === -1) {
    return clean.slice(0, 220) + (clean.length > 220 ? "…" : "");
  }

  const cleanLower = clean.toLowerCase();
  const cleanIdx = cleanLower.indexOf(qLower);

  const start = Math.max(0, cleanIdx - 80);
  const end = Math.min(clean.length, cleanIdx + 140);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";

  return prefix + clean.slice(start, end) + suffix;
}