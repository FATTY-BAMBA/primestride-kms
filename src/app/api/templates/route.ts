import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);
    if (!membership) {
      return NextResponse.json({ templates: [] });
    }

    const { data: templates, error } = await supabase
      .from("document_templates")
      .select("*")
      .eq("organization_id", membership.organization_id)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: templates || [] });
  } catch {
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

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
      return NextResponse.json({ error: "Only admins can create templates" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, content, docType, tags, icon } = body;

    if (!name?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "Name and content are required" }, { status: 400 });
    }

    const { data: template, error } = await supabase
      .from("document_templates")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        content: content.trim(),
        doc_type: docType || null,
        tags: tags || [],
        icon: icon || "📋",
        organization_id: membership.organization_id,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template });
  } catch {
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
      return NextResponse.json({ error: "Only admins can delete templates" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("id");

    if (!templateId) {
      return NextResponse.json({ error: "Template ID required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("document_templates")
      .delete()
      .eq("id", templateId)
      .eq("organization_id", membership.organization_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Template deleted" });
  } catch {
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}

// PATCH update a template (admin only)
export async function PATCH(request: NextRequest) {
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
      return NextResponse.json({ error: "Only admins can edit templates" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description, content, docType, icon } = body;

    if (!id) {
      return NextResponse.json({ error: "Template ID required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name?.trim()) updates.name = name.trim();
    if (typeof description === "string") updates.description = description.trim() || null;
    if (content?.trim()) updates.content = content.trim();
    if (docType !== undefined) updates.doc_type = docType || null;
    if (icon) updates.icon = icon;

    const { data: template, error } = await supabase
      .from("document_templates")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", membership.organization_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template });
  } catch {
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}
