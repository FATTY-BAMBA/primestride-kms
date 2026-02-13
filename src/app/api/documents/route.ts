import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to get user's team memberships
async function getUserTeams(userId: string) {
  const { data } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId);
  return (data || []).map(t => t.team_id);
}

// Generate AI summary
async function generateSummary(title: string, content: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates concise document summaries. Generate a 2-3 sentence TL;DR summary that captures the key points. Be direct and informative."
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

// Generate AI tags automatically
async function generateTags(title: string, content: string, docType: string | null, organizationId: string): Promise<string[]> {
  try {
    // Get existing tags from organization's documents for context
    const { data: existingDocs } = await supabase
      .from("documents")
      .select("tags")
      .eq("organization_id", organizationId)
      .not("tags", "is", null);

    const existingTags = new Set<string>();
    existingDocs?.forEach((doc) => {
      if (Array.isArray(doc.tags)) {
        doc.tags.forEach((t: string) => existingTags.add(t));
      }
    });

    const existingTagsList = Array.from(existingTags).slice(0, 30).join(", ");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a document tagging assistant. Suggest 3-5 relevant, concise tags for the given document.

Rules:
- Tags should be lowercase, single words or short hyphenated phrases
- Tags should describe the topic, purpose, or category
- Be specific and useful for filtering/searching
- Prefer reusing existing tags when they fit well
- Return ONLY a JSON array of strings, nothing else

${existingTagsList ? `Existing tags in use: ${existingTagsList}` : ""}`,
        },
        {
          role: "user",
          content: `Title: ${title || "Untitled"}\nType: ${docType || "general"}\n\nContent:\n${(content || "").slice(0, 2000)}`,
        },
      ],
      max_tokens: 100,
      temperature: 0.5,
    });

    const raw = completion.choices[0].message.content?.trim() || "[]";

    // Parse the response
    let tags: string[] = [];
    try {
      const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
      tags = JSON.parse(cleaned);
      if (!Array.isArray(tags)) tags = [];
      tags = tags
        .map((t) => String(t).toLowerCase().trim().replace(/[^a-z0-9-]/g, ""))
        .filter((t) => t.length > 0 && t.length <= 30)
        .slice(0, 5);
    } catch {
      console.error("Failed to parse auto-tags:", raw);
      tags = [];
    }

    return tags;
  } catch (error) {
    console.error("Failed to generate tags:", error);
    return [];
  }
}

// CREATE document
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Only admins and owners can create
    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();
    const { docId, title, content, docType, tags, fileUrl, fileName, fileType, teamId } = body;

    if (!docId || !title || !content) {
      return NextResponse.json(
        { error: "Document ID, title, and content are required" },
        { status: 400 }
      );
    }

    // If teamId provided, verify it belongs to the org
    if (teamId) {
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .eq("id", teamId)
        .eq("organization_id", membership.organization_id)
        .single();

      if (!team) {
        return NextResponse.json({ error: "Invalid team" }, { status: 400 });
      }
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
    console.log("🤖 Generating AI summary...");
    const summary = await generateSummary(title, content);

    // Auto-generate tags if user didn't provide any
    let finalTags = tags || [];
    if (!tags || tags.length === 0) {
      console.log("🏷️ Auto-generating tags...");
      finalTags = await generateTags(title, content, docType, membership.organization_id);
      console.log("✅ Auto-generated tags:", finalTags);
    }

    const { data: document, error } = await supabase
      .from("documents")
      .insert({
        doc_id: docId,
        title,
        content,
        summary,
        doc_type: docType || null,
        tags: finalTags,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_type: fileType || null,
        organization_id: membership.organization_id,
        team_id: teamId || null,
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

// GET documents with team filtering
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);
    if (!membership) {
      return NextResponse.json({ documents: [], teams: [] });
    }

    const { searchParams } = new URL(request.url);
    const teamFilter = searchParams.get("team"); // "all", "org-wide", or team UUID

    // Get user's teams
    const userTeamIds = await getUserTeams(userId);
    const isOrgAdmin = ["owner", "admin"].includes(membership.role);

    // Build query
    let query = supabase
      .from("documents")
      .select("*, teams(id, name, color)")
      .eq("organization_id", membership.organization_id)
      .order("updated_at", { ascending: false });

    // Apply team filter
    if (teamFilter === "org-wide") {
      // Only org-wide documents (no team)
      query = query.is("team_id", null);
    } else if (teamFilter && teamFilter !== "all") {
      // Specific team's documents
      query = query.eq("team_id", teamFilter);
    }
    // For "all" or no filter, we'll filter in code based on permissions

    const { data: documents, error } = await query;

    if (error) {
      console.error("Fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    // Filter documents based on access
    let filteredDocs = documents || [];
    
    if (!isOrgAdmin && teamFilter !== "org-wide" && (!teamFilter || teamFilter === "all")) {
      // Regular members: only see org-wide docs + their teams' docs
      filteredDocs = filteredDocs.filter(doc => {
        if (!doc.team_id) return true; // Org-wide
        return userTeamIds.includes(doc.team_id); // In user's team
      });
    }

    // Get available teams for the filter dropdown
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name, color")
      .eq("organization_id", membership.organization_id)
      .order("name");

    return NextResponse.json({ 
      documents: filteredDocs,
      teams: teams || [],
      user_role: membership.role,
      user_teams: userTeamIds,
    });
  } catch (error) {
    console.error("GET documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}