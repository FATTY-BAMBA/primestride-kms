// src/app/api/clock/manual/[id]/edit/route.ts
// Admin-only: edit an approved attendance record with full audit trail.

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { getUserOrganization } from '@/lib/get-user-organization';
import { writeAuditLog } from '@/lib/auditLog';
import { atlasErrors, AtlasError } from '@/lib/errors';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  let userId: string | null = null;
  let orgId: string | null = null;

  try {
    const authResult = await auth();
    userId = authResult.userId;
    if (!userId) throw atlasErrors.unauthenticated();

    const org = await getUserOrganization(userId);
    if (!org) throw atlasErrors.notMember();

    const isAdmin = ['owner', 'admin'].includes(org.role ?? '');
    if (!isAdmin) {
      return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: 'Admin only' }, { status: 403 });
    }

    orgId = org.organization_id;
    const recordId = params.id;

    const { data: existing, error: fetchErr } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', recordId)
      .eq('organization_id', orgId)
      .maybeSingle();

    if (fetchErr) throw atlasErrors.dbError(fetchErr.message);
    if (!existing) {
      return NextResponse.json({ ok: false, code: 'NOT_FOUND', message: 'Record not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body) throw atlasErrors.invalidInput('Invalid JSON');

    const { clock_in, clock_out, notes, edit_reason } = body;

    if (!clock_in && !clock_out && notes === undefined) {
      return NextResponse.json({ ok: false, code: 'NO_CHANGES', message: 'No fields to update' }, { status: 400 });
    }

    if (clock_in && clock_out) {
      const inTime = new Date(clock_in);
      const outTime = new Date(clock_out);
      if (outTime <= inTime) {
        return NextResponse.json({ ok: false, code: 'INVALID_TIMES', message: 'clock_out must be after clock_in' }, { status: 400 });
      }
    }

    // Write version snapshot before edit (non-fatal if table missing)
    await supabase.from('attendance_record_history').insert({
      attendance_record_id: recordId,
      organization_id: orgId,
      snapshot: existing,
      edited_by: userId,
      edit_reason: edit_reason || null,
      created_at: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.error('[record-edit] snapshot write failed:', error.message);
    });

    const updates: Record<string, unknown> = {};
    if (clock_in !== undefined) updates.clock_in = clock_in;
    if (clock_out !== undefined) updates.clock_out = clock_out;
    if (notes !== undefined) updates.notes = notes;

    const newClockIn = clock_in ?? existing.clock_in;
    const newClockOut = clock_out ?? existing.clock_out;

    if (newClockIn && newClockOut) {
      const totalMinutes = (new Date(newClockOut).getTime() - new Date(newClockIn).getTime()) / (1000 * 60);
      const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
      updates.total_hours = totalHours;
      updates.overtime_hours = Math.max(0, Math.round((totalHours - 8) * 100) / 100);
    }

    updates.approved_by = userId;
    updates.approved_at = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('attendance_records')
      .update(updates)
      .eq('id', recordId)
      .eq('organization_id', orgId);

    if (updateErr) throw atlasErrors.dbError(updateErr.message);

    const user = await currentUser();
    const userName = user
      ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.emailAddresses[0]?.emailAddress || null
      : null;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null;

    writeAuditLog({
      organizationId: orgId,
      userId,
      userName,
      action: 'clock.record_edited',
      targetType: 'attendance_record',
      targetId: recordId,
      details: {
        before: { clock_in: existing.clock_in, clock_out: existing.clock_out, total_hours: existing.total_hours, notes: existing.notes },
        after: updates,
        edit_reason: edit_reason || null,
      },
      ipAddress: ip,
    });

    return NextResponse.json({ ok: true, recordId, message: '出勤記錄已更新 Record updated successfully' });
  } catch (e) {
    if (e instanceof AtlasError) {
      return NextResponse.json(e.toResponse(), { status: e.httpStatus });
    }
    console.error('[record-edit] unexpected', e);
    return NextResponse.json({ ok: false, code: 'UNKNOWN', message: 'Internal error' }, { status: 500 });
  }
}
