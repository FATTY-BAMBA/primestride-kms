import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
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
        { error: 'Only admins can remove members' },
        { status: 403 }
      );
    }

    // Check if trying to remove self
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'You cannot remove yourself' },
        { status: 400 }
      );
    }

    // Check if user being removed is in same organization
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

    // Cannot remove owners
    if (targetUser?.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove organization owner' },
        { status: 403 }
      );
    }

    // Remove user from organization
    await supabase
      .from('users')
      .update({ organization_id: null, role: 'user' })
      .eq('id', userId);

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}