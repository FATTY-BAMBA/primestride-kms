import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

type LoggedType = "open" | "reopen";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      user_email,
      doc_id,
      version,
    }: { user_email?: string | null; doc_id: string; version: string } = body;

    if (!doc_id || !version) {
      return NextResponse.json(
        { error: "doc_id and version are required." },
        { status: 400 }
      );
    }

    // For v1, we require a user identifier for reopen correctness.
    // If user_email is missing, we will treat every click as "open".
    const hasUser = !!(user_email && String(user_email).trim().length > 0);

    let eventType: LoggedType = "open";

    if (hasUser) {
      // Check if an OPEN or REOPEN event already exists for this user+doc+version
      const { data: prior, error: priorErr } = await supabase
        .from("events")
        .select("id")
        .eq("doc_id", doc_id)
        .eq("version", version)
        .eq("user_email", user_email)
        .in("event_type", ["open", "reopen"])
        .limit(1);

      if (priorErr) {
        return NextResponse.json({ error: priorErr.message }, { status: 500 });
      }

      // If at least one prior open/reopen exists, this click is a reopen
      if (prior && prior.length > 0) eventType = "reopen";
    }

    // Insert the event
    const { error: insErr } = await supabase.from("events").insert([
      {
        user_email: hasUser ? user_email : null,
        doc_id,
        version,
        event_type: eventType,
      },
    ]);

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, event_type: eventType });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}