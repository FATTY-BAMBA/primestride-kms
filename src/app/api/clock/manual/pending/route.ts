// src/app/api/clock/manual/pending/route.ts
// Admin-only: list pending manual entry requests for the admin's organization.

import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { atlasErrors, AtlasError } from '@/lib/errors';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type PendingRequest = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string | null;
  work_date: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  reason_code: string;
  reason_note: string | null;
  created_at: string;
};

// =====================================================================
// GET — List pending manual entry requests for the admin's organization
// =====================================================================
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) throw atlasErrors.unauthenticated();

    // Resolve admin's org and verify role
    const { data: membership, error: memErr } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (memErr) throw atlasErrors.dbError(memErr.message);
    if (!membership) throw atlasErrors.adminRequired();
    if (membership.role !== 'admin' && membership.role !== 'owner') {
      throw atlasErrors.adminRequired();
    }

    const orgId = membership.organization_id;

    // Fetch all member user_ids in this org (so we can scope the request query)
    const { data: members, error: mErr } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('is_active', true);

    if (mErr) throw atlasErrors.dbError(mErr.message);
    const memberIds = (members ?? []).map((m) => m.user_id);
    if (memberIds.length === 0) {
      return NextResponse.json({ ok: true, requests: [] });
    }

    // Pending requests for org members, last 30 days, oldest first (FIFO queue)
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error: rErr } = await supabase
      .from('manual_entry_requests')
      .select(
        'id, user_id, work_date, requested_clock_in, requested_clock_out, reason_code, reason_note, created_at',
      )
      .eq('status', 'pending')
      .in('user_id', memberIds)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(200);

    if (rErr) throw atlasErrors.dbError(rErr.message);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ ok: true, requests: [] });
    }

    // Resolve names + emails for the requesters via Clerk
    const uniqueUserIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const client = await clerkClient();
    const userInfo: Record<string, { name: string; email: string | null }> = {};

    await Promise.all(
      uniqueUserIds.map(async (uid) => {
        try {
          const u = await client.users.getUser(uid);
          const fullName =
            [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
            u.username ||
            u.emailAddresses[0]?.emailAddress ||
            uid.slice(0, 12);
          userInfo[uid] = {
            name: fullName,
            email: u.emailAddresses[0]?.emailAddress ?? null,
          };
        } catch {
          userInfo[uid] = { name: uid.slice(0, 12), email: null };
        }
      }),
    );

    const requests: PendingRequest[] = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_name: userInfo[r.user_id]?.name ?? r.user_id.slice(0, 12),
      user_email: userInfo[r.user_id]?.email ?? null,
      work_date: r.work_date,
      requested_clock_in: r.requested_clock_in,
      requested_clock_out: r.requested_clock_out,
      reason_code: r.reason_code,
      reason_note: r.reason_note,
      created_at: r.created_at,
    }));

    return NextResponse.json({ ok: true, requests });
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