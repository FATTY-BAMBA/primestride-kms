import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json(
        { error: "User ID and role are required" },
        { status: 400 }
      );
    }

    if (!["member", "admin"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'member' or 'admin'" },
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
        { error: "Not authorized to change roles" },
        { status: 403 }
      );
    }

    // Can't change your own role
    if (userId === user.id) {
      return NextResponse.json(
        { error: "Cannot change your own role" },
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

    // Can't change owner's role
    if (targetMembership.role === "owner") {
      return NextResponse.json(
        { error: "Cannot change organization owner's role" },
        { status: 403 }
      );
    }

    // Admins can only change members, not other admins
    if (myMembership.role === "admin" && targetMembership.role === "admin") {
      return NextResponse.json(
        { error: "Admins cannot change other admins' roles" },
        { status: 403 }
      );
    }

    // Only owners can promote to admin
    if (role === "admin" && myMembership.role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can promote members to admin" },
        { status: 403 }
      );
    }

    // Update the role
    const { error } = await supabase
      .from("organization_members")
      .update({ role })
      .eq("id", targetMembership.id);

    if (error) {
      console.error("Error changing role:", error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in change role API:", error);
    return NextResponse.json(
      { error: "Failed to change role" },
      { status: 500 }
    );
  }
}