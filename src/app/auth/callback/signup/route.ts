import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: 'User has no organization' },
        { status: 400 }
      );
    }

    if (!['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only admins can invite team members' },
        { status: 403 }
      );
    }

    // Check if already a member
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .eq('organization_id', profile.organization_id)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'User is already in this organization' },
        { status: 400 }
      );
    }

    // Generate token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invitation, error: inviteError } = await supabase
      .from('organization_invitations')
      .insert({
        organization_id: profile.organization_id,
        email: email.toLowerCase(),
        role,
        token,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      if (inviteError.code === '23505') {
        return NextResponse.json(
          { error: 'Invitation already sent to this email' },
          { status: 400 }
        );
      }
      throw inviteError;
    }

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/signup?invite=${token}`;

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