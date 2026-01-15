import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

interface LearningReview {
  review_id: string;
  doc_id: string;
  from_version: string;
  to_version: string;
  observed_signal: string;
  decision: string;
  hypothesis: string;
  owner_email: string | null;
  review_date: string;
  created_at: string;
}

export async function GET(req: Request) {
  const adminToken = process.env.ADMIN_TOKEN;
  const headerToken = req.headers.get("x-admin-token");
  if (!adminToken || headerToken !== adminToken) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const doc_id = searchParams.get("doc_id");

    let query = supabase
      .from("learning_reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (doc_id) query = query.eq("doc_id", doc_id);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ reviews: (data ?? []) as LearningReview[] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}