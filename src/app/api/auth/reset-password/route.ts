import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Log environment variables to debug
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const redirectTo = `${appUrl}/auth/callback?next=/update-password`;
    
    console.log('📧 Sending reset email to:', email);
    console.log('🌐 NEXT_PUBLIC_APP_URL:', appUrl);
    console.log('🔗 redirectTo:', redirectTo);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo,
    });

    if (error) {
      console.error('❌ Supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.log('✅ Reset email sent successfully');

    return NextResponse.json({
      success: true,
      message: 'Check your email for the password reset link!',
    });
  } catch (error) {
    console.error('❌ Server error:', error);
    return NextResponse.json(
      { error: 'Failed to send reset email' },
      { status: 500 }
    );
  }
}