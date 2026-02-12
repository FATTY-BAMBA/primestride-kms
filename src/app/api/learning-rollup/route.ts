export const dynamic = "force-dynamic";
export const revalidate = 0;

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

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
}

interface FeedbackRow {
  id: string;
  doc_id: string;
  user_id: string;
  is_helpful: boolean;
  comment: string | null;
  created_at: string;
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
      return NextResponse.json({ summary: null, documents: [] });
    }

    // 1) Load documents scoped to organization
    const { data: docs, error: docsErr } = await supabase
      .from("documents")
      .select("doc_id,title,current_version,status,file_url")
      .eq("organization_id", membership.organization_id);

    if (docsErr) {
      return NextResponse.json({ error: docsErr.message }, { status: 500 });
    }

    const docRecords = (docs ?? []) as DocRecord[];
    const docIds = docRecords.map((d) => d.doc_id);

    if (docIds.length === 0) {
      return NextResponse.json({ summary: null, documents: [] });
    }

    // 2) Pull feedback for these docs
    const { data: feedbackData, error: fbErr } = await supabase
      .from("feedback")
      .select("id,doc_id,user_id,is_helpful,comment,created_at")
      .eq("organization_id", membership.organization_id)
      .in("doc_id", docIds);

    if (fbErr) {
      return NextResponse.json({ error: fbErr.message }, { status: 500 });
    }

    const feedback = (feedbackData ?? []) as FeedbackRow[];

    // 3) Build rollups per doc
    const rollups = docRecords.map((doc) => {
      const docFeedback = feedback.filter((f) => f.doc_id === doc.doc_id);

      const helpful = docFeedback.filter((f) => f.is_helpful === true).length;
      const notHelpful = docFeedback.filter((f) => f.is_helpful === false).length;
      const totalFeedback = docFeedback.length;

      // Collect comments from negative feedback
      const negativeComments = docFeedback
        .filter((f) => !f.is_helpful && f.comment && f.comment.trim().length > 0)
        .map((f) => f.comment!.trim())
        .slice(0, 5);

      // Ambiguity score: higher = needs more improvement
      const ambiguityScore = notHelpful * 2;

      // Helpfulness rate
      const helpfulnessRate = totalFeedback > 0
        ? Math.round((helpful / totalFeedback) * 100)
        : null;

      return {
        doc_id: doc.doc_id,
        title: doc.title,
        version: doc.current_version,
        status: doc.status,
        file_url: doc.file_url,
        counts: {
          totalFeedback,
          helpful,
          notHelpful,
        },
        helpfulnessRate,
        ambiguityScore,
        topNotes: negativeComments,
      };
    });

    // 4) Sort by ambiguity score descending (worst docs first)
    rollups.sort((a, b) => b.ambiguityScore - a.ambiguityScore);

    // 5) Global summary
    const summary = rollups.reduce(
      (acc, d) => {
        acc.totalDocs += 1;
        acc.totalFeedback += d.counts.totalFeedback;
        acc.helpful += d.counts.helpful;
        acc.notHelpful += d.counts.notHelpful;
        return acc;
      },
      {
        totalDocs: 0,
        totalFeedback: 0,
        helpful: 0,
        notHelpful: 0,
      }
    );

    return NextResponse.json({ summary, documents: rollups });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}