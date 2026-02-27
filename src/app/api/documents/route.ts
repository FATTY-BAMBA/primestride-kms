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

    let tags: string[] = [];
    try {
      const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
      tags = JSON.parse(cleaned);
      if (!Array.isArray(tags)) tags = [];
      tags = tags
        .map((t) => String(t).toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff\u3400-\u4dbf-]/g, ""))
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

// Auto-generate document metadata from filename and content
async function autoGenerateMetadata(
  originalFileName: string,
  content: string | null,
  organizationId: string
): Promise<{ docId: string; title: string; docType: string; tags: string[]; summary: string }> {
  
  // Clean title from filename
  const nameWithoutExt = originalFileName.replace(/\.[^/.]+$/, "");
  const cleanTitle = nameWithoutExt
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Auto-generate unique doc ID using timestamp + random suffix
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  const docId = `PS-DOC-${timestamp}-${rand}`;

  // If no content, return basic metadata
  if (!content || content.trim().length < 10) {
    return {
      docId,
      title: cleanTitle || "Untitled Document",
      docType: "document",
      tags: [],
      summary: "",
    };
  }

  // Use AI to generate doc type, better title, and summary in one call
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You analyze uploaded documents and generate metadata. Return ONLY a JSON object with these fields:
- "title": A clear, professional title for the document (improve the filename-based title if possible, keep the original language)
- "docType": One of: guide, playbook, strategy, report, sop, policy, meeting-notes, template, reference, training, proposal, specification, other
- "summary": A 2-3 sentence TL;DR summary

Return ONLY valid JSON, no markdown, no backticks.`
        },
        {
          role: "user",
          content: `Filename: ${originalFileName}\nFilename-based title: ${cleanTitle}\n\nContent (first 3000 chars):\n${content.slice(0, 3000)}`
        }
      ],
      max_tokens: 300,
      temperature: 0.5,
    });

    const raw = completion.choices[0].message.content?.trim() || "{}";
    const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Generate tags separately (reuses existing org tags)
    const tags = await generateTags(
      parsed.title || cleanTitle,
      content,
      parsed.docType || "document",
      organizationId
    );

    // If AI didn't return a summary, generate one separately
    let summary = parsed.summary || "";
    if (!summary && content.trim().length > 50) {
      summary = await generateSummary(parsed.title || cleanTitle, content);
    }

    return {
      docId,
      title: parsed.title || cleanTitle || "Untitled Document",
      docType: parsed.docType || "document",
      tags,
      summary,
    };
  } catch (error) {
    console.error("Auto-generate metadata failed:", error);
    // Fallback: generate tags and summary separately
    const tags = await generateTags(cleanTitle, content, "document", organizationId);
    const summary = await generateSummary(cleanTitle, content);
    return {
      docId,
      title: cleanTitle || "Untitled Document",
      docType: "document",
      tags,
      summary,
    };
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
    const {
      // Legacy fields (still supported for backward compatibility)
      docId: manualDocId,
      title: manualTitle,
      content,
      docType: manualDocType,
      tags: manualTags,
      fileUrl,
      fileName,
      fileType,
      teamId,
      // New auto-generate mode
      autoGenerate,
      originalFileName,
    } = body;

    // ── Auto-generate mode (Eden-style) ──
    if (autoGenerate) {
      const fname = originalFileName || fileName || "Untitled";
      console.log(`📂 Auto-processing: ${fname}`);

      const metadata = await autoGenerateMetadata(
        fname,
        content,
        membership.organization_id
      );

      // Use the generated doc ID directly (timestamp+random ensures uniqueness)
      const finalDocId = metadata.docId;

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

      console.log(`🤖 Generated: ID=${finalDocId}, Title="${metadata.title}", Type=${metadata.docType}, Tags=${metadata.tags.join(",")}`);

      const { data: document, error } = await supabase
        .from("documents")
        .insert({
          doc_id: finalDocId,
          title: metadata.title,
          content: content || `[File uploaded: ${fname}]`,
          summary: metadata.summary,
          doc_type: metadata.docType,
          tags: metadata.tags,
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
        console.error("Auto-create error:", error);
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
    }

    // ── Legacy manual mode ──
    if (!manualDocId || !manualTitle || !content) {
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
      .eq("doc_id", manualDocId)
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
    const summary = await generateSummary(manualTitle, content);

    // Auto-generate tags if user didn't provide any
    let finalTags = manualTags || [];
    if (!manualTags || manualTags.length === 0) {
      console.log("🏷️ Auto-generating tags...");
      finalTags = await generateTags(manualTitle, content, manualDocType, membership.organization_id);
      console.log("✅ Auto-generated tags:", finalTags);
    }

    const { data: document, error } = await supabase
      .from("documents")
      .insert({
        doc_id: manualDocId,
        title: manualTitle,
        content,
        summary,
        doc_type: manualDocType || null,
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
    const teamFilter = searchParams.get("team");

    const userTeamIds = await getUserTeams(userId);
    const isOrgAdmin = ["owner", "admin"].includes(membership.role);

    let query = supabase
      .from("documents")
      .select("*, teams(id, name, color)")
      .eq("organization_id", membership.organization_id)
      .order("updated_at", { ascending: false });

    if (teamFilter === "org-wide") {
      query = query.is("team_id", null);
    } else if (teamFilter && teamFilter !== "all") {
      query = query.eq("team_id", teamFilter);
    }

    const { data: documents, error } = await query;

    if (error) {
      console.error("Fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    let filteredDocs = documents || [];
    
    if (!isOrgAdmin && teamFilter !== "org-wide" && (!teamFilter || teamFilter === "all")) {
      filteredDocs = filteredDocs.filter(doc => {
        if (!doc.team_id) return true;
        return userTeamIds.includes(doc.team_id);
      });
    }

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
