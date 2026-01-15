import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      event_type,
      user_email,
      query,
      filters,
      results_count,
      clicked_doc_id,
      clicked_version,
      clicked_section_title,
      clicked_section_path,
      clicked_rank,
    } = body;

    if (!event_type || !["search", "search_click"].includes(event_type)) {
      return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
    }

    const doc_id = event_type === "search_click" ? clicked_doc_id : null;
    const version = event_type === "search_click" ? clicked_version : null;

    const metadata =
      event_type === "search"
        ? { query, filters: filters ?? {}, results_count: results_count ?? null }
        : {
            query,
            filters: filters ?? {},
            clicked_section_title,
            clicked_section_path,
          };

    const value =
      event_type === "search"
        ? null
        : typeof clicked_rank === "number"
        ? String(clicked_rank)
        : null;

    const { error } = await supabase.from("events").insert([
      {
        event_type,
        user_email: user_email ?? null,
        doc_id,
        version,
        value,
        notes: null,
        metadata,
      },
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}