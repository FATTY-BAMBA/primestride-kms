// /src/app/api/learning-summary/route.ts

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Document {
  doc_id: string;
  title: string;
  current_version: string;
  status: string;
  doc_type: string | null;
  domain: string | null;
  tags: string[] | null;
  file_url: string | null;
  file_name: string | null;
  organization_id: string;
}

interface FeedbackRow {
  doc_id: string;
  is_helpful: boolean;
}

export async function GET() {
  try {
    // Get user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // Get user's organization
    const { data: membership, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (memberError || !membership) {
      return NextResponse.json(
        { documents: [] },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // Pull documents for user's organization
    const { data: docs, error: docsErr } = await supabase
      .from("documents")
      .select("doc_id,title,current_version,status,doc_type,domain,tags,file_url,file_name,organization_id")
      .eq("organization_id", membership.organization_id);

    console.log("ROUTE: /api/learning-summary");
    console.log("USER:", userId);
    console.log("ORG:", membership.organization_id);
    console.log("DOCS LENGTH:", docs?.length);
    console.log("DOCS ERR:", docsErr);

    if (docsErr) {
      return NextResponse.json(
        { error: docsErr.message },
        { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // Pull feedback for these documents
    const docIds = (docs ?? []).map((d: Document) => d.doc_id);
    
    let feedbackCounts: Record<string, { helpful: number; not_helpful: number }> = {};
    
    if (docIds.length > 0) {
      const { data: feedback, error: fbErr } = await supabase
        .from("feedback")
        .select("doc_id,is_helpful")
        .in("doc_id", docIds);

      if (!fbErr && feedback) {
        // Aggregate feedback counts
        for (const f of feedback as FeedbackRow[]) {
          if (!feedbackCounts[f.doc_id]) {
            feedbackCounts[f.doc_id] = { helpful: 0, not_helpful: 0 };
          }
          if (f.is_helpful) {
            feedbackCounts[f.doc_id].helpful++;
          } else {
            feedbackCounts[f.doc_id].not_helpful++;
          }
        }
      }
    }

    // Merge counts with docs
    const enriched = ((docs ?? []) as Document[]).map((d) => {
      const counts = feedbackCounts[d.doc_id] ?? { helpful: 0, not_helpful: 0 };
      return {
        doc_id: d.doc_id,
        title: d.title,
        current_version: d.current_version,
        status: d.status,
        doc_type: d.doc_type,
        domain: d.domain,
        tags: d.tags,
        file_url: d.file_url,
        feedback_counts: {
          helped: counts.helpful,
          not_confident: 0, // Legacy field
          didnt_help: counts.not_helpful,
        },
      };
    });

    return NextResponse.json(
      { documents: enriched },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("Learning summary error:", e);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}