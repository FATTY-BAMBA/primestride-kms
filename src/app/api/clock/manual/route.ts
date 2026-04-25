// src/app/api/clock/manual/route.ts
// Employee submits manual entry request (POST) and lists their own (GET).

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { getClockConfig } from '@/lib/clockConfig';
import {
  validateRequestWindow,
  validateTimes,
  detectConflict,
  computeComplianceWarnings,
  type ReasonCode,
} from '@/lib/manualEntry';
import { atlasErrors, AtlasError } from '@/lib/errors';
import { writeAuditLog } from '@/lib/auditLog';
import { sendManualEntrySubmittedEmail } from '@/lib/email/templates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const VALID_REASONS: ReasonCode[] = ['phone_dead', 'forgot', 'travel', 'system_issue', 'other'];

// =====================================================================
// POST — Submit a new manual entry request
// =====================================================================
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) throw atlasErrors.unauthenticated();

    const body = await req.json().catch(() => null);
    if (!body) throw atlasErrors.invalidInput('Invalid JSON');

    const {
      workDate,
      requestedClockIn,
      requestedClockOut,
      reasonCode,
      reasonNote,
    } = body as {
      workDate?: string;
      requestedClockIn?: string | null;
      requestedClockOut?: string | null;
      reasonCode?: string;
      reasonNote?: string | null;
    };

    if (!workDate || typeof workDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      throw atlasErrors.invalidInput('workDate must be YYYY-MM-DD');
    }
    if (!reasonCode || !VALID_REASONS.includes(reasonCode as ReasonCode)) {
      throw atlasErrors.invalidInput('Invalid reasonCode');
    }

    // Active membership
    const { data: membership, error: memberErr } = await supabase
      .from('organization_members')
      .select('organization_id, role, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (memberErr) throw atlasErrors.dbError(memberErr.message);
    if (!membership) throw atlasErrors.notMember();

    const orgId = membership.organization_id;
    const config = await getClockConfig(orgId);

    // Validate window
    const windowCheck = validateRequestWindow(workDate, config);
    if (!windowCheck.ok) {
      const code = windowCheck.reason === 'work_date_in_future' ? 'WORK_DATE_IN_FUTURE' : 'WORK_DATE_TOO_OLD';
      throw new AtlasError(
        code as 'INVALID_INPUT',
        windowCheck.reason,
        400,
        { window_days: config.manual_entry_window_days },
      );
    }

    // Validate times
    const timesCheck = validateTimes(requestedClockIn ?? null, requestedClockOut ?? null);
    if (!timesCheck.ok) {
      const code = timesCheck.reason === 'missing_times' ? 'MISSING_TIMES' : 'CLOCK_IN_NOT_BEFORE_OUT';
      throw new AtlasError(code as 'INVALID_INPUT', timesCheck.reason, 400);
    }

    // Check for duplicate pending request for same date
    const { data: existingPending } = await supabase
      .from('manual_entry_requests')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('work_date', workDate)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (existingPending) {
      throw new AtlasError('INVALID_INPUT' as never, 'duplicate_pending', 409, {
        code: 'DUPLICATE_PENDING',
      });
    }

    // Conflict detection — load existing attendance record for that date
    const { data: existingRecord } = await supabase
      .from('attendance_records')
      .select('id, clock_in, clock_out')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('work_date', workDate)
      .maybeSingle();

    const conflict = detectConflict(
      {
        workDate,
        requestedClockIn: requestedClockIn ?? null,
        requestedClockOut: requestedClockOut ?? null,
        reasonCode: reasonCode as ReasonCode,
        reasonNote: reasonNote ?? null,
      },
      existingRecord,
    );

    if (conflict.kind === 'overlap') {
      const code =
        conflict.reason === 'record_already_complete'
          ? 'RECORD_ALREADY_COMPLETE'
          : 'UNMERGEABLE_CONFLICT';
      throw new AtlasError(code as never, conflict.reason, 409);
    }

    // Compute compliance warnings (stub for now)
    const warnings = computeComplianceWarnings(
      {
        workDate,
        requestedClockIn: requestedClockIn ?? null,
        requestedClockOut: requestedClockOut ?? null,
        reasonCode: reasonCode as ReasonCode,
        reasonNote: reasonNote ?? null,
      },
      existingRecord,
      config,
    );

    // Resolve user identity
    const user = await currentUser();
    const userName = user
      ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
        user.emailAddresses[0]?.emailAddress ||
        null
      : null;

    // Insert request
    const { data: inserted, error: insertErr } = await supabase
      .from('manual_entry_requests')
      .insert({
        organization_id: orgId,
        user_id: userId,
        user_name: userName,
        work_date: workDate,
        requested_clock_in: requestedClockIn ?? null,
        requested_clock_out: requestedClockOut ?? null,
        reason_code: reasonCode,
        reason_note: reasonNote ?? null,
        status: 'pending',
        compliance_warnings: warnings.length > 0 ? warnings : null,
      })
      .select('id, work_date, status, created_at')
      .single();

    if (insertErr || !inserted) throw atlasErrors.dbError(insertErr?.message ?? 'insert failed');

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      userId,
      userName,
      action: 'clock.punch_in', // reuse action; details disambiguates
      targetType: 'manual_entry_request',
      targetId: inserted.id,
      details: {
        type: 'manual_entry_submitted',
        work_date: workDate,
        reason_code: reasonCode,
        merge_target: conflict.kind === 'merge_clock_out' ? conflict.existingRecordId : null,
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
    });

    // Notify org admins/owners (non-blocking)
    notifyAdmins(orgId, userId, {
      requesterName: userName ?? 'Unknown',
      workDate,
      requestedClockIn: requestedClockIn ?? null,
      requestedClockOut: requestedClockOut ?? null,
      reasonCode: reasonCode as ReasonCode,
      reasonNote: reasonNote ?? null,
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[manual] admin notification failed', e);
    });

    return NextResponse.json({
      ok: true,
      request: inserted,
      mergeTarget: conflict.kind === 'merge_clock_out' ? conflict.existingRecordId : null,
      complianceWarnings: warnings,
    });
  } catch (e) {
    if (e instanceof AtlasError) {
      return NextResponse.json(e.toResponse(), { status: e.httpStatus });
    }
    // eslint-disable-next-line no-console
    console.error('[manual] unexpected', e);
    return NextResponse.json(
      { ok: false, code: 'UNKNOWN', message: 'Internal error' },
      { status: 500 },
    );
  }
}

