import { auth, currentUser } from "@clerk/nextjs/server";
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
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user email from Clerk
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase();

    if (!userEmail) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 });
    }

    // Get invitation (check both table names for compatibility)
    let invitation = null;
    
    // Try 'invitations' table first
    const { data: invite1, error: err1 } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invite1) {
      invitation = invite1;
    } else {
      // Try 'organization_invitations' table as fallback
      const { data: invite2 } = await supabase
        .from("organization_invitations")
        .select("*")
        .eq("token", token)
        .is("accepted_at", null)
        .single();
      
      invitation = invite2;
    }

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid or already accepted invitation" },
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

    // Check email match
    if (userEmail !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Email does not match invitation. Please sign in with the invited email address." },
        { status: 400 }
      );
    }

    // Check if user is already a member
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

    // Add user to organization
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
        { error: "Failed to add to organization" },
        { status: 500 }
      );
    }

    // Mark invitation as accepted (handle both table structures)
    if (invitation.status !== undefined) {
      // 'invitations' table with status column
      await supabase
        .from("invitations")
        .update({ status: "accepted" })
        .eq("id", invitation.id);
    } else {
      // 'organization_invitations' table with accepted_at column
      await supabase
        .from("organization_invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitation.id);
    }

    return NextResponse.json({
      success: true,
      message: "Successfully joined organization",
      organizationId: invitation.organization_id,
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}