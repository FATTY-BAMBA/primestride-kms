import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

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
}

interface VersionRecord {
  version: string;
  change_summary: string | null;
  hypothesis: string | null;
  created_at: string;
}

export async function GET(req: Request) {
  const adminToken = process.env.ADMIN_TOKEN;
  const headerToken = req.headers.get("x-admin-token");
  if (!adminToken || headerToken !== adminToken) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const doc_id = searchParams.get("doc_id");

    if (!doc_id) {
      return NextResponse.json({ error: "doc_id is required." }, { status: 400 });
    }

    // 1) Get doc + current version
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("doc_id,title,current_version,status")
      .eq("doc_id", doc_id)
      .single();

    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });
    if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const docRecord = doc as DocRecord;

    // 2) Get version history for this doc (sorted newest first)
    const { data: versions, error: verErr } = await supabase
      .from("doc_versions")
      .select("version,change_summary,hypothesis,created_at")
      .eq("doc_id", doc_id)
      .order("created_at", { ascending: false });

    if (verErr) return NextResponse.json({ error: verErr.message }, { status: 500 });

    const versionRecords = (versions ?? []) as VersionRecord[];

    // Identify current + previous
    const currentVersion = docRecord.current_version;

    // Previous is the next most recent version not equal to current
    const prevVersion =
      versionRecords.find((v) => v.version !== currentVersion)?.version ?? null;

    // 3) Pull events for this doc (all versions)
    const { data: events, error: evErr } = await supabase
      .from("events")
      .select("doc_id,version,event_type,value,notes")
      .eq("doc_id", doc_id);

    if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });

    const rows = (events ?? []) as EventRow[];

    // Helper to aggregate per version
    const summarizeVersion = (version: string | null) => {
      if (!version) return null;

      const evs = rows.filter((r) => r.version === version);

      const out = {
        version,
        counts: {
          view: 0,
          open: 0,
          reopen: 0,
          feedback: {
            helped: 0,
            not_confident: 0,
            didnt_help: 0,
          },
        },
        topConfusionNotes: [] as string[],
      };

      const confusion: string[] = [];

      for (const r of evs) {
        if (r.event_type === "view") out.counts.view += 1;
        if (r.event_type === "open") out.counts.open += 1;
        if (r.event_type === "reopen") out.counts.reopen += 1;

        if (r.event_type === "feedback") {
          if (r.value === "helped") out.counts.feedback.helped += 1;
          if (r.value === "not_confident") out.counts.feedback.not_confident += 1;
          if (r.value === "didnt_help") out.counts.feedback.didnt_help += 1;

          if ((r.value === "not_confident" || r.value === "didnt_help") && r.notes) {
            const t = r.notes.trim();
            if (t) confusion.push(t);
          }
        }
      }

      out.topConfusionNotes = confusion.slice(0, 7);
      return out;
    };

    const current = summarizeVersion(currentVersion);
    const previous = summarizeVersion(prevVersion);

    // 4) Compute deltas (current - previous) for feedback counts
    const delta =
      current && previous
        ? {
            helped: current.counts.feedback.helped - previous.counts.feedback.helped,
            not_confident:
              current.counts.feedback.not_confident - previous.counts.feedback.not_confident,
            didnt_help: current.counts.feedback.didnt_help - previous.counts.feedback.didnt_help,
            open: current.counts.open - previous.counts.open,
            reopen: current.counts.reopen - previous.counts.reopen,
            view: current.counts.view - previous.counts.view,
          }
        : null;

    // 5) Attach metadata about current version's change/hypothesis
    const currentMeta = versionRecords.find((v) => v.version === currentVersion) ?? null;
    const previousMeta = prevVersion
      ? versionRecords.find((v) => v.version === prevVersion) ?? null
      : null;

    return NextResponse.json({
      doc: {
        doc_id: docRecord.doc_id,
        title: docRecord.title,
        status: docRecord.status,
      },
      currentVersion,
      previousVersion: prevVersion,
      currentMeta,
      previousMeta,
      current,
      previous,
      delta,
      versions: versionRecords.map((v) => ({
        version: v.version,
        created_at: v.created_at,
        change_summary: v.change_summary,
        hypothesis: v.hypothesis,
      })),
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}