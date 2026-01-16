import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

interface DocRecord {
  doc_id: string;
  title: string;
  current_version: string;
  status: string;
  source_type: string | null;
  source_url: string | null;
  doc_type: string | null;
  domain: string | null;
  ai_maturity_stage: string | null;
  tags: string[] | null;
}

interface VersionRecord {
  doc_id: string;
  version: string;
  content_snapshot: string | null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") || "").trim();
    const docType = (searchParams.get("doc_type") || "").trim();
    const domain = (searchParams.get("domain") || "").trim();
    const tag = (searchParams.get("tag") || "").trim();
    const maturity = (searchParams.get("ai_maturity_stage") || "").trim();
    const status = (searchParams.get("status") || "").trim();

    if (!q && !docType && !domain && !tag && !maturity && !status) {
      return NextResponse.json({ results: [] });
    }

    // 1) Get documents (with filters)
    let docsQuery = supabase
      .from("documents")
      .select("doc_id,title,current_version,status,source_type,source_url,doc_type,domain,ai_maturity_stage,tags");

    if (docType) docsQuery = docsQuery.eq("doc_type", docType);
    if (domain) docsQuery = docsQuery.eq("domain", domain);
    if (tag) docsQuery = docsQuery.contains("tags", [tag]);
    if (maturity) docsQuery = docsQuery.eq("ai_maturity_stage", maturity);
    if (status) docsQuery = docsQuery.eq("status", status);

    const { data: docs, error: docsErr } = await docsQuery;

    // 🔍 DEBUG LOGS — ADD HERE
    console.log("ROUTE: /api/search");
    console.log("DOC IDS:", (docs ?? []).map((d: any) => d.doc_id));
    console.log("DOCS ERR:", docsErr);

    if (docsErr) return NextResponse.json({ error: docsErr.message }, { status: 500 });

    if (!docs || docs.length === 0) return NextResponse.json({ results: [] });

    const docRecords = docs as DocRecord[];

    // Map doc_id -> metadata
    const docMap = new Map<string, DocRecord>();
    docRecords.forEach((d) => {
      docMap.set(d.doc_id, d);
    });

    // If no text query, return filtered docs list without text search
    if (!q) {
      const results = docRecords.map((d) => ({
        doc_id: d.doc_id,
        title: d.title,
        version: d.current_version,
        doc_type: d.doc_type,
        domain: d.domain,
        ai_maturity_stage: d.ai_maturity_stage,
        tags: d.tags ?? [],
        status: d.status,
        source_url: d.source_url,
        score: 0,
        snippet: "",
        section_title: "",
        section_path: "",
        why_matched: [],
      }));
      return NextResponse.json({ results });
    }

    // 2) Search doc_versions content snapshots using full-text search
    const { data: versions, error: verErr } = await supabase
      .from("doc_versions")
      .select("doc_id,version,content_snapshot")
      .textSearch("content_tsv", q, { type: "plain" });

    if (verErr) {
      // Fallback: if FTS fails (no index yet), do simple ILIKE search
      const { data: fallbackVersions, error: fallbackErr } = await supabase
        .from("doc_versions")
        .select("doc_id,version,content_snapshot")
        .ilike("content_snapshot", "%" + q + "%");

      if (fallbackErr) {
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
      }

      const versionRecords = (fallbackVersions ?? []) as VersionRecord[];
      return buildResults(versionRecords, docMap, q);
    }

