import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { invitationEmail } from '@/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { email, role = 'member' } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user's organization membership
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (!membership?.organization_id) {
      return NextResponse.json(
        { error: 'User has no organization' },
        { status: 400 }
      );
    }

    if (!['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only admins can invite team members' },
        { status: 403 }
      );
    }

    // Check if user already has invitation pending
    const { data: existingInvite } = await supabase
      .from('organization_invitations')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('organization_id', membership.organization_id)
      .is('accepted_at', null)
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: 'Invitation already sent to this email' },
        { status: 400 }
      );
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id, user_id')
      .eq('organization_id', membership.organization_id)
      .single();

    if (existingMember) {
      // Get the user's email to check
      const { data: existingUserData } = await supabase
        .from('auth.users')
        .select('email')
        .eq('id', existingMember.user_id)
        .single();

      if (existingUserData?.email === email.toLowerCase()) {
        return NextResponse.json(
          { error: 'User is already in this organization' },
          { status: 400 }
        );
      }
    }

    // Generate secure token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invitation, error: inviteError } = await supabase
      .from('organization_invitations')
      .insert({
        organization_id: membership.organization_id,
        email: email.toLowerCase(),
        role,
        token,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      if (inviteError.code === '23505') {
        return NextResponse.json(
          { error: 'Invitation already sent to this email' },
          { status: 400 }
        );
      }
      throw inviteError;
    }

    // Get organization name for email
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', membership.organization_id)
      .single();

    // FIXED: Use /invite/[token] format with production URL
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      console.error('⚠️ NEXT_PUBLIC_APP_URL is not set!');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

    // Send email
    try {
      const emailContent = invitationEmail({
        inviteUrl,
        organizationName: org?.name || 'Your Team',
        inviterEmail: user.email || 'A team member',
        role,
      });

      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'PrimeStride Atlas <onboarding@resend.dev>',
        to: email.toLowerCase(),
        replyTo: user.email || undefined,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      console.log('✅ Invitation email sent to:', email);
      console.log('📧 Invite URL:', inviteUrl);
    } catch (emailError) {
      console.error('⚠️ Failed to send email:', emailError);
      // Don't fail the whole request if email fails
      // The invitation is still created, just email didn't send
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
    console.error('Error sending invitation:', error);
    return NextResponse.json(
      {
        error: 'Failed to send invitation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}