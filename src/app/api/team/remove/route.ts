import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get current user's membership
    const { data: myMembership } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", clerkUserId)
      .eq("is_active", true)
      .in("role", ["owner", "admin"])
      .single();

    if (!myMembership) {
      return NextResponse.json(
        { error: "Not authorized to remove members" },
        { status: 403 }
      );
    }

    // Can't remove yourself
    if (userId === clerkUserId) {
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

    // Remove the member
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