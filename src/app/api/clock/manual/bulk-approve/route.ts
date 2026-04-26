// src/app/api/clock/manual/bulk-approve/route.ts
// Admin approves multiple manual entry requests in one call.
//
// Flow:
//   1. Auth: signed-in admin/owner
//   2. Validate body: { ids: string[] } (1-50 UUIDs)
//   3. Resolve admin's organization (must be the SAME org for all requests)
//   4. Filter ids to only those in the admin's org (defensive: never approve cross-org)
//   5. Call bulkApproveRequests() — sequential idempotent processing
//   6. Send approval emails for each success (fire-and-forget, parallel)
//   7. Single audit log row covering the batch
//   8. Return { approved: [...], failed: [...] }

import { NextResponse } from 'next/server';
import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { bulkApproveRequests } from '@/lib/manualApproval';
import { atlasErrors, AtlasError } from '@/lib/errors';
import { writeAuditLog } from '@/lib/auditLog';
import { sendManualEntryApprovedEmail } from '@/lib/email/templates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MAX_BULK_SIZE = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BulkApproveBody {
  ids?: unknown;
}

type RequestRow = {
  id: string;
  organization_id: string;
  user_id: string;
  user_name: string | null;
  work_date: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) throw atlasErrors.unauthenticated();

    // Validate body
    const body = (await req.json().catch(() => ({}))) as BulkApproveBody;
    if (!Array.isArray(body.ids)) {
      throw atlasErrors.invalidInput('Body must contain ids: string[]');
    }
    const rawIds = body.ids;
    if (rawIds.length === 0) {
      throw atlasErrors.invalidInput('At least one id is required');
    }
    if (rawIds.length > MAX_BULK_SIZE) {
      throw atlasErrors.invalidInput(`Maximum ${MAX_BULK_SIZE} ids per request`);
    }
    // Filter to valid-shape UUIDs and dedupe
    const ids = Array.from(
      new Set(rawIds.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id))),
    );
    if (ids.length === 0) {
      throw atlasErrors.invalidInput('No valid UUIDs found in ids');
    }

    // Find caller's admin/owner orgs (we'll use these to filter requests)
    const { data: memberships, error: memberErr } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .in('role', ['admin', 'owner']);

    if (memberErr) throw atlasErrors.dbError(memberErr.message);
    if (!memberships || memberships.length === 0) {
      throw atlasErrors.adminRequired();
    }
    const adminOrgIds = new Set(memberships.map((m) => m.organization_id));

    // Load all requested rows + verify each is in admin's org
    // (This is the defensive step that prevents cross-org approval.)
    const { data: requestRows, error: loadErr } = await supabase
      .from('manual_entry_requests')
      .select('id, organization_id, user_id, user_name, work_date, requested_clock_in, requested_clock_out')
      .in('id', ids);

    if (loadErr) throw atlasErrors.dbError(loadErr.message);
    const inOrgRows = (requestRows ?? []).filter((r) => adminOrgIds.has(r.organization_id));
    const inOrgIds = inOrgRows.map((r) => r.id);

    // IDs that don't exist OR are outside admin's orgs — record as not_found
    const skippedIds = ids.filter((id) => !inOrgIds.includes(id));

    // Resolve approver name from Clerk
    const approverUser = await currentUser();
    const approverName = approverUser
      ? `${approverUser.firstName ?? ''} ${approverUser.lastName ?? ''}`.trim() ||
        approverUser.emailAddresses[0]?.emailAddress ||
        'Admin'
      : 'Admin';

    // Run bulk approval (sequential, idempotent)
    const summary = await bulkApproveRequests(supabase, inOrgIds, {
      approverUserId: userId,
      approverName,
    });

    // Add the cross-org / not-found IDs to the failed list
    const failed = [
      ...summary.failed,
      ...skippedIds.map((id) => ({
        ok: false as const,
        requestId: id,
        reason: 'not_found' as const,
      })),
    ];

    // Single audit log row covering the whole batch
    // Use the first admin org as the audit org (most common case: all same org)
    const primaryOrgId =
      inOrgRows[0]?.organization_id ?? Array.from(adminOrgIds)[0];
    await writeAuditLog({
      organizationId: primaryOrgId,
      userId,
      userName: approverName,
      action: 'clock.manual_bulk_approved',
      targetType: 'manual_entry_request',
      targetId: undefined,
      details: {
        approved_count: summary.approved.length,
        failed_count: failed.length,
        approved_ids: summary.approved.map((r) => r.requestId),
        failed_ids: failed.map((r) => r.requestId),
        total_requested: ids.length,
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
    });

    // Fire approval emails in parallel — don't block response on email delivery
    if (summary.approved.length > 0) {
      const rowsById = new Map(inOrgRows.map((r) => [r.id, r]));
      void sendBulkApprovalEmails(summary.approved, rowsById, approverName);
    }

    return NextResponse.json({
      ok: true,
      approved: summary.approved,
      failed,
      counts: {
        approved: summary.approved.length,
        failed: failed.length,
        total: ids.length,
      },
    });
  } catch (e) {
    if (e instanceof AtlasError) {
      return NextResponse.json(e.toResponse(), { status: e.httpStatus });
    }
    // eslint-disable-next-line no-console
    console.error('[bulk-approve] unexpected', e);
    return NextResponse.json(
      { ok: false, code: 'UNKNOWN', message: 'Internal error' },
      { status: 500 },
    );
  }
}

// ── Helper: send approval emails for all successful approvals in parallel ───

async function sendBulkApprovalEmails(
  approved: Array<{ requestId: string; recordId: string }>,
  rowsById: Map<string, RequestRow>,
  resolverName: string,
): Promise<void> {
  const client = await clerkClient();
  const dashboardUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.primestrideatlas.com') + '/clock/manual';

  await Promise.allSettled(
    approved.map(async (a) => {
      const row = rowsById.get(a.requestId);
      if (!row) return;

      let email: string | undefined;
      try {
        const u = await client.users.getUser(row.user_id);
        email = u.emailAddresses[0]?.emailAddress;
      } catch {
        return;
      }
      if (!email) return;

      try {
        await sendManualEntryApprovedEmail(email, {
          organizationId: row.organization_id,
          requesterUserId: row.user_id,
          requesterName: row.user_name ?? 'Employee',
          workDate: row.work_date,
          requestedClockIn: row.requested_clock_in,
          requestedClockOut: row.requested_clock_out,
          resolverName,
          resolutionNote: null,
          dashboardUrl,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[bulk-approve] email failed', { requestId: a.requestId, err });
      }
    }),
  );
}
