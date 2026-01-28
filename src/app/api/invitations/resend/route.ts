import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { invitationEmail } from "@/lib/email-templates";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { email, role = "member" } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization membership
    const { data: myMembership } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .limit(1)
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
        inviterEmail: user.email || "A team member",
        role: updatedInvitation.role,
      });

      await resend.emails.send({
        from: process.env.EMAIL_FROM || "PrimeStride Atlas <onboarding@resend.dev>",
        to: email.toLowerCase(),
        replyTo: user.email || undefined,
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