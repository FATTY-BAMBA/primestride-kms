import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { invitationEmail } from "@/lib/email-templates";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

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

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress;

    const { email, role = "member" } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    // Get user's organization membership
    const myMembership = await getUserOrganization(userId);

    if (!myMembership?.organization_id) {
      return NextResponse.json(
        { error: "Not authorized to send invitations" },
        { status: 403 }
      );
    }

    // Check if already a pending invitation exists
    const { data: existingInvite } = await supabase
      .from("invitations")
      .select("id")
      .eq("email", email.toLowerCase())
      .eq("organization_id", myMembership.organization_id)
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: "Invitation already sent to this email" },
        { status: 400 }
      );
    }

    // Check if user is already a member (by checking profiles + memberships)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existingProfile) {
      const { data: existingMember } = await supabase
        .from("organization_members")
        .select("id")
        .eq("user_id", existingProfile.id)
        .eq("organization_id", myMembership.organization_id)
        .single();

      if (existingMember) {
        return NextResponse.json(
          { error: "User is already a member of this organization" },
          { status: 400 }
        );
      }
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .insert({
        organization_id: myMembership.organization_id,
        email: email.toLowerCase(),
        role: role,
        invited_by: userId,
        status: "pending",
      })
      .select("id, token, email, role, created_at, expires_at")
      .single();

    if (inviteError) {
      console.error("Error creating invitation:", inviteError);
      throw inviteError;
    }

    // Get organization name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", myMembership.organization_id)
      .single();

    // Build invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const inviteUrl = `${baseUrl}/invite/${invitation.token}`;

    // Send email
    try {
      const emailContent = invitationEmail({
        inviteUrl,
        organizationName: org?.name || "Your Team",
        inviterEmail: userEmail || "A team member",
        role,
      });

      await resend.emails.send({
        from: process.env.EMAIL_FROM || "PrimeStride Atlas <onboarding@resend.dev>",
        to: email.toLowerCase(),
        replyTo: userEmail || undefined,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      console.log("✅ Invitation email sent to:", email);
    } catch (emailError) {
      console.error("⚠️ Failed to send email:", emailError);
      // Don't fail - invitation is still created
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        inviteUrl,
        expiresAt: invitation.expires_at,
      },
      message: `Invitation sent to ${email}`,
    });
  } catch (error) {
    console.error("Error sending invitation:", error);
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    );
  }
}