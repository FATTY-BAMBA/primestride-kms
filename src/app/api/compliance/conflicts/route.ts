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

// ══════════════════════════════════════════════════════════════
// POST /api/compliance/conflicts
// Scan company handbook documents against Taiwan labor law
// Returns conflict report with severity levels
// ══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getUserOrganization(userId);
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });

    const isAdmin = ["owner", "admin"].includes(org.role || "");
    if (!isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const body = await req.json();
    const { document_ids } = body; // Optional: scan specific docs, or all if empty

    const orgId = org.organization_id;

    // ── Step 1: Fetch company documents to scan ──
    let query = supabase
      .from("documents")
      .select("doc_id, title, content")
      .eq("organization_id", orgId);

    if (document_ids && document_ids.length > 0) {
      query = query.in("doc_id", document_ids);
    } else {
      // Auto-detect handbook/policy documents by tags or title
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
          message: "未找到公司手冊或政策文件。請上傳員工手冊後再試。No handbook or policy documents found. Please upload your employee handbook first.",
        },
      });
    }

    // ── Step 2: Fetch current Taiwan labor law rules ──
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

    // ── Step 3: Build law reference for GPT ──
    const lawReference = lawRules
      .map(r => `[${r.article_number || "Rule"}] ${r.title || ""}: ${r.content_zh || r.content}`)
      .join("\n");

    // ── Step 4: Analyze each document for conflicts ──
    const allConflicts: ConflictItem[] = [];

    for (const doc of docs) {
      if (!doc.content || doc.content.trim().length < 50) continue;

      // Chunk long documents (GPT context limit)
      const chunks = chunkText(doc.content, 3000);

      for (const chunk of chunks) {
        const conflicts = await analyzeChunk(doc.doc_id, doc.title, chunk, lawReference);
        allConflicts.push(...conflicts);
      }
    }

    // ── Step 5: Deduplicate and sort by severity ──
    const severityOrder: Record<string, number> = { red: 0, yellow: 1, green: 2 };
    allConflicts.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

    // ── Step 6: Save report ──
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

// ══════════════════════════════════════════════════════════════
// GET /api/compliance/conflicts
// Fetch latest conflict report for the organization
// ══════════════════════════════════════════════════════════════

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

    if (!report) {
      return NextResponse.json({ report: null, message: "No scan report found. Run a scan first." });
    }

    return NextResponse.json({ report });
  } catch {
    return NextResponse.json({ report: null });
  }
}

// ══════════════════════════════════════════════════════════════
// AI ANALYSIS
// ══════════════════════════════════════════════════════════════

interface ConflictItem {
  severity: "red" | "yellow" | "green";
  category: string;
  document_id: string;
  document_title: string;
  handbook_text: string;
  law_reference: string;
  article: string;
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
          content: `You are a Taiwan labor law compliance expert. Your task is to compare a company's internal policy document against current Taiwan Labor Standards Act (勞動基準法) rules and identify any conflicts, risks, or outdated provisions.

CURRENT TAIWAN LABOR LAW REFERENCE (2026):
${lawReference}

ADDITIONAL 2026 RULES TO CHECK:
- Minimum wage: NT$29,500/month, NT$196/hour (effective Jan 2026)
- Family care leave: 7 days = 56 hours, can be taken by hour, employer cannot refuse
- Attendance bonus: Must be prorated, not fully forfeited for minor leave
- Overtime: Max 46hr/month (can extend to 54hr with union agreement)
- Annual leave: 6mo=3d, 1yr=7d, 2yr=10d, 3yr=14d, 5yr=15d, 10yr+=1d/yr up to 30d
- Marriage leave: 8 days
- Maternity leave: 56 days (8 weeks), full pay if employed 6mo+
- Paternity leave: 7 days
- Sick leave: 30 days/year at half pay

SOURCE OF TRUTH HIERARCHY:
1. If company policy is MORE generous than law → GREEN (compliant, company exceeds minimum)
2. If company policy MATCHES law → GREEN (compliant)
3. If company policy is LESS generous than law → RED (violation, must fix)
4. If company policy is ambiguous or outdated → YELLOW (needs review)
5. If company policy addresses something law doesn't cover → GREEN (additional benefit)

For each conflict found, respond with a JSON array of objects:
[{
  "severity": "red"|"yellow"|"green",
  "category": "overtime"|"leave"|"salary"|"working_hours"|"benefits"|"other",
  "handbook_text": "the exact or paraphrased text from the company document",
  "law_reference": "the relevant law provision",
  "article": "LSA Art. XX or rule name",
  "issue_zh": "問題描述（中文）",
  "issue_en": "Issue description in English",
  "recommendation_zh": "建議修改方式（中文）",
  "recommendation_en": "Recommended fix in English"
}]

If no conflicts found, return an empty array [].
Only return conflicts you are CONFIDENT about. Do not guess.
Respond with JSON array ONLY, no markdown, no explanation.`,
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

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

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
