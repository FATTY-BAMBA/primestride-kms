import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

interface DocRecord {
  current_version: string;
}

interface VersionRecord {
  doc_id: string;
  version: string;
  content_snapshot: string | null;
  content_format: string | null;
  created_at: string;
  change_summary: string | null;
  hypothesis: string | null;
}

export async function GET(req: Request) {
  const adminToken = process.env.ADMIN_TOKEN;
  const headerToken = req.headers.get("x-admin-token");
  if (!adminToken || headerToken !== adminToken) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const doc_id = searchParams.get("doc_id");
    const version = searchParams.get("version");

    if (!doc_id) {
      return NextResponse.json({ error: "doc_id is required." }, { status: 400 });
    }

    // If version not provided, default to current version
    let targetVersion = version;
    if (!targetVersion) {
      const { data: doc, error: docErr } = await supabase
        .from("documents")
        .select("current_version")
        .eq("doc_id", doc_id)
        .single();

      if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });
      if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

      const docRecord = doc as DocRecord;
      targetVersion = docRecord.current_version;
    }

    const { data, error } = await supabase
      .from("doc_versions")
      .select("doc_id,version,content_snapshot,content_format,created_at,change_summary,hypothesis")
      .eq("doc_id", doc_id)
      .eq("version", targetVersion)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Snapshot not found for that version." }, { status: 404 });

    const versionRecord = data as VersionRecord;

    return NextResponse.json({
      doc_id: versionRecord.doc_id,
      version: versionRecord.version,
      content_snapshot: versionRecord.content_snapshot ?? "",
      content_format: versionRecord.content_format ?? "markdown",
      created_at: versionRecord.created_at,
      change_summary: versionRecord.change_summary,
      hypothesis: versionRecord.hypothesis,
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}