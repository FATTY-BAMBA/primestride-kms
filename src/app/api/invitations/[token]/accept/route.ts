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

    // Call the database function to accept invitation
    const { data, error } = await supabase.rpc("accept_invitation", {
      p_token: token,
      p_user_id: userId,
    });

    if (error) {
      console.error("Accept invitation error:", error);
      
      // If the RPC function doesn't exist or doesn't accept p_user_id, do it manually
      if (error.message.includes("function") || error.message.includes("does not exist")) {
        return await acceptInvitationManually(token, userId);
      }
      
      return NextResponse.json(
        { error: error.message || "Failed to accept invitation" },
        { status: 400 }
      );
    }

    // The function returns a JSONB object
    const result = data as {
      success: boolean;
      error?: string;
      message?: string;
      organization_id?: string;
      organization_name?: string;
      role?: string;
    };

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to accept invitation" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Successfully joined organization",
      organization_id: result.organization_id,
      organization_name: result.organization_name,
      role: result.role,
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}

// Fallback manual acceptance if RPC doesn't work
async function acceptInvitationManually(token: string, userId: string) {
  try {
    // Get invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .select("*, organizations(name)")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (inviteError || !invitation) {
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
      organization_name: invitation.organizations?.name || "Organization",
      role: invitation.role,
    });
  } catch (error) {
    console.error("Manual acceptance error:", error);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}