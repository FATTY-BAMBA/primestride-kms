import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  console.log('🚀 Signup API called');
  
  try {
    const supabase = await createClient();
    const { email, password, companyName, inviteToken } = await request.json();
    
    console.log('📧 Email:', email);
    console.log('🏢 Company:', companyName || '(via invite)');

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Validate organization name if not joining via invite
    if (!inviteToken && !companyName?.trim()) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }

    // Get the app URL for email redirect
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    // 1. Create user with Supabase Auth
    console.log('👤 Creating auth user...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        emailRedirectTo: inviteToken 
          ? `${appUrl}/invite/${inviteToken}`
          : `${appUrl}/auth/callback`,
        data: {
          company_name: companyName,
        }
      }
    });

    if (authError) {
      console.error('❌ Auth error:', authError);
      
      // Handle specific errors
      if (authError.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in instead.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      console.error('❌ No user created');
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    console.log('✅ User created:', authData.user.id);

    // 2. Check if signing up via invitation
    if (inviteToken) {
      console.log('🎫 Checking invitation token...');
      const { data: invitation, error: inviteError } = await supabase
        .from('invitations')
        .select('organization_id, role, email, status, expires_at')
        .eq('token', inviteToken)
        .eq('status', 'pending')
        .single();

      if (inviteError) {
        console.log('⚠️ Invitation lookup error:', inviteError.message);
      }

      if (invitation) {
        // Check if invitation is valid
        if (invitation.email.toLowerCase() !== email.toLowerCase()) {
          console.log('⚠️ Email mismatch - invitation for different email');
        } else if (new Date(invitation.expires_at) < new Date()) {
          console.log('⚠️ Invitation expired');
        } else {
          console.log('✅ Valid invitation found - user will be added after email confirmation');
          // The user will be added to the organization when they confirm email
          // and the accept_invitation function is called
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Please check your email to confirm your account.',
        requiresEmailConfirmation: true,
      });
    }

    // 3. Create organization using SECURITY DEFINER function (bypasses RLS)
    console.log('🏢 Creating organization...');
    
    const orgSlug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);

    console.log('📝 Org name:', companyName);
    console.log('📝 Slug:', orgSlug);

    // Use the SECURITY DEFINER function to create org + membership
    const { data: orgId, error: orgError } = await supabase
      .rpc('create_organization_for_user', {
        p_user_id: authData.user.id,
        p_org_name: companyName.trim(),
        p_org_slug: orgSlug,
      });

    if (orgError) {
      console.error('❌ Organization creation error:', orgError);
      
      // If org creation fails, the user still exists but without an org
      // They can still confirm email and we can fix this later
      console.log('⚠️ User created but org creation failed - user can still confirm email');
      
      return NextResponse.json({
        success: true,
        message: 'Please check your email to confirm your account.',
        requiresEmailConfirmation: true,
        warning: 'Organization setup will complete after email confirmation.',
      });
    }

    console.log('✅ Organization created:', orgId);

    // 4. Create profile
    console.log('👤 Creating profile...');
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: email.toLowerCase().trim(),
        full_name: companyName.trim(), // Use company name as initial name
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('⚠️ Profile creation error:', profileError);
      // Non-fatal - profile can be created later
    } else {
      console.log('✅ Profile created');
    }

    return NextResponse.json({
      success: true,
      message: 'Please check your email to confirm your account.',
      requiresEmailConfirmation: true,
      userId: authData.user.id,
      organizationId: orgId,
    });

  } catch (error) {
    console.error('❌❌❌ FATAL ERROR:', error);
    return NextResponse.json(
      {
        error: 'Failed to create account. Please try again.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}