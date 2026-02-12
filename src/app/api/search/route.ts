import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  summary: string | null;
  organization_id: string;
}

// Cosine similarity calculation
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dot / mag;
}

// Generate embedding for a query
async function getQueryEmbedding(query: string): Promise<number[] | null> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Failed to generate query embedding:", error);
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const membership = await getUserOrganization(userId);

    if (!membership) {
      return NextResponse.json({ results: [] });
    }

    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") || "").trim();
    const docType = (searchParams.get("doc_type") || "").trim();
    const domain = (searchParams.get("domain") || "").trim();
    const tag = (searchParams.get("tag") || "").trim();
    const status = (searchParams.get("status") || "").trim();
    const mode = (searchParams.get("mode") || "keyword").trim(); // "keyword" or "semantic"

    if (!q && !docType && !domain && !tag && !status) {
      return NextResponse.json({ results: [] });
    }

    // Get documents with filters - scoped to user's organization
    let docsQuery = supabase
      .from("documents")
      .select("doc_id,title,current_version,status,file_url,doc_type,domain,tags,content,summary,organization_id")
      .eq("organization_id", membership.organization_id);

    if (docType) docsQuery = docsQuery.eq("doc_type", docType);
    if (domain) docsQuery = docsQuery.eq("domain", domain);
    if (tag) docsQuery = docsQuery.contains("tags", [tag]);
    if (status) docsQuery = docsQuery.eq("status", status);

    const { data: docs, error: docsErr } = await docsQuery;

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
        snippet: d.summary || d.content?.substring(0, 200) || "",
        section_title: "",
        section_path: "",
        why_matched: [],
        search_mode: "filter",
      }));
      return NextResponse.json({ results });
    }

    // ============================================
    // SEMANTIC SEARCH MODE (AI-powered)
    // ============================================
    if (mode === "semantic") {
      console.log("🧠 Semantic search for:", q);

      // Generate query embedding
      const queryEmbedding = await getQueryEmbedding(q);
      if (!queryEmbedding) {
        return NextResponse.json({ error: "Failed to process search query" }, { status: 500 });
      }

      // Get all embeddings for this organization's docs
      const docIds = docRecords.map((d) => d.doc_id);
      const { data: embeddings } = await supabase
        .from("document_embeddings")
        .select("doc_id, embedding")
        .in("doc_id", docIds);

      if (!embeddings || embeddings.length === 0) {
        // Fall back to keyword search if no embeddings
        console.log("⚠️ No embeddings found, falling back to keyword search");
        return keywordSearch(docRecords, q);
      }

      // Calculate similarity for each document
      const scored = embeddings
        .map((emb) => {
          let docEmbedding: number[];
          try {
            docEmbedding = typeof emb.embedding === "string"
              ? JSON.parse(emb.embedding)
              : emb.embedding;
          } catch {
            return null;
          }

          const similarity = cosineSimilarity(queryEmbedding, docEmbedding);
          const doc = docRecords.find((d) => d.doc_id === emb.doc_id);
          if (!doc) return null;

          return {
            doc,
            similarity,
          };
        })
        .filter((item): item is { doc: DocRecord; similarity: number } => item !== null)
        .filter((item) => item.similarity > 0.25) // Minimum relevance threshold
        .sort((a, b) => b.similarity - a.similarity);

      const results = scored.map((item) => {
        const relevance = Math.round(item.similarity * 100);
        return {
          doc_id: item.doc.doc_id,
          title: item.doc.title,
          version: item.doc.current_version,
          doc_type: item.doc.doc_type,
          domain: item.doc.domain,
          tags: item.doc.tags ?? [],
          status: item.doc.status,
          file_url: item.doc.file_url,
          score: relevance,
          snippet: item.doc.summary || item.doc.content?.substring(0, 200) || "",
          section_title: "",
          section_path: "",
          why_matched: [`${relevance}% semantic match`],
          search_mode: "semantic",
        };
      });

      console.log(`✅ Semantic search found ${results.length} results`);
      return NextResponse.json({ results });
    }

    // ============================================
    // KEYWORD SEARCH MODE (original)
    // ============================================
    return keywordSearch(docRecords, q);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("Search error:", e);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Keyword search helper
function keywordSearch(docRecords: DocRecord[], q: string) {
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
        query: q,
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
        search_mode: "keyword",
      };
    })
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ results });
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