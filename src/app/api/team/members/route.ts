import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'; // Add this line

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: 'User has no organization' },
        { status: 400 }
      );
    }

    const { data: members, error: membersError } = await supabase
      .from('users')
      .select('id, email, full_name, role, created_at')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: true });

    if (membersError) {
      throw membersError;
    }

    const { data: pendingInvites } = await supabase
      .from('organization_invitations')
      .select('id, email, role, created_at, expires_at')
      .eq('organization_id', profile.organization_id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    return NextResponse.json({
      members: members || [],
      pending_invitations: pendingInvites || [],
      total_members: members?.length || 0,
      total_pending: pendingInvites?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch team members',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}