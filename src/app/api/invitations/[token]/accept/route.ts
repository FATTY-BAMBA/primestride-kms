import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get invitation (without join)
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .select("id, email, role, status, expires_at, organization_id")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (inviteError || !invitation) {
      console.error("Invitation lookup error:", inviteError);
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 400 }
      );
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 400 }
      );
    }

    // Get organization name separately
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", invitation.organization_id)
      .single();

    const organizationName = org?.name || "Organization";

    // Check if already a member
    const { data: existingMember } = await supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", invitation.organization_id)
      .single();

    if (existingMember) {
      return NextResponse.json(
        { error: "You are already a member of this organization" },
        { status: 400 }
      );
    }

    // Add to organization
    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({
        user_id: userId,
        organization_id: invitation.organization_id,
        role: invitation.role,
        is_active: true,
      });

    if (memberError) {
      console.error("Error adding member:", memberError);
      return NextResponse.json(
        { error: "Failed to join organization" },
        { status: 500 }
      );
    }

    // Mark invitation as accepted
    await supabase
      .from("invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id);

    return NextResponse.json({
      success: true,
      message: "Successfully joined organization",
      organization_id: invitation.organization_id,
      organization_name: organizationName,
      role: invitation.role,
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}