    const versionRecords = (versions ?? []) as VersionRecord[];
    return buildResults(versionRecords, docMap, q);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function buildResults(
  versions: VersionRecord[],
  docMap: Map<string, DocRecord>,
  q: string
) {
  // Keep only rows that are current_version for that doc
  const currentRows = versions.filter((r) => {
    const d = docMap.get(r.doc_id);
    return d && d.current_version === r.version;
  });

  const results = currentRows.map((r) => {
    const d = docMap.get(r.doc_id);
    const title = d?.title ?? "";
    const content = r.content_snapshot ?? "";

    // Advanced scoring with explanation
    const scoring = scoreDocMatch({ title, markdown: content, query: q });

    // Section-level snippet
    const { snippet, sectionTitle, sectionPath } = makeSectionedSnippet(content, q);

    return {
      doc_id: r.doc_id,
      title,
      version: r.version,
      doc_type: d?.doc_type ?? null,
      domain: d?.domain ?? null,
      ai_maturity_stage: d?.ai_maturity_stage ?? null,
      tags: d?.tags ?? [],
      status: d?.status ?? null,
      source_url: d?.source_url ?? null,
      score: scoring.score,
      snippet,
      section_title: sectionTitle,
      section_path: sectionPath,
      why_matched: scoring.why_matched,
    };
  });

  results.sort((a, b) => b.score - a.score);

  return NextResponse.json({ results });
}

// ============================================
// Scoring with explanation
// ============================================

function scoreDocMatch(params: { title: string; markdown: string; query: string }) {
  const { title, markdown, query } = params;

  const q = (query || "").trim();
  if (!q) return { score: 0, why_matched: [] as string[] };

  const qLower = q.toLowerCase();
  const titleLower = (title || "").toLowerCase();
  const md = (markdown || "").toString();

  const why: string[] = [];
  let score = 0;

  // 1) Title match (big boost)
  if (titleLower.includes(qLower)) {
    score += 120;
    why.push("keyword in title");
  }

  // 2) Heading match (strong boost)
  const headingMatches = countHeadingMatches(md, qLower);
  if (headingMatches > 0) {
    score += 90 + Math.min(headingMatches, 3) * 15;
    why.push("keyword in heading (" + headingMatches + ")");
  }

  // 3) Body frequency (moderate boost)
  const bodyCount = countOccurrences(md.toLowerCase(), qLower);
  if (bodyCount > 0) {
    score += Math.min(bodyCount, 12) * 6;
    why.push("keyword in body (" + bodyCount + ")");
  }

  // 4) Early match (small but meaningful)
  const firstIdx = md.toLowerCase().indexOf(qLower);
  if (firstIdx >= 0) {
    if (firstIdx < 800) {
      score += 18;
      why.push("match appears early");
    } else if (firstIdx < 2000) {
      score += 8;
      why.push("match appears mid-document");
    }
  }

  // 5) Multi-word query support
  const tokens = qLower.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const tokenHits = tokens.filter((t) => t.length >= 3 && md.toLowerCase().includes(t)).length;
    if (tokenHits >= 2) {
      score += 14;
      why.push("multiple query tokens matched (" + tokenHits + "/" + tokens.length + ")");
    }
  }

  if (why.length === 0) why.push("keyword matched");

  return { score, why_matched: why };
}

function countHeadingMatches(md: string, qLower: string): number {
  const lines = (md || "").split(/\r?\n/);
  let count = 0;
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!m) continue;
    const headingText = m[2].toLowerCase();
    if (headingText.includes(qLower)) count += 1;
  }
  return count;
}

function countOccurrences(haystackLower: string, needleLower: string): number {
  if (!needleLower) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    const found = haystackLower.indexOf(needleLower, idx);
    if (found === -1) break;
    count += 1;
    idx = found + needleLower.length;
  }
  return count;
}

// ============================================
// Section-level snippet with heading context
// ============================================

function makeSectionedSnippet(md: string, q: string) {
  const content = (md ?? "").toString();
  if (!content.trim()) {
    return { snippet: "", sectionTitle: "", sectionPath: "" };
  }

  const lower = content.toLowerCase();
  const qLower = q.toLowerCase();
  const matchIdx = lower.indexOf(qLower);

  // No match found - return beginning of content
  if (matchIdx === -1) {
    const clean = content.replace(/\s+/g, " ").trim();
    return {
      snippet: clean.slice(0, 220) + (clean.length > 220 ? "…" : ""),
      sectionTitle: "",
      sectionPath: "",
    };
  }

  // Find nearest heading above match
  const headingInfo = findNearestHeadingAbove(content, matchIdx);

  // Build snippet around match
  const clean = content.replace(/\s+/g, " ").trim();
  const cleanLower = clean.toLowerCase();
  const cleanIdx = cleanLower.indexOf(qLower);

  const start = Math.max(0, cleanIdx - 80);
  const end = Math.min(clean.length, cleanIdx + 140);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";

  return {
    snippet: prefix + clean.slice(start, end) + suffix,
    sectionTitle: headingInfo.title,
    sectionPath: headingInfo.path,
  };
}

function findNearestHeadingAbove(md: string, matchIdx: number) {
  const lines = md.split(/\r?\n/);
  let pos = 0;
  const stack: { level: number; title: string }[] = [];

  for (const line of lines) {
    const lineStart = pos;
    pos += line.length + 1; // +1 for newline

    // Stop when we pass the match position
    if (lineStart > matchIdx) break;

    const h = parseMarkdownHeading(line);
    if (!h) continue;

    // Maintain proper stack: pop headings of same or deeper level
    while (stack.length && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }
    stack.push(h);
  }

  const title = stack.length ? stack[stack.length - 1].title : "";
  const path = stack.map((x) => x.title).join(" > ");
  return { title, path };
}

function parseMarkdownHeading(line: string): { level: number; title: string } | null {
  const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
  if (!m) return null;

  const level = m[1].length;
  const title = m[2].replace(/\s+#+\s*$/, "").trim(); // Remove trailing hashes
  if (!title) return null;
  return { level, title };
}