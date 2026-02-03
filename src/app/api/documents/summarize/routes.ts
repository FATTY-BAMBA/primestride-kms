import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const { docId } = await request.json();

    if (!docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }

    // Get the document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("title, content")
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Generate summary
    console.log(`🤖 Generating AI summary for ${docId}...`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that creates concise document summaries. Generate a 2-3 sentence TL;DR summary that captures the key points. Be direct and informative. Do not start with 'This document...' - just state the key information.",
        },
        {
          role: "user",
          content: `Title: ${document.title}\n\nContent:\n${document.content.slice(0, 3000)}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.5,
    });

    const summary = completion.choices[0].message.content?.trim() || "";

    if (!summary) {
      return NextResponse.json(
        { error: "Failed to generate summary" },
        { status: 500 }
      );
    }

    // Save summary to database
    const { error: updateError } = await supabase
      .from("documents")
      .update({ summary })
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id);

    if (updateError) {
      console.error("Failed to save summary:", updateError);
      // Still return the summary even if save fails
    }

    console.log(`✅ Summary generated and saved for ${docId}`);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Summarize error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}