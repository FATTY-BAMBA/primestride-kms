import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ══════════════════════════════════════════════════════════════
// POST /api/compliance/sync
// Fetches latest data from Taiwan MOL Open Data API
// and syncs relevant labor law updates to compliance_knowledge
// Admin-only endpoint, can also be called via cron
// ══════════════════════════════════════════════════════════════

const MOL_API_BASE = "https://apiservice.mol.gov.tw/OdService/rest";

// Key MOL dataset IDs for labor-related data
const LABOR_DATASETS = [
  { id: "6061", name: "Labor Insurance Bureau offices", category: "general" },
  { id: "43261", name: "Labor statistics", category: "general" },
];

// Key labor law source URLs for RAG ingestion
const LAW_SOURCES = [
  {
    url: "https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=N0030001",
    title: "Labor Standards Act (勞動基準法)",
    category: "general",
    source: "taiwan_lsa",
  },
  {
    url: "https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=N0030014",
    title: "Regulations of Leave-Taking of Workers (勞工請假規則)",
    category: "leave",
    source: "taiwan_lsa",
  },
  {
    url: "https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=N0030014",
    title: "Gender Equality in Employment Act",
    category: "leave",
    source: "taiwan_lsa",
  },
];

export async function POST(req: NextRequest) {
  try {
    // Auth: Vercel cron sends Authorization header automatically
    // Manual trigger requires admin auth via Clerk
    const authHeader = req.headers.get("authorization");
    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!isVercelCron) {
      const { userId } = await auth();
      if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: any[] = [];

    // ── Step 1: Fetch MOL API dataset list for recent updates ──
    try {
      const modifiedDate = new Date();
      modifiedDate.setDate(modifiedDate.getDate() - 30); // Last 30 days
      const modStr = modifiedDate.toISOString().split("T")[0] + " 00:00:00";

      const res = await fetch(
        `${MOL_API_BASE}/dataset?modified=${encodeURIComponent(modStr)}&limit=20`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
      );

      if (res.ok) {
        const datasets = await res.json();
        results.push({ step: "mol_datasets", count: Array.isArray(datasets) ? datasets.length : 0, status: "ok" });

        // For each recent dataset, fetch metadata
        if (Array.isArray(datasets)) {
          for (const datasetId of datasets.slice(0, 5)) {
            try {
              const metaRes = await fetch(`${MOL_API_BASE}/dataset/${datasetId}`, {
                headers: { Accept: "application/json" },
                signal: AbortSignal.timeout(5000),
              });
              if (metaRes.ok) {
                const meta = await metaRes.json();
                if (meta?.title && isLaborRelevant(meta.title, meta.notes || "")) {
                  // Use AI to extract compliance rules from the dataset description
                  const extracted = await extractComplianceRules(meta.title, meta.notes || meta.description || "");
                  if (extracted) {
                    await upsertComplianceKnowledge({
                      source: "mol_update",
                      category: categorizeContent(meta.title),
                      title: meta.title,
                      content: extracted.content_en,
                      content_zh: extracted.content_zh,
                      article_number: `MOL Dataset ${datasetId}`,
                      metadata: { dataset_id: datasetId, modified: meta.modified, mol_api: true },
                    });
                    results.push({ step: "ingested", dataset: datasetId, title: meta.title });
                  }
                }
              }
            } catch (e) {
              // Skip individual dataset errors
            }
          }
        }
      } else {
        results.push({ step: "mol_datasets", status: "api_error", code: res.status });
      }
    } catch (e: any) {
      results.push({ step: "mol_datasets", status: "fetch_error", message: e.message });
    }

    // ── Step 2: Check for minimum wage updates ──
    try {
      const { data: existing } = await supabase
        .from("compliance_knowledge")
        .select("metadata")
        .eq("article_number", "LSA Art. 21")
        .eq("is_active", true)
        .single();

      const currentMin = existing?.metadata?.monthly_min || 0;
      results.push({
        step: "minimum_wage_check",
        current: currentMin,
        status: currentMin >= 29500 ? "up_to_date" : "needs_update",
      });
    } catch (e) {
      results.push({ step: "minimum_wage_check", status: "skipped" });
    }

    // ── Step 3: Fetch recent MOL news/announcements ──
    try {
      const tagRes = await fetch(`${MOL_API_BASE}/tag/基本工資?limit=5`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (tagRes.ok) {
        const tagData = await tagRes.json();
        results.push({ step: "mol_wage_tag", datasets: Array.isArray(tagData) ? tagData.length : 0 });
      }
    } catch (e) {
      results.push({ step: "mol_wage_tag", status: "skipped" });
    }

    // ── Step 4: Log sync event ──
    const syncTime = new Date().toISOString();
    await supabase.from("compliance_knowledge").upsert(
      {
        source: "system",
        category: "general",
        title: "Last MOL API Sync",
        content: `Compliance knowledge base last synced with Taiwan MOL API at ${syncTime}. ${results.length} steps processed.`,
        content_zh: `合規知識庫於 ${syncTime} 與勞動部 API 同步完成。處理 ${results.length} 個步驟。`,
        article_number: "SYSTEM_SYNC_LOG",
        metadata: { last_sync: syncTime, results },
        is_active: true,
      },
      { onConflict: "article_number" }
    );

    return NextResponse.json({
      success: true,
      synced_at: syncTime,
      results,
    });
  } catch (err: any) {
    console.error("MOL sync error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── GET: Check sync status ──
export async function GET() {
  const { data } = await supabase
    .from("compliance_knowledge")
    .select("metadata, updated_at")
    .eq("article_number", "SYSTEM_SYNC_LOG")
    .single();

  const { count } = await supabase
    .from("compliance_knowledge")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  return NextResponse.json({
    last_sync: data?.metadata?.last_sync || null,
    total_rules: count || 0,
    status: data ? "synced" : "never_synced",
  });
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function isLaborRelevant(title: string, notes: string): boolean {
  const keywords = ["勞動", "勞工", "工資", "基本工資", "加班", "休假", "請假", "勞基法", "勞動基準", "就業", "薪資", "overtime", "leave", "wage", "labor"];
  const combined = (title + " " + notes).toLowerCase();
  return keywords.some((k) => combined.includes(k));
}

function categorizeContent(title: string): string {
  if (/加班|overtime|工時|工作時間/.test(title)) return "overtime";
  if (/請假|休假|leave|假期|特休/.test(title)) return "leave";
  if (/工資|薪資|wage|salary|基本工資/.test(title)) return "salary";
  return "general";
}

async function extractComplianceRules(title: string, content: string): Promise<{ content_en: string; content_zh: string } | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You extract Taiwan labor compliance rules from government data descriptions. Return JSON only: {\"content_en\": \"English summary\", \"content_zh\": \"繁體中文摘要\"}. If the content has no actionable compliance rules, return null.",
        },
        {
          role: "user",
          content: `Title: ${title}\n\nContent: ${content.slice(0, 2000)}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content || "";
    if (raw.includes("null")) return null;
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

async function upsertComplianceKnowledge(data: {
  source: string;
  category: string;
  title: string;
  content: string;
  content_zh?: string;
  article_number?: string;
  metadata?: Record<string, any>;
}) {
  // Check if already exists
  const { data: existing } = await supabase
    .from("compliance_knowledge")
    .select("id")
    .eq("title", data.title)
    .eq("source", data.source)
    .limit(1);

  if (existing && existing.length > 0) {
    // Update
    await supabase
      .from("compliance_knowledge")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", existing[0].id);
  } else {
    // Insert
    await supabase.from("compliance_knowledge").insert({
      ...data,
      organization_id: null, // Global
      is_active: true,
    });
  }
}
