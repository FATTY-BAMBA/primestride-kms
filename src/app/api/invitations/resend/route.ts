import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { invitationEmail } from "@/lib/email-templates";

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

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Get user's organization membership
    const { data: myMembership } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .eq("is_active", true)
      .in("role", ["owner", "admin"])
      .single();

    if (!myMembership) {
      return NextResponse.json(
        { error: "Not authorized to resend invitations" },
        { status: 403 }
      );
    }

    // Find the existing pending invitation
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("id, token, email, role")
      .eq("email", email.toLowerCase())
      .eq("organization_id", myMembership.organization_id)
      .eq("status", "pending")
      .single();

    if (!existingInvitation) {
      return NextResponse.json(
        { error: "No pending invitation found for this email" },
        { status: 404 }
      );
    }

    // Update the invitation with new expiry and potentially new token
    const { data: updatedInvitation, error: updateError } = await supabase
      .from("invitations")
      .update({
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        token: crypto.randomUUID(), // Generate new token
      })
      .eq("id", existingInvitation.id)
      .select("id, token, email, role, expires_at")
      .single();

    if (updateError) {
      console.error("Error updating invitation:", updateError);
      throw updateError;
    }

    // Get organization name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", myMembership.organization_id)
      .single();

    // Build invite URL with new token
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const inviteUrl = `${baseUrl}/invite/${updatedInvitation.token}`;

    // Send email
    try {
      const emailContent = invitationEmail({
        inviteUrl,
        organizationName: org?.name || "Your Team",
        inviterEmail: userEmail || "A team member",
        role: updatedInvitation.role,
      });

      await resend.emails.send({
        from: process.env.EMAIL_FROM || "PrimeStride Atlas <onboarding@resend.dev>",
        to: email.toLowerCase(),
        replyTo: userEmail || undefined,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      console.log("✅ Invitation email resent to:", email);
    } catch (emailError) {
      console.error("⚠️ Failed to send email:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: `Invitation resent to ${email}`,
    });
  } catch (error) {
    console.error("Error resending invitation:", error);
    return NextResponse.json(
      { error: "Failed to resend invitation" },
      { status: 500 }
    );
  }
}