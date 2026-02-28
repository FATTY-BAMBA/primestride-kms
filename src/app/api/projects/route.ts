import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET all projects for the org
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ projects: [] });

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("id");

    // Single project with details
    if (projectId) {
      const { data: project, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("organization_id", membership.organization_id)
        .single();

      if (error || !project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      // Get project docs
      const { data: projectDocs } = await supabase
        .from("project_documents")
        .select("doc_id, added_at, added_by")
        .eq("project_id", projectId);

      const docIds = (projectDocs || []).map(pd => pd.doc_id);
      let documents: any[] = [];

      if (docIds.length > 0) {
        const { data: docs } = await supabase
          .from("documents")
          .select("doc_id, title, doc_type, doc_source, tags, current_version, summary, file_url")
          .in("doc_id", docIds);
        documents = docs || [];
      }

      // Get project members
      const { data: members } = await supabase
        .from("project_members")
        .select("user_id, role, added_at")
        .eq("project_id", projectId);

      return NextResponse.json({
        project,
        documents,
        members: members || [],
        docCount: documents.length,
      });
    }

    // All projects
    const { data: projects, error } = await supabase
      .from("projects")
      .select("*")
      .eq("organization_id", membership.organization_id)
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get doc counts for each project
    const projectIds = (projects || []).map(p => p.id);
    let docCounts: Record<string, number> = {};

    if (projectIds.length > 0) {
      const { data: pdocs } = await supabase
        .from("project_documents")
        .select("project_id")
        .in("project_id", projectIds);

      if (pdocs) {
        for (const pd of pdocs) {
          docCounts[pd.project_id] = (docCounts[pd.project_id] || 0) + 1;
        }
      }
    }

    const enriched = (projects || []).map(p => ({
      ...p,
      doc_count: docCounts[p.id] || 0,
    }));

    return NextResponse.json({ projects: enriched, user_role: membership.role });
  } catch (error) {
    console.error("GET projects error:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

// POST create a new project
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await currentUser();
    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization found" }, { status: 404 });

    const body = await request.json();
    const { name, description, icon, color } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon || "🎯",
        color: color || "#7C3AED",
        organization_id: membership.organization_id,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-add creator as owner
    await supabase.from("project_members").insert({
      project_id: project.id,
      user_id: userId,
      role: "owner",
    });

    return NextResponse.json({ project });
  } catch {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

// PATCH update project or add/remove docs
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization found" }, { status: 404 });

    const body = await request.json();
    const { projectId, action, docId, docIds, name, description, icon, color, status } = body;

    if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

    // Verify project belongs to org
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Add documents
    if (action === "add-docs") {
      const ids = docIds || (docId ? [docId] : []);
      if (ids.length === 0) return NextResponse.json({ error: "No docs to add" }, { status: 400 });

      const inserts = ids.map((id: string) => ({
        project_id: projectId,
        doc_id: id,
        added_by: userId,
      }));

      const { error } = await supabase
        .from("project_documents")
        .upsert(inserts, { onConflict: "project_id,doc_id" });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Update project timestamp
      await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", projectId);

      return NextResponse.json({ message: `Added ${ids.length} doc(s) to project` });
    }

    // Remove document
    if (action === "remove-doc") {
      if (!docId) return NextResponse.json({ error: "docId required" }, { status: 400 });

      const { error } = await supabase
        .from("project_documents")
        .delete()
        .eq("project_id", projectId)
        .eq("doc_id", docId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ message: "Document removed from project" });
    }

    // Update project metadata
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name?.trim()) updates.name = name.trim();
    if (typeof description === "string") updates.description = description.trim() || null;
    if (icon) updates.icon = icon;
    if (color) updates.color = color;
    if (status) updates.status = status;

    const { data: updated, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", projectId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ project: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

// DELETE a project
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization found" }, { status: 404 });

    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("id");
    if (!projectId) return NextResponse.json({ error: "Project ID required" }, { status: 400 });

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("organization_id", membership.organization_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: "Project deleted" });
  } catch {
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
