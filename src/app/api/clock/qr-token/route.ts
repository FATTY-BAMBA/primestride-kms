// src/app/api/clock/qr-token/route.ts
// Admin-only endpoint returning a fresh 60s QR token.

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { signQrToken, QR_TOKEN_TTL_SECONDS } from '@/lib/qrToken';
import { getClockConfig } from '@/lib/clockConfig';
import { atlasErrors, AtlasError } from '@/lib/errors';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) throw atlasErrors.unauthenticated();

    const { data: membership, error: memberErr } = await supabase
      .from('organization_members')
      .select('organization_id, role, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (memberErr) throw atlasErrors.dbError(memberErr.message);
    if (!membership) throw atlasErrors.notMember();
    if (!['admin', 'owner'].includes(membership.role)) throw atlasErrors.adminRequired();

    const config = await getClockConfig(membership.organization_id);
    const token = signQrToken({
      org_id: membership.organization_id,
      location_label: config.location_label ?? '總公司',
    });

    return NextResponse.json({
      ok: true,
      token,
      ttlSeconds: QR_TOKEN_TTL_SECONDS,
      locationLabel: config.location_label ?? '總公司',
    });
  } catch (e) {
    if (e instanceof AtlasError) {
      return NextResponse.json(e.toResponse(), { status: e.httpStatus });
    }
    return NextResponse.json(
      { ok: false, code: 'UNKNOWN', message: 'Internal error' },
      { status: 500 },
    );
  }
}