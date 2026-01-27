import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'User ID and role are required' },
        { status: 400 }
      );
    }

    if (!['member', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
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
        { error: 'Only admins can change roles' },
        { status: 403 }
      );
    }

    // Check if trying to change own role
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 400 }
      );
    }

    // Check if user is in same organization
    const { data: targetUser } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', userId)
      .single();

    if (targetUser?.organization_id !== profile?.organization_id) {
      return NextResponse.json(
        { error: 'User not in your organization' },
        { status: 403 }
      );
    }

    // Cannot change owner role
    if (targetUser?.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot change owner role' },
        { status: 403 }
      );
    }

    // Update role
    await supabase
      .from('users')
      .update({ role })
      .eq('id', userId);

    return NextResponse.json({
      success: true,
      message: 'Role updated successfully',
    });
  } catch (error) {
    console.error('Error changing role:', error);
    return NextResponse.json(
      { error: 'Failed to change role' },
      { status: 500 }
    );
  }
}