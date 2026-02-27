import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET folders for current org
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);
    if (!membership) {
      return NextResponse.json({ folders: [] });
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parent"); // null = root folders
    const teamId = searchParams.get("team");

    let query = supabase
      .from("folders")
      .select("*, documents:documents(count)")
      .eq("organization_id", membership.organization_id)
      .order("name", { ascending: true });

    if (parentId) {
      query = query.eq("parent_folder_id", parentId);
    } else {
      query = query.is("parent_folder_id", null);
    }

    if (teamId) {
      query = query.eq("team_id", teamId);
    }

    const { data: folders, error } = await query;

    if (error) {
      console.error("Fetch folders error:", error);
      return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 });
    }

    return NextResponse.json({ folders: folders || [] });
  } catch (error) {
    console.error("GET folders error:", error);
    return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 });
  }
}

// CREATE folder
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
    const { name, parentFolderId, teamId, color, icon } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    // Validate parent folder belongs to same org
    if (parentFolderId) {
      const { data: parent } = await supabase
        .from("folders")
        .select("id")
        .eq("id", parentFolderId)
        .eq("organization_id", membership.organization_id)
        .single();

      if (!parent) {
        return NextResponse.json({ error: "Invalid parent folder" }, { status: 400 });
      }
    }

    // Validate team belongs to same org
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

    const { data: folder, error } = await supabase
      .from("folders")
      .insert({
        name: name.trim(),
        organization_id: membership.organization_id,
        parent_folder_id: parentFolderId || null,
        team_id: teamId || null,
        color: color || "#6B7280",
        icon: icon || "📁",
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Create folder error:", error);
      return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
    }

    return NextResponse.json({ folder });
  } catch (error) {
    console.error("POST folder error:", error);
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
  }
}

// UPDATE folder
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);
    if (!membership || !["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, parentFolderId, color, icon } = body;

    if (!id) {
      return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (parentFolderId !== undefined) updates.parent_folder_id = parentFolderId || null;
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;

    const { data: folder, error } = await supabase
      .from("folders")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", membership.organization_id)
      .select()
      .single();

    if (error) {
      console.error("Update folder error:", error);
      return NextResponse.json({ error: "Failed to update folder" }, { status: 500 });
    }

    return NextResponse.json({ folder });
  } catch (error) {
    console.error("PATCH folder error:", error);
    return NextResponse.json({ error: "Failed to update folder" }, { status: 500 });
  }
}

// DELETE folder
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);
    if (!membership || !["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
    }

    // Move documents in this folder to no-folder (don't delete them)
    await supabase
      .from("documents")
      .update({ folder_id: null })
      .eq("folder_id", id)
      .eq("organization_id", membership.organization_id);

    const { error } = await supabase
      .from("folders")
      .delete()
      .eq("id", id)
      .eq("organization_id", membership.organization_id);

    if (error) {
      console.error("Delete folder error:", error);
      return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 });
    }

    return NextResponse.json({ message: "Folder deleted" });
  } catch (error) {
    console.error("DELETE folder error:", error);
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 });
  }
}
