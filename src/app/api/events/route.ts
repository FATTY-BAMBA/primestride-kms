import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

type EventType = "view" | "open" | "feedback" | "reopen";
type FeedbackValue = "helped" | "not_confident" | "didnt_help";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      user_email,
      doc_id,
      version,
      event_type,
      value,
      notes,
    }: {
      user_email?: string;
      doc_id: string;
      version: string;
      event_type: EventType;
      value?: FeedbackValue;
      notes?: string;
    } = body;

    // Basic validation
    if (!doc_id || !version || !event_type) {
      return NextResponse.json(
        { error: "doc_id, version, and event_type are required." },
        { status: 400 }
      );
    }

    if (event_type === "feedback" && !value) {
      return NextResponse.json(
        { error: "value is required for feedback events." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("events").insert([
      {
        user_email: user_email ?? null,
        doc_id,
        version,
        event_type,
        value: value ?? null,
        notes: notes ?? null,
      },
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}