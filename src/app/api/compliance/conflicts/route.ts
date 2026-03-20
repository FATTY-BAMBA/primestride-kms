import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Article → law.moj.gov.tw URL mapping ──
const LAW_URLS: Record<string, string> = {
  "LSA Art. 24": "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=24",
  "LSA Art. 30": "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=30",
  "LSA Art. 32": "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=32",
  "LSA Art. 38": "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=38",
  "LSA Art. 50": "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=50",
  "LSA Art. 9-1": "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030036&flno=9-1",
};

function getLawUrl(article: string): string {
  // Try exact match first
  if (LAW_URLS[article]) return LAW_URLS[article];
  // Try partial match — e.g. "LSA Art. 24 — Overtime Pay"
  for (const [key, url] of Object.entries(LAW_URLS)) {
    if (article.startsWith(key)) return url;
  }
  // Default to full LSA
  return "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030001";
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getUserOrganization(userId);
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });

    const isAdmin = ["owner", "admin"].includes(org.role || "");
    if (!isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const body = await req.json();
    const { document_ids } = body;

    const orgId = org.organization_id;

    let query = supabase
      .from("documents")
      .select("doc_id, title, content")
      .eq("organization_id", orgId);

    if (document_ids && document_ids.length > 0) {
      query = query.in("doc_id", document_ids);
    } else {
      query = query.or(
        "title.ilike.%handbook%,title.ilike.%手冊%,title.ilike.%規章%,title.ilike.%辦法%,title.ilike.%policy%,title.ilike.%規定%,title.ilike.%管理%,tags.cs.{handbook},tags.cs.{policy},tags.cs.{hr},tags.cs.{人事}"
      );
    }

    const { data: docs } = await query.limit(10);

    if (!docs || docs.length === 0) {
      return NextResponse.json({
        conflicts: [],
        summary: {
          total_scanned: 0,
          message: "未找到公司手冊或政策文件。請上傳員工手冊後再試。No handbook or policy documents found.",
        },
      });
    }

    const { data: lawRules } = await supabase
      .from("compliance_knowledge")
      .select("id, article_number, title, content, content_zh, category")
      .eq("is_active", true)
      .order("article_number");

    if (!lawRules || lawRules.length === 0) {
      return NextResponse.json({
        conflicts: [],
        summary: { total_scanned: docs.length, message: "No compliance rules found. Run MOL sync first." },
      });
    }

    const lawReference = lawRules
      .map(r => `[${r.article_number || "Rule"}] ${r.title || ""}: ${r.content_zh || r.content}`)
      .join("\n");

    const allConflicts: ConflictItem[] = [];

    for (const doc of docs) {
      if (!doc.content || doc.content.trim().length < 50) continue;
      const chunks = chunkText(doc.content, 3000);
      for (const chunk of chunks) {
        const conflicts = await analyzeChunk(doc.doc_id, doc.title, chunk, lawReference);
        allConflicts.push(...conflicts);
      }
    }

    const severityOrder: Record<string, number> = { red: 0, yellow: 1, green: 2 };
    allConflicts.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

    const reportId = crypto.randomUUID();
    await supabase.from("compliance_reports").upsert({
      id: reportId,
      organization_id: orgId,
      report_type: "handbook_conflict_scan",
      scanned_documents: docs.map(d => d.doc_id),
      conflicts: allConflicts,
      summary: {
        total_scanned: docs.length,
        total_conflicts: allConflicts.length,
        red: allConflicts.filter(c => c.severity === "red").length,
        yellow: allConflicts.filter(c => c.severity === "yellow").length,
        green: allConflicts.filter(c => c.severity === "green").length,
      },
      scanned_by: userId,
      created_at: new Date().toISOString(),
    }, { onConflict: "id" });

    return NextResponse.json({
      report_id: reportId,
      conflicts: allConflicts,
      summary: {
        total_scanned: docs.length,
        documents: docs.map(d => ({ id: d.doc_id, title: d.title })),
        total_conflicts: allConflicts.length,
        red: allConflicts.filter(c => c.severity === "red").length,
        yellow: allConflicts.filter(c => c.severity === "yellow").length,
        green: allConflicts.filter(c => c.severity === "green").length,
      },
    });
  } catch (err: any) {
    console.error("Compliance conflict scan error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getUserOrganization(userId);
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });

    const isAdmin = ["owner", "admin"].includes(org.role || "");
    if (!isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { data: report } = await supabase
      .from("compliance_reports")
      .select("*")
      .eq("organization_id", org.organization_id)
      .eq("report_type", "handbook_conflict_scan")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!report) return NextResponse.json({ report: null });
    return NextResponse.json({ report });
  } catch {
    return NextResponse.json({ report: null });
  }
}

