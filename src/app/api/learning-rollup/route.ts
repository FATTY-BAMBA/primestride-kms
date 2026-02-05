export const dynamic = "force-dynamic";
export const revalidate = 0;

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type EventRow = {
  doc_id: string;
  version: string;
  event_type: "view" | "open" | "reopen" | "feedback";
  value: "helped" | "not_confident" | "didnt_help" | null;
  notes: string | null;
};

interface DocRecord {
  doc_id: string;
  title: string;
  current_version: string;
  status: string;
  file_url: string | null;
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

    // 2) Pull events for these docs
    const { data: events, error: evErr } = await supabase
      .from("events")
      .select("doc_id,version,event_type,value,notes")
      .in("doc_id", docIds);

    if (evErr) {
      return NextResponse.json({ error: evErr.message }, { status: 500 });
    }

    const rows = (events ?? []) as EventRow[];

    // 3) Build rollups per doc for current version only
    const rollups = docRecords.map((doc) => {
      const ver = doc.current_version;

      const docEvents = rows.filter(
        (r) => r.doc_id === doc.doc_id && r.version === ver
      );

      const counts = {
        view: 0,
        open: 0,
        reopen: 0,
        feedback: {
          helped: 0,
          not_confident: 0,
          didnt_help: 0,
        },
      };

      const confusionNotes: string[] = [];

      for (const r of docEvents) {
        if (r.event_type === "view") counts.view += 1;
        if (r.event_type === "open") counts.open += 1;
        if (r.event_type === "reopen") counts.reopen += 1;

        if (r.event_type === "feedback") {
          if (r.value === "helped") counts.feedback.helped += 1;
          if (r.value === "not_confident") counts.feedback.not_confident += 1;
          if (r.value === "didnt_help") counts.feedback.didnt_help += 1;

          if ((r.value === "not_confident" || r.value === "didnt_help") && r.notes) {
            const trimmed = r.notes.trim();
            if (trimmed.length > 0) confusionNotes.push(trimmed);
          }
        }
      }

      const ambiguityScore = counts.feedback.not_confident + 2 * counts.feedback.didnt_help;
      const topNotes = confusionNotes.slice(0, 5);

      return {
        doc_id: doc.doc_id,
        title: doc.title,
        version: ver,
        status: doc.status,
        file_url: doc.file_url,
        counts,
        ambiguityScore,
        topNotes,
      };
    });

    // 4) Sort by ambiguity score descending
    rollups.sort((a, b) => b.ambiguityScore - a.ambiguityScore);

    // 5) Global summary
    const summary = rollups.reduce(
      (acc, d) => {
        acc.totalDocs += 1;
        acc.views += d.counts.view;
        acc.opens += d.counts.open;
        acc.reopens += d.counts.reopen;
        acc.helped += d.counts.feedback.helped;
        acc.not_confident += d.counts.feedback.not_confident;
        acc.didnt_help += d.counts.feedback.didnt_help;
        return acc;
      },
      {
        totalDocs: 0,
        views: 0,
        opens: 0,
        reopens: 0,
        helped: 0,
        not_confident: 0,
        didnt_help: 0,
      }
    );

    return NextResponse.json({ summary, documents: rollups });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}