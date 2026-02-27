import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET version history for a document
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);
    if (!membership) {
      return NextResponse.json({ versions: [] });
    }

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }

    const { data: versions, error } = await supabase
      .from("document_versions")
      .select("*")
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch versions error:", error);
      return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
    }

    return NextResponse.json({ versions: versions || [] });
  } catch (error) {
    console.error("GET versions error:", error);
    return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
  }
}

// CREATE a version snapshot (called before editing a document)
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

    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();
    const { docId, changeDescription } = body;

    if (!docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }

    // Get current document state
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Count existing versions to generate version number
    const { count } = await supabase
      .from("document_versions")
      .select("*", { count: "exact", head: true })
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id);

    const versionNum = (count || 0) + 1;
    const versionNumber = `v${versionNum}.0`;

    // Snapshot current state
    const { data: version, error } = await supabase
      .from("document_versions")
      .insert({
        doc_id: docId,
        organization_id: membership.organization_id,
        version_number: versionNumber,
        title: doc.title,
        content: doc.content,
        summary: doc.summary,
        doc_type: doc.doc_type,
        tags: doc.tags,
        change_description: changeDescription || "Version snapshot",
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Create version error:", error);
      return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
    }

    // Update the document's current_version field
    await supabase
      .from("documents")
      .update({ current_version: versionNumber })
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id);

    return NextResponse.json({ version });
  } catch (error) {
    console.error("POST version error:", error);
    return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
  }
}
