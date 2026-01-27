import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { invitationEmail } from '@/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { email, role } = await request.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (!['admin', 'owner'].includes(profile?.role || '')) {
      return NextResponse.json(
        { error: 'Only admins can resend invitations' },
        { status: 403 }
      );
    }

    // Delete old invitation
    await supabase
      .from('organization_invitations')
      .delete()
      .eq('email', email.toLowerCase())
      .eq('organization_id', profile?.organization_id);

    // Create new invitation with new token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invitation } = await supabase
      .from('organization_invitations')
      .insert({
        organization_id: profile?.organization_id,
        email: email.toLowerCase(),
        role,
        token,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    // Get organization name for email
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', profile?.organization_id)
      .single();

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/signup?invite=${token}`;

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
        reply_to: user.email || undefined,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      console.log('✅ Invitation email resent to:', email);
    } catch (emailError) {
      console.error('⚠️ Failed to send email:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: `Invitation resent to ${email}`,
    });
  } catch (error) {
    console.error('Error resending invitation:', error);
    return NextResponse.json(
      { error: 'Failed to resend invitation' },
      { status: 500 }
    );
  }
}