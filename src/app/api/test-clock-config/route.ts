// src/app/api/test-clock-config/route.ts
// TEMPORARY — delete after PR 1 verification
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { getClockConfig } from '@/lib/clockConfig';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  // Find active membership. Service role bypasses RLS; identity from Clerk.
  const { data: membership, error: memberErr } = await supabase
    .from('organization_members')
    .select('organization_id, role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
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
      { error: 'no active org membership found for user', userId },
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