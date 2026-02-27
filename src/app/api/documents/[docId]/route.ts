import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

// GET a single document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const { data: document, error } = await supabase
      .from("documents")
      .select("*")
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (error || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("GET document error:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

// PATCH — partial update (move to folder, update individual fields)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    // Handle folder move
    if ("folderId" in body) {
      if (body.folderId) {
        const { data: folder } = await supabase
          .from("folders")
          .select("id")
          .eq("id", body.folderId)
          .eq("organization_id", membership.organization_id)
          .single();

        if (!folder) {
          return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
        }
      }
      updates.folder_id = body.folderId || null;
    }

    if ("title" in body) updates.title = body.title;
    if ("content" in body) updates.content = body.content;
    if ("docType" in body) updates.doc_type = body.docType;
    if ("tags" in body) updates.tags = body.tags;
    if ("teamId" in body) updates.team_id = body.teamId || null;
    if ("status" in body) updates.status = body.status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: document, error } = await supabase
      .from("documents")
      .update(updates)
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id)
      .select()
      .single();

    if (error) {
      console.error("PATCH error:", error);
      return NextResponse.json(
        { error: "Failed to update document: " + error.message },
        { status: 500 }
      );
    }

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Document updated", document });
  } catch (error) {
    console.error("PATCH document error:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}

// UPDATE a document (full update)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();
    const { title, content, docType, fileUrl, fileName, fileType } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const { data: currentDoc } = await supabase
      .from("documents")
      .select("current_version, content")
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (!currentDoc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const versionMatch = currentDoc.current_version?.match(/v?(\d+)\.?(\d+)?/);
    let newVersion = "v1.1";
    if (versionMatch) {
      const major = parseInt(versionMatch[1]) || 1;
      const minor = parseInt(versionMatch[2]) || 0;
      newVersion = `v${major}.${minor + 1}`;
    }

    const updateData: Record<string, any> = {
      title,
      content,
      doc_type: docType || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      file_type: fileType || null,
      current_version: newVersion,
      updated_at: new Date().toISOString(),
    };

    const contentChanged = content !== currentDoc.content;
    if (contentChanged) {
      console.log("🤖 Content changed, regenerating AI summary...");
      const summary = await generateSummary(title, content);
      if (summary) {
        updateData.summary = summary;
        console.log("✅ New summary generated");
      }
    }

    const { data: document, error } = await supabase
      .from("documents")
      .update(updateData)
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id)
      .select()
      .single();

    if (error) {
      console.error("Update error:", error);
      return NextResponse.json(
        { error: "Failed to update document" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Document updated successfully",
      document,
      newVersion,
    });
  } catch (error) {
    console.error("PUT document error:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}

// DELETE a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const { data: doc } = await supabase
      .from("documents")
      .select("file_url")
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (doc?.file_url) {
      try {
        const urlParts = doc.file_url.split("/documents/");
        if (urlParts[1]) {
          await supabase.storage.from("documents").remove([urlParts[1]]);
        }
      } catch (storageError) {
        console.error("Failed to delete file from storage:", storageError);
      }
    }

    await supabase
      .from("feedback")
      .delete()
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id);

    await supabase
      .from("document_embeddings")
      .delete()
      .eq("doc_id", docId);

    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("DELETE document error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
