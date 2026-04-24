// src/app/api/_test-clock-config/route.ts
// TEMPORARY — delete after PR 1 verification
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { getClockConfig } from '@/lib/clockConfig';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: membership, error: memberErr } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (memberErr) {
    return NextResponse.json(
      { error: 'membership query failed', details: memberErr.message },
      { status: 500 },
    );
  }

  if (!membership) {
    return NextResponse.json(
      { error: 'no org membership found for user', userId },
      { status: 404 },
    );
  }

  try {
    const config = await getClockConfig(membership.organization_id);
    return NextResponse.json({
      ok: true,
      userId,
      orgId: membership.organization_id,
      role: membership.role,
      config,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'getClockConfig failed', details: String(e) },
      { status: 500 },
    );
  }
}
