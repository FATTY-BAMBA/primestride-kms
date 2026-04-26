// src/app/api/clock/manual/[id]/approve/route.ts
// Admin approves a single manual entry request.
//
// Flow:
//   1. Auth: signed-in admin/owner of the request's org
//   2. Call approveRequest() — atomic DB ops + audit version
//   3. Look up requester email via Clerk
//   4. Send approval email (non-blocking)
//   5. Audit log

import { NextResponse } from 'next/server';
import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { approveRequest } from '@/lib/manualApproval';
import { atlasErrors, AtlasError } from '@/lib/errors';
import { writeAuditLog } from '@/lib/auditLog';
import { sendManualEntryApprovedEmail } from '@/lib/email/templates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) throw atlasErrors.unauthenticated();

    const { id: requestId } = await ctx.params;
    if (!requestId || typeof requestId !== 'string') {
      throw atlasErrors.invalidInput('Missing request id');
    }

    // Optional resolution note (admin's reason for approving)
    const body = await req.json().catch(() => ({} as { note?: string }));
    const resolutionNote = typeof body.note === 'string' && body.note.trim()
      ? body.note.trim().slice(0, 1000)
      : null;

    // Load the request first to learn its org (so we can verify admin in that org)
    const { data: requestRow, error: loadErr } = await supabase
      .from('manual_entry_requests')
      .select('id, organization_id, user_id, user_name, work_date, requested_clock_in, requested_clock_out')
      .eq('id', requestId)
      .maybeSingle();

    if (loadErr) throw atlasErrors.dbError(loadErr.message);
    if (!requestRow) {
      return NextResponse.json(
        { ok: false, code: 'NOT_FOUND', message: 'Request not found' },
        { status: 404 },
      );
    }

    // Verify caller is admin/owner of the request's org
    const { data: membership, error: memberErr } = await supabase
      .from('organization_members')
      .select('organization_id, role, is_active')
      .eq('user_id', userId)
      .eq('organization_id', requestRow.organization_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (memberErr) throw atlasErrors.dbError(memberErr.message);
    if (!membership) throw atlasErrors.notMember();
    if (!['admin', 'owner'].includes(membership.role)) throw atlasErrors.adminRequired();

    // Resolve approver name from Clerk
    const approverUser = await currentUser();
    const approverName = approverUser
      ? `${approverUser.firstName ?? ''} ${approverUser.lastName ?? ''}`.trim() ||
        approverUser.emailAddresses[0]?.emailAddress ||
        'Admin'
      : 'Admin';

    // Run the approval
    const result = await approveRequest(supabase, requestId, {
      approverUserId: userId,
      approverName,
      resolutionNote,
    });

    if (!result.ok) {
      const httpStatus =
        result.reason === 'not_found' ? 404 :
        result.reason === 'not_pending' ? 409 :
        result.reason === 'conflict_complete_record' ? 409 :
        result.reason === 'conflict_unmergeable' ? 409 :
        500;
      return NextResponse.json(
        {
          ok: false,
          code: result.reason.toUpperCase(),
          message: result.message ?? result.reason,
        },
        { status: httpStatus },
      );
    }

    // Audit log (best-effort)
    await writeAuditLog({
      organizationId: requestRow.organization_id,
      userId,
      userName: approverName,
      action: 'clock.manual_approved',
      targetType: 'manual_entry_request',
      targetId: requestId,
      details: {
        request_id: requestId,
        record_id: result.recordId,
        mode: result.mode,
        work_date: requestRow.work_date,
        requester_user_id: requestRow.user_id,
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
    });

    // Send approval email to requester (non-blocking)
    sendApprovalEmailToRequester(requestRow.user_id, {
      organizationId: requestRow.organization_id,
      requesterUserId: requestRow.user_id,
      requesterName: requestRow.user_name ?? 'Employee',
      workDate: requestRow.work_date,
      requestedClockIn: requestRow.requested_clock_in,
      requestedClockOut: requestRow.requested_clock_out,
      resolverName: approverName,
      resolutionNote,
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[approve] email failed', e);
    });

    return NextResponse.json({
      ok: true,
      requestId,
      recordId: result.recordId,
      mode: result.mode,
    });
  } catch (e) {
    if (e instanceof AtlasError) {
      return NextResponse.json(e.toResponse(), { status: e.httpStatus });
    }
    // eslint-disable-next-line no-console
    console.error('[approve] unexpected', e);
    return NextResponse.json(
      { ok: false, code: 'UNKNOWN', message: 'Internal error' },
      { status: 500 },
    );
  }
}

// ── Helper: look up requester email via Clerk and send approval mail ──────

async function sendApprovalEmailToRequester(
  requesterClerkId: string,
  ctx: {
    organizationId: string;
    requesterUserId: string;
    requesterName: string;
    workDate: string;
    requestedClockIn: string | null;
    requestedClockOut: string | null;
    resolverName: string;
    resolutionNote: string | null;
  },
): Promise<void> {
  const client = await clerkClient();
  let email: string | undefined;
  try {
    const u = await client.users.getUser(requesterClerkId);
    email = u.emailAddresses[0]?.emailAddress;
  } catch {
    return; // can't resolve user; silently skip
  }
  if (!email) return;

  const dashboardUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.primestrideatlas.com') + '/clock/manual';

  await sendManualEntryApprovedEmail(email, { ...ctx, dashboardUrl });
}
