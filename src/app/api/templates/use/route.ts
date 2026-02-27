import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

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

    const membership = await getUserOrganization(userId);
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const body = await request.json();
    const { templateId, title, folderId, teamId } = body;

    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    // Fetch template
    const { data: template, error: tErr } = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", templateId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (tErr || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Generate doc ID
    const docId = `PS-DOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Replace template variables
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    let content = template.content
      .replace(/\{\{date\}\}/g, dateStr)
      .replace(/\{\{doc_id\}\}/g, docId)
      .replace(/\{\{title\}\}/g, title || template.name);

    const docTitle = title || `${template.name} — ${dateStr}`;

    const { data: document, error } = await supabase
      .from("documents")
      .insert({
        doc_id: docId,
        title: docTitle,
        content,
        doc_type: template.doc_type || "document",
        tags: template.tags || [],
        doc_source: "template",
        organization_id: membership.organization_id,
        team_id: teamId || null,
        folder_id: folderId || null,
        created_by: userId,
        current_version: "v1.0",
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Document created from template",
      docId: document.doc_id,
      title: document.title,
    });
  } catch {
    return NextResponse.json({ error: "Failed to create from template" }, { status: 500 });
  }
}
