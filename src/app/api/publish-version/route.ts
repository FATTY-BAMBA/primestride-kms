import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

interface DocRecord {
  doc_id: string;
  current_version: string;
}

export async function POST(req: Request) {
  try {
    const adminToken = process.env.ADMIN_TOKEN;
    const headerToken = req.headers.get("x-admin-token");

    if (!adminToken || headerToken !== adminToken) return unauthorized();

    const body = await req.json();
    const {
      doc_id,
      new_version,
      change_summary,
      hypothesis,
      content_snapshot,
      content_format,
    }: {
      doc_id: string;
      new_version: string;
      change_summary?: string;
      hypothesis?: string;
      content_snapshot?: string;
      content_format?: string;
    } = body;

    if (!doc_id || !new_version) {
      return NextResponse.json(
        { error: "doc_id and new_version are required." },
        { status: 400 }
      );
    }

    // Validate content snapshot (required for new versions)
    if (!content_snapshot || String(content_snapshot).trim().length < 50) {
      return NextResponse.json(
        { error: "content_snapshot is required (min ~50 chars). Paste the doc content for this version." },
        { status: 400 }
      );
    }

    // 1) Ensure document exists
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("doc_id,current_version")
      .eq("doc_id", doc_id)
      .single();

    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });
    if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const docRecord = doc as DocRecord;

    // Basic guard: prevent publishing same version
    if (docRecord.current_version === new_version) {
      return NextResponse.json(
        { error: "new_version must be different from current_version." },
        { status: 400 }
      );
    }

    // 2) Insert into doc_versions (history) with content snapshot
    const { error: insErr } = await supabase.from("doc_versions").insert([
      {
        doc_id,
        version: new_version,
        change_summary: change_summary ?? null,
        hypothesis: hypothesis ?? null,
        content_snapshot: content_snapshot,
        content_format: content_format ?? "markdown",
      },
    ]);

    if (insErr) {
      // Unique constraint might trip if (doc_id, version) already exists
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // 3) Update documents.current_version
    const { error: updErr } = await supabase
      .from("documents")
      .update({ current_version: new_version })
      .eq("doc_id", doc_id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      doc_id,
      from_version: docRecord.current_version,
      to_version: new_version,
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}