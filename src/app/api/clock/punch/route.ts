// src/app/api/clock/punch/route.ts
// Core clock-in/out endpoint. Validates JWT + membership, rate limits,
// writes attendance_records, audit logs.

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { verifyQrToken, isExpiredError } from '@/lib/qrToken';
import { getClockConfig } from '@/lib/clockConfig';
import { computeClockIn, computeClockOut } from '@/lib/clockPunch';
import { taipeiDateString } from '@/lib/time';
import { atlasErrors, AtlasError } from '@/lib/errors';
import { writeAuditLog } from '@/lib/auditLog';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const RATE_LIMIT_SECONDS = 10;

export async function POST(req: Request) {
  let userId: string | null = null;
  let orgId: string | null = null;

  try {
    const authResult = await auth();
    userId = authResult.userId;
    if (!userId) throw atlasErrors.unauthenticated();

    const body = await req.json().catch(() => null);
    if (!body || typeof body.token !== 'string') {
      throw atlasErrors.invalidInput('Missing token');
    }

    // Verify JWT
    let tokenPayload;
    try {
      tokenPayload = verifyQrToken(body.token);
    } catch (e) {
      if (isExpiredError(e)) throw atlasErrors.qrExpired();
      throw atlasErrors.qrInvalid({ reason: String(e) });
    }
    orgId = tokenPayload.org_id;

    // Active membership check
    const { data: membership, error: memberErr } = await supabase
      .from('organization_members')
      .select('organization_id, role, is_active')
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (memberErr) throw atlasErrors.dbError(memberErr.message);
    if (!membership) throw atlasErrors.notMember();

    // Rate limit — check for any attendance record insert in last N seconds
    const rateLimitCutoff = new Date(Date.now() - RATE_LIMIT_SECONDS * 1000).toISOString();
    const { data: recent } = await supabase
      .from('attendance_records')
      .select('id, created_at')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .gte('created_at', rateLimitCutoff)
      .limit(1)
      .maybeSingle();

    if (recent) throw atlasErrors.rateLimited();

    const config = await getClockConfig(orgId);
    const now = new Date();
    const workDate = taipeiDateString(now);

    // Today's record
    const { data: existingRecord, error: recordErr } = await supabase
      .from('attendance_records')
      .select('id, clock_in, clock_out')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('work_date', workDate)
      .maybeSingle();

    if (recordErr) throw atlasErrors.dbError(recordErr.message);

    // Incomplete prior day
    const { data: incompletePrior } = await supabase
      .from('attendance_records')
      .select('work_date')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .is('clock_out', null)
      .neq('work_date', workDate)
      .order('work_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const user = await currentUser();
    const userName = user
      ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.emailAddresses[0]?.emailAddress || null
      : null;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null;

    // CLOCK OUT
    if (existingRecord?.clock_in && !existingRecord.clock_out) {
      const result = computeClockOut({
        config,
        now,
        existingClockIn: existingRecord.clock_in,
      });

      const { error: updateErr } = await supabase
        .from('attendance_records')
        .update({
          clock_out: result.clockOutTime,
          total_hours: result.totalHours,
          overtime_hours: result.overtimeHours,
        })
        .eq('id', existingRecord.id);

      if (updateErr) throw atlasErrors.dbError(updateErr.message);

      writeAuditLog({
        organizationId: orgId,
        userId,
        userName,
        action: 'clock.punch_out',
        targetType: 'attendance_record',
        targetId: existingRecord.id,
        details: {
          total_hours: result.totalHours,
          overtime_hours: result.overtimeHours,
        },
        ipAddress: ip,
      });

      return NextResponse.json({
        ok: true,
        action: 'clock_out',
        clockOutTime: result.clockOutTime,
        totalHours: result.totalHours,
        overtimeHours: result.overtimeHours,
        incompletePriorDate: incompletePrior?.work_date ?? null,
      });
    }

    // Already done today
    if (existingRecord?.clock_in && existingRecord?.clock_out) {
      throw atlasErrors.alreadyOut({
        clockInTime: existingRecord.clock_in,
        clockOutTime: existingRecord.clock_out,
      });
    }

    // CLOCK IN
    const result = computeClockIn({ config, now });

    const { data: inserted, error: insertErr } = await supabase
      .from('attendance_records')
      .insert({
        organization_id: orgId,
        user_id: userId,
        work_date: result.workDate,
        clock_in: result.clockInTime,
        late_minutes: result.lateMinutes,
        clock_in_method: 'qr',
        status: 'approved',
      })
      .select('id')
      .single();

    if (insertErr || !inserted) throw atlasErrors.dbError(insertErr?.message ?? 'insert failed');

    writeAuditLog({
      organizationId: orgId,
      userId,
      userName,
      action: 'clock.punch_in',
      targetType: 'attendance_record',
      targetId: inserted.id,
      details: {
        late_minutes: result.lateMinutes,
        work_date: result.workDate,
      },
      ipAddress: ip,
    });

    return NextResponse.json({
      ok: true,
      action: 'clock_in',
      workDate: result.workDate,
      clockInTime: result.clockInTime,
      lateMinutes: result.lateMinutes,
      incompletePriorDate: incompletePrior?.work_date ?? null,
    });
  } catch (e) {
    // Audit the rejection (non-blocking)
    if (userId && orgId && e instanceof AtlasError) {
      writeAuditLog({
        organizationId: orgId,
        userId,
        userName: null,
        action: 'clock.punch_rejected',
        details: { code: e.code, message: e.message },
      });
    }

    if (e instanceof AtlasError) {
      return NextResponse.json(e.toResponse(), { status: e.httpStatus });
    }
    // eslint-disable-next-line no-console
    console.error('[punch] unexpected', e);
    return NextResponse.json(
      { ok: false, code: 'UNKNOWN', message: 'Internal error' },
      { status: 500 },
    );
  }
}