// =====================================================================
// GET — List the requesting user's own manual entry requests (last 30 days)
// =====================================================================
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) throw atlasErrors.unauthenticated();

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('manual_entry_requests')
      .select(
        'id, work_date, requested_clock_in, requested_clock_out, reason_code, reason_note, status, resolution_note, resolved_at, created_at',
      )
      .eq('user_id', userId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw atlasErrors.dbError(error.message);

    return NextResponse.json({ ok: true, requests: data ?? [] });
  } catch (e) {
    if (e instanceof AtlasError) {
      return NextResponse.json(e.toResponse(), { status: e.httpStatus });
    }
    return NextResponse.json({ ok: false, code: 'UNKNOWN', message: 'Internal error' }, { status: 500 });
  }
}

// =====================================================================
// Helper — notify admins via email (best-effort, non-blocking)
// =====================================================================
type NotifyContext = {
  requesterName: string;
  workDate: string;
  requestedClockIn: string | null;
  requestedClockOut: string | null;
  reasonCode: ReasonCode;
  reasonNote: string | null;
};

async function notifyAdmins(orgId: string, requesterUserId: string, ctx: NotifyContext): Promise<void> {
  // Find admins/owners
  const { data: admins } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .in('role', ['admin', 'owner']);

  if (!admins || admins.length === 0) return;

  // Map Clerk user ids → email addresses
  // We need to fetch user details from Clerk
  const { clerkClient } = await import('@clerk/nextjs/server');
  const client = await clerkClient();

  const emails: string[] = [];
  for (const a of admins) {
    try {
      const u = await client.users.getUser(a.user_id);
      const e = u.emailAddresses[0]?.emailAddress;
      if (e) emails.push(e);
    } catch {
      // skip users we can't resolve
    }
  }

  if (emails.length === 0) return;

  const reasonLabels: Record<ReasonCode, string> = {
    phone_dead: '手機沒電 / Phone died',
    forgot: '忘記打卡 / Forgot to punch',
    travel: '出差 / Travel',
    system_issue: '系統問題 / System issue',
    other: '其他 / Other',
  };

  const dashboardUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.primestrideatlas.com') +
    '/admin#attendance-review';

  await sendManualEntrySubmittedEmail(emails, {
    organizationId: orgId,
    requesterUserId,
    requesterName: ctx.requesterName,
    workDate: ctx.workDate,
    requestedClockIn: ctx.requestedClockIn,
    requestedClockOut: ctx.requestedClockOut,
    reasonLabel: reasonLabels[ctx.reasonCode],
    reasonNote: ctx.reasonNote,
    dashboardUrl,
  });
}
