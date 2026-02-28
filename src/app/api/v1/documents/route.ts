import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key-auth";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function apiError(message: string, status: number) {
  return NextResponse.json({ error: message, status }, { status });
}

function apiSuccess(data: any, status = 200) {
  return NextResponse.json({ data, status }, { status });
}

// GET /api/v1/documents — list or get single document
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) return apiError("Invalid or missing API key. Use: Authorization: Bearer psa_...", 401);
    if (!auth.scopes.includes("read")) return apiError("API key lacks 'read' scope", 403);

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("doc_id");
    const search = searchParams.get("search");
    const tag = searchParams.get("tag");
    const docType = searchParams.get("doc_type");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Single document
    if (docId) {
      const { data: doc, error } = await supabase
        .from("documents")
        .select("doc_id, title, content, summary, doc_type, tags, current_version, status, doc_source, created_at, updated_at")
        .eq("doc_id", docId)
        .eq("organization_id", auth.organization_id)
        .single();

      if (error || !doc) return apiError("Document not found", 404);
      return apiSuccess({ document: doc });
    }

    // List / search documents
    let query = supabase
      .from("documents")
      .select("doc_id, title, summary, doc_type, tags, current_version, status, doc_source, created_at, updated_at", { count: "exact" })
      .eq("organization_id", auth.organization_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by tag
    if (tag) {
      query = query.contains("tags", [tag]);
    }

    // Filter by doc_type
    if (docType) {
      query = query.eq("doc_type", docType);
    }

    // Search by title/content
    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    const { data: docs, error, count } = await query;

    if (error) return apiError(error.message, 500);

    return apiSuccess({
      documents: docs || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (err: any) {
    return apiError(err?.message || "Internal error", 500);
  }
}

// POST /api/v1/documents — create a document
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) return apiError("Invalid or missing API key", 401);
    if (!auth.scopes.includes("write")) return apiError("API key lacks 'write' scope", 403);

    const body = await request.json();
    const { title, content, doc_type, tags, summary, folder_id } = body;

    if (!title?.trim()) return apiError("title is required", 400);

    const docId = `PS-API-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        doc_id: docId,
        title: title.trim(),
        content: content || "",
        doc_type: doc_type || "document",
        tags: tags || [],
        summary: summary || null,
        folder_id: folder_id || null,
        doc_source: "api",
        organization_id: auth.organization_id,
        created_by: `api-key:${auth.key_id}`,
        current_version: "v1.0",
        status: "published",
      })
      .select("doc_id, title, doc_type, tags, current_version, status, created_at")
      .single();

    if (error) return apiError(error.message, 500);
    return apiSuccess({ document: doc }, 201);
  } catch (err: any) {
    return apiError(err?.message || "Internal error", 500);
  }
}

// PATCH /api/v1/documents — update a document
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) return apiError("Invalid or missing API key", 401);
    if (!auth.scopes.includes("write")) return apiError("API key lacks 'write' scope", 403);

    const body = await request.json();
    const { doc_id, title, content, doc_type, tags, summary, status } = body;

    if (!doc_id) return apiError("doc_id is required", 400);

    // Verify doc exists in org
    const { data: existing } = await supabase
      .from("documents")
      .select("doc_id")
      .eq("doc_id", doc_id)
      .eq("organization_id", auth.organization_id)
      .single();

    if (!existing) return apiError("Document not found", 404);

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (title?.trim()) updates.title = title.trim();
    if (typeof content === "string") updates.content = content;
    if (doc_type !== undefined) updates.doc_type = doc_type;
    if (tags !== undefined) updates.tags = tags;
    if (summary !== undefined) updates.summary = summary;
    if (status) updates.status = status;

    const { data: doc, error } = await supabase
      .from("documents")
      .update(updates)
      .eq("doc_id", doc_id)
      .eq("organization_id", auth.organization_id)
      .select("doc_id, title, doc_type, tags, current_version, status, updated_at")
      .single();

    if (error) return apiError(error.message, 500);
    return apiSuccess({ document: doc });
  } catch (err: any) {
    return apiError(err?.message || "Internal error", 500);
  }
}

// DELETE /api/v1/documents — delete a document
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) return apiError("Invalid or missing API key", 401);
    if (!auth.scopes.includes("write")) return apiError("API key lacks 'write' scope", 403);

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("doc_id");
    if (!docId) return apiError("doc_id is required", 400);

    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("doc_id", docId)
      .eq("organization_id", auth.organization_id);

    if (error) return apiError(error.message, 500);
    return apiSuccess({ message: "Document deleted" });
  } catch (err: any) {
    return apiError(err?.message || "Internal error", 500);
  }
}
