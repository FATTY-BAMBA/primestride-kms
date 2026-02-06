import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to get user's active organization
// If user has multiple memberships, use the most recently joined one
async function getUserOrganization(userId: string) {
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, role, joined_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("joined_at", { ascending: false });

  if (!memberships || memberships.length === 0) {
    return null;
  }

  // Return the most recently joined organization
  return memberships[0];
}

// Generate AI summary for document content
async function generateSummary(title: string, content: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates concise document summaries. Generate a 2-3 sentence TL;DR summary that captures the key points. Be direct and informative. Do not start with 'This document...' - just state the key information."
        },
        {
          role: "user",
          content: `Title: ${title}\n\nContent:\n${content.slice(0, 3000)}`
        }
      ],
      max_tokens: 150,
      temperature: 0.5,
    });

    return completion.choices[0].message.content?.trim() || "";
  } catch (error) {
    console.error("Failed to generate summary:", error);
    return "";
  }
}

// CREATE a new document
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization membership
    const membership = await getUserOrganization(userId);

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Only admins and owners can create
    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();
    const { docId, title, content, docType, tags, fileUrl, fileName, fileType } = body;

    if (!docId || !title || !content) {
      return NextResponse.json(
        { error: "Document ID, title, and content are required" },
        { status: 400 }
      );
    }

    // Check if doc_id already exists
    const { data: existingDoc } = await supabase
      .from("documents")
      .select("doc_id")
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (existingDoc) {
      return NextResponse.json(
        { error: "A document with this ID already exists" },
        { status: 400 }
      );
    }

    // Generate AI summary
    console.log("🤖 Generating AI summary for new document...");
    const summary = await generateSummary(title, content);
    console.log("✅ Summary generated:", summary.slice(0, 100) + "...");

    const { data: document, error } = await supabase
      .from("documents")
      .insert({
        doc_id: docId,
        title,
        content,
        summary,
        doc_type: docType || null,
        tags: tags || [],
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_type: fileType || null,
        organization_id: membership.organization_id,
        created_by: userId,
        current_version: "v1.0",
        status: "published",
      })
      .select()
      .single();

    if (error) {
      console.error("Create error:", error);
      return NextResponse.json(
        { error: "Failed to create document: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Document created successfully",
      docId: document.doc_id,
      document,
    });
  } catch (error) {
    console.error("POST document error:", error);
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 }
    );
  }
}

// GET all documents (for library listing)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization membership
    const membership = await getUserOrganization(userId);

    if (!membership) {
      return NextResponse.json({ documents: [] });
    }

    const { data: documents, error } = await supabase
      .from("documents")
      .select("*")
      .eq("organization_id", membership.organization_id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("GET documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}