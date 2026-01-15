import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: Request) {
  const adminToken = process.env.ADMIN_TOKEN;
  const headerToken = req.headers.get("x-admin-token");
  if (!adminToken || headerToken !== adminToken) return unauthorized();

  try {
    const body = await req.json();
    const {
      doc_id,
      new_version,
      change_summary,
      hypothesis,
      content_snapshot,
      content_format,
      observed_signal,
      decision,
      review_owner_email,
      review_date,
    } = body;

    // Required fields
    if (!doc_id || !new_version) {
      return NextResponse.json({ error: "doc_id and new_version are required." }, { status: 400 });
    }
    if (!content_snapshot || String(content_snapshot).trim().length < 50) {
      return NextResponse.json(
        { error: "content_snapshot is required (min ~50 chars)." },
        { status: 400 }
      );
    }
    if (!observed_signal || !decision || !hypothesis) {
      return NextResponse.json(
        { error: "observed_signal, decision, and hypothesis are required (learning discipline)." },
        { status: 400 }
      );
    }

    // Get current version (from_version)
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("doc_id,current_version")
      .eq("doc_id", doc_id)
      .single();

    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });
    if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const from_version = (doc as { doc_id: string; current_version: string }).current_version;

    if (from_version === new_version) {
      return NextResponse.json(
        { error: "new_version must be different from current_version." },
        { status: 400 }
      );
    }

    // 1) Insert new version truth
    const { error: insVerErr } = await supabase.from("doc_versions").insert([
      {
        doc_id,
        version: new_version,
        change_summary: change_summary ?? null,
        hypothesis: hypothesis ?? null,
        content_snapshot,
        content_format: content_format ?? "markdown",
      },
    ]);

    if (insVerErr) return NextResponse.json({ error: insVerErr.message }, { status: 500 });

    // 2) Update pointer
    const { error: updErr } = await supabase
      .from("documents")
      .update({ current_version: new_version })
      .eq("doc_id", doc_id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    // 3) Log learning review
    const { error: insRevErr } = await supabase.from("learning_reviews").insert([
      {
        doc_id,
        from_version,
        to_version: new_version,
        observed_signal,
        decision,
        hypothesis,
        owner_email: review_owner_email ?? null,
        review_date: review_date ?? null,
      },
    ]);

    if (insRevErr) return NextResponse.json({ error: insRevErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      doc_id,
      from_version,
      to_version: new_version,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}