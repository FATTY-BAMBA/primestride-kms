import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET comments for a document
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);
    if (!membership) {
      return NextResponse.json({ comments: [] });
    }

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }

    const { data: comments, error } = await supabase
      .from("comments")
      .select("*")
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch comments error:", error);
      return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
    }

    return NextResponse.json({ comments: comments || [] });
  } catch (error) {
    console.error("GET comments error:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

// POST a new comment
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const membership = await getUserOrganization(userId);
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const body = await request.json();
    const { docId, content, highlightedText, selectionStart, selectionEnd, parentId } = body;

    if (!docId || !content?.trim()) {
      return NextResponse.json({ error: "docId and content are required" }, { status: 400 });
    }

    const userName = user?.firstName
      ? `${user.firstName} ${user.lastName || ""}`.trim()
      : user?.emailAddresses?.[0]?.emailAddress || "Unknown";

    const { data: comment, error } = await supabase
      .from("comments")
      .insert({
        doc_id: docId,
        organization_id: membership.organization_id,
        user_id: userId,
        user_name: userName,
        content: content.trim(),
        highlighted_text: highlightedText || null,
        selection_start: selectionStart ?? null,
        selection_end: selectionEnd ?? null,
        parent_id: parentId || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Create comment error:", error);
      return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
    }

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("POST comment error:", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}

// PATCH — resolve/unresolve or edit a comment
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

    const body = await request.json();
    const { commentId, resolved, content } = body;

    if (!commentId) {
      return NextResponse.json({ error: "commentId is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof resolved === "boolean") updates.resolved = resolved;
    if (content?.trim()) updates.content = content.trim();

    const { data: comment, error } = await supabase
      .from("comments")
      .update(updates)
      .eq("id", commentId)
      .eq("organization_id", membership.organization_id)
      .select()
      .single();

    if (error) {
      console.error("Update comment error:", error);
      return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
    }

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("PATCH comment error:", error);
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }
}

// DELETE a comment
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

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("id");

    if (!commentId) {
      return NextResponse.json({ error: "Comment ID is required" }, { status: 400 });
    }

    const isAdmin = ["owner", "admin"].includes(membership.role || "");

    // Only the author or admin can delete
    const { data: comment } = await supabase
      .from("comments")
      .select("user_id")
      .eq("id", commentId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (comment.user_id !== userId && !isAdmin) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("organization_id", membership.organization_id);

    if (error) {
      console.error("Delete comment error:", error);
      return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
    }

    return NextResponse.json({ message: "Comment deleted" });
  } catch (error) {
    console.error("DELETE comment error:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
