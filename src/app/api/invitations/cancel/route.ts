import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

// Create Supabase admin client
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

    const { invitationId } = await request.json();

    if (!invitationId) {
      return NextResponse.json(
        { error: "Invitation ID is required" },
        { status: 400 }
      );
    }

    // Get user's organization membership
    const myMembership = await getUserOrganization(userId);

    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      return NextResponse.json(
        { error: "Not authorized to cancel invitations" },
        { status: 403 }
      );
    }

    // Verify the invitation belongs to this organization
    const { data: invitation } = await supabase
      .from("invitations")
      .select("id, organization_id")
      .eq("id", invitationId)
      .single();

    if (!invitation || invitation.organization_id !== myMembership.organization_id) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Update status to cancelled
    const { error } = await supabase
      .from("invitations")
      .update({ status: "cancelled" })
      .eq("id", invitationId);

    if (error) {
      console.error("Error cancelling invitation:", error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in cancel invitation API:", error);
    return NextResponse.json(
      { error: "Failed to cancel invitation" },
      { status: 500 }
    );
  }
}