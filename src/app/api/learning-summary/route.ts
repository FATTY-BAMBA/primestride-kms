// /src/app/api/learning-summary/route.ts

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

interface Document {
  doc_id: string;
  title: string;
  current_version: string;
  status: string;
  google_doc_url: string | null;
  source_url: string | null;
  doc_type: string | null;
  domain: string | null;
  tags: string[] | null;
}

interface FeedbackEvent {
  doc_id: string;
  version: string;
  value: string;
}

export async function GET() {
  try {
    // Pull documents with taxonomy fields
    const { data: docs, error: docsErr } = await supabase
      .from("documents")
      .select(
        "doc_id,title,current_version,status,google_doc_url,source_url,doc_type,domain,tags"
      );

    // 🔍 DEBUG LOGS (remove later)
    console.log("ROUTE: /api/learning-summary");
    console.log("DOCS LENGTH:", docs?.length);
    console.log("DOC IDS:", (docs ?? []).map((d: any) => d.doc_id));
    console.log("DOCS ERR:", docsErr);

    if (docsErr) {
      return NextResponse.json(
        { error: docsErr.message },
        {
          status: 500,
          headers: { "Cache-Control": "no-store, max-age=0" },
        }
      );
    }

    // Pull feedback events only
    const { data: feedback, error: fbErr } = await supabase
      .from("events")
      .select("doc_id,version,value")
      .eq("event_type", "feedback");

    if (fbErr) {
      return NextResponse.json(
        { error: fbErr.message },
        {
          status: 500,
          headers: { "Cache-Control": "no-store, max-age=0" },
        }
      );
    }

    // Aggregate counts by doc_id + version + value
    const counts: Record<string, Record<string, Record<string, number>>> = {};
    for (const e of (feedback ?? []) as FeedbackEvent[]) {
      const docId = e.doc_id;
      const ver = e.version;
      const val = e.value || "unknown";
      counts[docId] ??= {};
      counts[docId][ver] ??= {};
      counts[docId][ver][val] = (counts[docId][ver][val] ?? 0) + 1;
    }

    // Merge counts with docs (show only current_version counts)
    const enriched = ((docs ?? []) as Document[]).map((d) => {
      const docCounts = counts[d.doc_id]?.[d.current_version] ?? {};
      return {
        ...d,
        feedback_counts: {
          helped: docCounts["helped"] ?? 0,
          not_confident: docCounts["not_confident"] ?? 0,
          didnt_help: docCounts["didnt_help"] ?? 0,
        },
      };
    });

    return NextResponse.json(
      { documents: enriched },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
