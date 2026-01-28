import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// CREATE a new document
export async function POST(request: NextRequest) {
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

    // Only admins and owners can create
    if (!["owner", "admin"].includes(profile.role || "")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();
    const { docId, title, content, docType, fileUrl, fileName, fileType } = body;

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
      .eq("organization_id", profile.organization_id)
      .single();

    if (existingDoc) {
      return NextResponse.json(
        { error: "A document with this ID already exists" },
        { status: 400 }
      );
    }

    const { data: document, error } = await supabase
      .from("documents")
      .insert({
        doc_id: docId,
        title,
        content,
        doc_type: docType || null,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_type: fileType || null,
        organization_id: profile.organization_id,
        current_version: "v1.0",
        status: "published",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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

    const { data: documents, error } = await supabase
      .from("documents")
      .select("*")
      .eq("organization_id", profile.organization_id)
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