interface ConflictItem {
  severity: "red" | "yellow" | "green";
  category: string;
  document_id: string;
  document_title: string;
  handbook_text: string;
  law_reference: string;
  article: string;
  law_url: string;
  issue_zh: string;
  issue_en: string;
  recommendation_zh: string;
  recommendation_en: string;
}

async function analyzeChunk(
  docId: string,
  docTitle: string,
  chunk: string,
  lawReference: string
): Promise<ConflictItem[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: `You are a Taiwan labor law compliance expert. Compare company policy against Taiwan Labor Standards Act (勞動基準法) and identify violations.

CURRENT TAIWAN LABOR LAW (2026):
${lawReference}

CRITICAL COMPLIANCE RULES — READ CAREFULLY:

STEP 1 — IDENTIFY the legal minimum from the law reference above.
STEP 2 — IDENTIFY the company policy value from the document.
STEP 3 — COMPARE: company value vs legal minimum.

ARITHMETIC RULE (apply to ALL numeric comparisons):
  company value >= legal minimum → GREEN (compliant or better)
  company value < legal minimum → RED (violation)

This applies to ALL numeric fields:
  - Overtime multipliers: e.g. company=1.45x, law=1.34x → 1.45 >= 1.34 → GREEN
  - Overtime multipliers: e.g. company=1.30x, law=1.34x → 1.30 < 1.34 → RED
  - Leave days: e.g. company=10 days, law=7 days → 10 >= 7 → GREEN
  - Leave days: e.g. company=5 days, law=7 days → 5 < 7 → RED
  - Pay amounts: e.g. company=NT$32,000, law minimum=NT$29,500 → GREEN
  - Pay amounts: e.g. company=NT$28,000, law minimum=NT$29,500 → RED

IMPORTANT: Do not assume a number is wrong just because it differs from the legal minimum.
  A company paying MORE than required is compliant. A company paying LESS is a violation.
  Always do the comparison explicitly before assigning a severity.

YELLOW = policy wording is genuinely ambiguous, unclear, or missing — not a numeric violation.

Return JSON array only:
[{
  "severity": "red"|"yellow"|"green",
  "category": "overtime"|"leave"|"salary"|"working_hours"|"benefits"|"other",
  "handbook_text": "exact text from company document",
  "law_reference": "relevant law provision",
  "article": "LSA Art. XX",
  "issue_zh": "問題描述",
  "issue_en": "Issue description",
  "recommendation_zh": "建議修改",
  "recommendation_en": "Recommendation"
}]

Return [] if no violations found. Only flag genuine violations. Do not guess. JSON only, no markdown.`,
        },
        {
          role: "user",
          content: `Company Document: "${docTitle}"\n\n${chunk}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content || "[]";
    const clean = raw.replace(/```json|```/g, "").trim();
    const items = JSON.parse(clean);

    if (!Array.isArray(items)) return [];

    return items.map((item: any) => ({
      severity: item.severity || "yellow",
      category: item.category || "other",
      document_id: docId,
      document_title: docTitle,
      handbook_text: item.handbook_text || "",
      law_reference: item.law_reference || "",
      article: item.article || "",
      // ── Fix: Add law URL for each conflict ──
      law_url: getLawUrl(item.article || ""),
      issue_zh: item.issue_zh || "",
      issue_en: item.issue_en || "",
      recommendation_zh: item.recommendation_zh || "",
      recommendation_en: item.recommendation_en || "",
    }));
  } catch (err) {
    console.error("Chunk analysis error:", err);
    return [];
  }
}

function chunkText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";

  for (const para of paragraphs) {
    if ((current + para).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, maxChars)];
}