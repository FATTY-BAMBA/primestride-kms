import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET a single document
export async function GET(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { data: document, error } = await supabase
      .from("documents")
      .select("*")
      .eq("doc_id", params.docId)
      .eq("organization_id", profile.organization_id)
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

// UPDATE a document
export async function PUT(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Only admins and owners can update
    if (!["owner", "admin"].includes(profile.role || "")) {
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

    // Get current document to increment version
    const { data: currentDoc } = await supabase
      .from("documents")
      .select("current_version")
      .eq("doc_id", params.docId)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!currentDoc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Parse current version and increment
    const versionMatch = currentDoc.current_version?.match(/v?(\d+)\.?(\d+)?/);
    let newVersion = "v1.1";
    if (versionMatch) {
      const major = parseInt(versionMatch[1]) || 1;
      const minor = parseInt(versionMatch[2]) || 0;
      newVersion = `v${major}.${minor + 1}`;
    }

    const { data: document, error } = await supabase
      .from("documents")
      .update({
        title,
        content,
        doc_type: docType || null,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_type: fileType || null,
        current_version: newVersion,
      })
      .eq("doc_id", params.docId)
      .eq("organization_id", profile.organization_id)
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
  { params }: { params: { docId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Only admins and owners can delete
    if (!["owner", "admin"].includes(profile.role || "")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Get the document to check for attached files
    const { data: doc } = await supabase
      .from("documents")
      .select("file_url")
      .eq("doc_id", params.docId)
      .eq("organization_id", profile.organization_id)
      .single();

    // Delete file from storage if exists
    if (doc?.file_url) {
      try {
        // Extract file path from URL
        const urlParts = doc.file_url.split("/documents/");
        if (urlParts[1]) {
          await supabase.storage.from("documents").remove([urlParts[1]]);
        }
      } catch (storageError) {
        console.error("Failed to delete file from storage:", storageError);
        // Continue with document deletion even if file deletion fails
      }
    }

    // Delete associated feedback first (if any)
    await supabase
      .from("feedback")
      .delete()
      .eq("doc_id", params.docId)
      .eq("organization_id", profile.organization_id);

    // Delete associated embeddings (if any)
    await supabase.from("embeddings").delete().eq("doc_id", params.docId);

    // Delete the document
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("doc_id", params.docId)
      .eq("organization_id", profile.organization_id);

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