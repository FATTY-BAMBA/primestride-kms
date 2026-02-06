import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    
    // Get invitation by token first (no auth required to view basic info)
    const { data: invitation, error } = await supabase
      .from("invitations")
      .select("id, email, role, status, expires_at, created_at, organization_id")
      .eq("token", token)
      .single();

    if (error || !invitation) {
      console.error("Invitation lookup error:", error);
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Get organization name separately
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", invitation.organization_id)
      .single();

    const organizationName = org?.name || "Unknown Organization";

    // Check if invitation is still valid
    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: `This invitation has already been ${invitation.status}` },
        { status: 400 }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    // Check if user is authenticated
    const { userId } = await auth();
    
    if (!userId) {
      // Not logged in - return basic invitation info so page can show "Sign In" prompt
      return NextResponse.json({
        organization_name: organizationName,
        role: invitation.role,
        expires_at: invitation.expires_at,
        status: invitation.status,
        requires_auth: true,
        invited_email: invitation.email,
      });
    }

    // User is logged in - check if email matches
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase();

    if (invitation.email.toLowerCase() !== userEmail) {
      return NextResponse.json({
        organization_name: organizationName,
        role: invitation.role,
        expires_at: invitation.expires_at,
        status: invitation.status,
        email_mismatch: true,
        invited_email: invitation.email,
        current_email: userEmail,
        error: `This invitation was sent to ${invitation.email}. You are signed in as ${userEmail}.`
      }, { status: 403 });
    }

    // Everything is valid - return full details
    return NextResponse.json({
      organization_name: organizationName,
      email: invitation.email,
      role: invitation.role,
      expires_at: invitation.expires_at,
      status: invitation.status,
      can_accept: true,
    });
  } catch (error) {
    console.error("Error fetching invitation:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitation" },
      { status: 500 }
    );
  }
}