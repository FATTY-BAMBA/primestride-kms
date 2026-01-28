import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's membership
    const { data: myMembership } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .limit(1)
      .single();

    if (!myMembership) {
      return NextResponse.json(
        { error: "Not authorized to remove members" },
        { status: 403 }
      );
    }

    // Can't remove yourself
    if (userId === user.id) {
      return NextResponse.json(
        { error: "Cannot remove yourself" },
        { status: 400 }
      );
    }

    // Get the target member's membership
    const { data: targetMembership } = await supabase
      .from("organization_members")
      .select("id, role")
      .eq("user_id", userId)
      .eq("organization_id", myMembership.organization_id)
      .single();

    if (!targetMembership) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Can't remove owner
    if (targetMembership.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove organization owner" },
        { status: 403 }
      );
    }

    // Admins can only remove members, not other admins
    if (myMembership.role === "admin" && targetMembership.role === "admin") {
      return NextResponse.json(
        { error: "Admins cannot remove other admins" },
        { status: 403 }
      );
    }

    // Remove the member (soft delete by setting is_active = false, or hard delete)
    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("id", targetMembership.id);

    if (error) {
      console.error("Error removing member:", error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in remove member API:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}