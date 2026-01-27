import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  console.log('🚀 Signup API called');
  
  try {
    const supabase = await createClient();
    const { email, password, companyName, inviteToken } = await request.json();
    
    console.log('📧 Email:', email);
    console.log('🏢 Company:', companyName);

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // 1. Create user with Supabase Auth
    console.log('👤 Creating auth user...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.error('❌ Auth error:', authError);
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
      const { data: invitation } = await supabase
        .from('organization_invitations')
        .select('organization_id, role, email')
        .eq('token', inviteToken)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (invitation && invitation.email.toLowerCase() === email.toLowerCase()) {
        console.log('✅ Valid invitation found');
        await supabase
          .from('users')
          .update({
            organization_id: invitation.organization_id,
            role: invitation.role,
          })
          .eq('id', authData.user.id);

        await supabase
          .from('organization_invitations')
          .update({ accepted_at: new Date().toISOString() })
          .eq('token', inviteToken);

        return NextResponse.json({
          success: true,
          message: 'Account created and joined organization!',
          user: authData.user,
        });
      }
    }

    // 3. Create new organization
    const slug = (companyName || email)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    console.log('🏢 Creating organization...');
    console.log('📝 Org name:', companyName || `${email}'s Organization`);
    console.log('📝 Slug:', `${slug}-${Date.now()}`);

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: companyName || `${email}'s Organization`,
        slug: `${slug}-${Date.now()}`,
      })
      .select()
      .single();

    if (orgError) {
      console.error('❌ Organization creation error:', orgError);
      console.error('❌ Error code:', orgError.code);
      console.error('❌ Error message:', orgError.message);
      console.error('❌ Error details:', orgError.details);
      return NextResponse.json(
        { 
          error: 'Failed to create organization', 
          details: orgError.message,
          code: orgError.code 
        },
        { status: 500 }
      );
    }

    console.log('✅ Organization created:', org.id);

    // 4. Assign user to organization
    console.log('👤 Updating user with organization...');
    const { error: updateError } = await supabase
      .from('users')
      .update({
        organization_id: org.id,
        role: 'owner',
      })
      .eq('id', authData.user.id);

    if (updateError) {
      console.error('❌ User update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to assign organization', details: updateError.message },
        { status: 500 }
      );
    }

    console.log('✅ User updated successfully');

    return NextResponse.json({
      success: true,
      message: 'Account and organization created successfully!',
      user: authData.user,
      organization: org,
    });
  } catch (error) {
    console.error('❌❌❌ FATAL ERROR:', error);
    console.error('Error type:', typeof error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'no stack');
    return NextResponse.json(
      {
        error: 'Failed to create account',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}