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

// ── Article → law.moj.gov.tw URL mapping ──────────────────────────────────
const LAW_URLS: Record<string, string> = {
  "LSA Art. 21":  "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=21",
  "LSA Art. 24":  "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=24",
  "LSA Art. 24-2":"https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=24-2",
  "LSA Art. 30":  "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=30",
  "LSA Art. 32":  "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=32",
  "LSA Art. 36":  "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=36",
  "LSA Art. 38":  "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=38",
  "LSA Art. 50":  "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=50",
  "Gender Equality Employment Act Art. 15": "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030014&flno=15",
  "Labor Leave Rules Art. 2": "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030008&flno=2",
  "Labor Leave Rules Art. 7": "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030008&flno=7",
};

function getLawUrl(article: string): string {
  if (LAW_URLS[article]) return LAW_URLS[article];
  for (const [key, url] of Object.entries(LAW_URLS)) {
    if (article.startsWith(key)) return url;
  }
  return "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030001";
}

// ── Build a clean numeric reference string from compliance_rules ───────────
function buildNumericReference(rules: ComplianceRule[]): string {
  // Group by article for readability
  const grouped: Record<string, ComplianceRule[]> = {};
  for (const r of rules) {
    if (!grouped[r.article_number]) grouped[r.article_number] = [];
    grouped[r.article_number].push(r);
  }

  return Object.entries(grouped)
    .map(([article, items]) => {
      const lines = items.map(r => {
        const comparisonLabel =
          r.comparison === "gte" ? "最低值（公司值需 >= 此值才合規）" :
          r.comparison === "lte" ? "上限值（公司值需 <= 此值才合規）" :
          "精確值（公司值需 = 此值）";
        return `  - ${r.description_zh}: ${r.minimum_value ?? r.maximum_value} ${r.unit} [${comparisonLabel}]`;
      });
      return `[${article}]\n${lines.join("\n")}`;
    })
    .join("\n\n");
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

    // ── Fetch documents ──────────────────────────────────────────────────────
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

    // ── Fetch structured numeric rules (PRIMARY source for AI comparisons) ──
    const { data: structuredRules } = await supabase
      .from("compliance_rules")
      .select("article_number, field, minimum_value, maximum_value, unit, comparison, description_zh")
      .eq("is_active", true)
      .order("article_number");

    // ── Fetch full-text law context (SECONDARY — for context only) ──────────
    const { data: lawRules } = await supabase
      .from("compliance_knowledge")
      .select("article_number, title, content_zh")
      .eq("is_active", true)
      .order("article_number");

    if (!structuredRules || structuredRules.length === 0) {
      return NextResponse.json({
        conflicts: [],
        summary: {
          total_scanned: docs.length,
          message: "No structured compliance rules found. Run the compliance_rules migration first.",
        },
      });
    }

    // Build the two reference strings
    const numericReference = buildNumericReference(structuredRules as ComplianceRule[]);
    const textContext = lawRules
      ? lawRules.map(r => `[${r.article_number}] ${r.title}: ${r.content_zh}`).join("\n")
      : "";

    const allConflicts: ConflictItem[] = [];

    for (const doc of docs) {
      if (!doc.content || doc.content.trim().length < 50) continue;
      const chunks = chunkText(doc.content, 3000);
      for (const chunk of chunks) {
        const conflicts = await analyzeChunk(
          doc.doc_id,
          doc.title,
          chunk,
          numericReference,
          textContext
        );
        allConflicts.push(...conflicts);
      }
    }

    const severityOrder: Record<string, number> = { red: 0, yellow: 1, green: 2 };
    allConflicts.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

    const reportId = crypto.randomUUID();
    await supabase.from("compliance_reports").upsert(
      {
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
      },
      { onConflict: "id" }
    );

    return NextResponse.json({
      report_id: reportId,
      conflicts: allConflicts,
      summary: {
        total_scanned: docs.length,
        documents: docs.map(d => ({ id: d.doc_id, title: d.title })),
        total_conflicts: allConflicts.length,
        red:    allConflicts.filter(c => c.severity === "red").length,
        yellow: allConflicts.filter(c => c.severity === "yellow").length,
        green:  allConflicts.filter(c => c.severity === "green").length,
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

// ── Types ─────────────────────────────────────────────────────────────────
interface ComplianceRule {
  article_number: string;
  field: string;
  minimum_value: number | null;
  maximum_value: number | null;
  unit: string;
  comparison: string;
  description_zh: string;
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

// ── Core analysis function ─────────────────────────────────────────────────
async function analyzeChunk(
  docId: string,
  docTitle: string,
  chunk: string,
  numericReference: string,
  textContext: string
): Promise<ConflictItem[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: `You are a Taiwan labor law compliance expert. Compare company policy text against Taiwan Labor Standards Act (勞動基準法) thresholds and identify violations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION A — NUMERIC THRESHOLDS (authoritative)
Use these exact values for all numeric comparisons. Do not interpret fractions.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${numericReference}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION B — LAW CONTEXT (background only)
For understanding intent. Do NOT use for numeric comparisons — use Section A instead.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${textContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO EVALUATE EACH CLAUSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For every numeric value found in the company document:

  STEP 1 — Find the matching threshold in Section A.
  STEP 2 — Extract the company value as a number.
  STEP 3 — Apply the comparison rule:
    • "gte" rule → company value >= threshold → GREEN; company value < threshold → RED
    • "lte" rule → company value <= threshold → GREEN; company value > threshold → RED

Examples (do not skip this logic):
  Company pays 1.34x overtime for first 2hrs, threshold = 1.34x (gte) → 1.34 >= 1.34 → GREEN ✓
  Company pays 1.30x overtime for first 2hrs, threshold = 1.34x (gte) → 1.30 < 1.34  → RED ✗
  Company allows 60hrs/month overtime, threshold = 54hrs (lte)        → 60 > 54       → RED ✗
  Company gives 10 days annual leave at 2yrs, threshold = 10 days (gte) → 10 >= 10   → GREEN ✓

YELLOW = policy wording is ambiguous, unclear, or missing — not a numeric violation.
GREEN  = compliant or better than required.
RED    = genuine violation where company value is worse than the legal minimum.

Only flag genuine violations. Do not guess. If no violation exists, return [].

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT — JSON array only, no markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[{
  "severity": "red"|"yellow"|"green",
  "category": "overtime"|"leave"|"salary"|"working_hours"|"benefits"|"other",
  "handbook_text": "exact text excerpt from company document",
  "law_reference": "relevant law provision summary",
  "article": "LSA Art. XX",
  "issue_zh": "問題描述（繁體中文）",
  "issue_en": "Issue description in English",
  "recommendation_zh": "建議修改（繁體中文）",
  "recommendation_en": "Recommendation in English"
}]`,
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
      severity:           item.severity || "yellow",
      category:           item.category || "other",
      document_id:        docId,
      document_title:     docTitle,
      handbook_text:      item.handbook_text || "",
      law_reference:      item.law_reference || "",
      article:            item.article || "",
      law_url:            getLawUrl(item.article || ""),
      issue_zh:           item.issue_zh || "",
      issue_en:           item.issue_en || "",
      recommendation_zh:  item.recommendation_zh || "",
      recommendation_en:  item.recommendation_en || "",
    }));
  } catch (err) {
    console.error("Chunk analysis error:", err);
    return [];
  }
}

// ── Chunk document into overlapping segments ───────────────────────────────
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