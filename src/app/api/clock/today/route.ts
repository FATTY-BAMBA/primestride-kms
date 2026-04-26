// src/app/api/clock/today/route.ts
// Returns today's attendance status for the current user.
// Role-aware: members get personal status; admins get org-wide summary.

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { getUserOrganization } from '@/lib/get-user-organization';
import { getClockConfig } from '@/lib/clockConfig';
import { taipeiDateString } from '@/lib/time';
import {
  getMyStatus,
  aggregateForAdmin,
  monthlyDaysCount,
  isWorkDay,
  type AttendanceRecord,
} from '@/lib/attendanceToday';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const userOrg = await getUserOrganization(userId);
    if (!userOrg) {
      return NextResponse.json({ error: 'NO_ORG' }, { status: 403 });
    }

    const orgId = userOrg.organization_id;
    const role = userOrg.role; // 'owner' | 'admin' | 'member'
    const isAdmin = role === 'owner' || role === 'admin';

    const config = await getClockConfig(orgId);
    const today = taipeiDateString(new Date());
    const isToday = isWorkDay(new Date(), config.work_days);

    // ── My status (everyone gets this) ──
    const { data: myRecord } = await supabase
      .from('attendance_records')
      .select(
        'user_id, work_date, clock_in, clock_out, total_minutes, late_minutes, overtime_minutes, clock_in_method',
      )
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('work_date', today)
      .maybeSingle();

    const myStatus = getMyStatus(
      myRecord ? ({ ...myRecord, user_name: '' } as AttendanceRecord) : null,
    );

    // ── Incomplete prior-day warning ──
    const { data: incompletePrior } = await supabase
      .from('attendance_records')
      .select('work_date')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .is('clock_out', null)
      .neq('work_date', today)
      .order('work_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── Monthly days count (employee stat card) ──
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = taipeiDateString(monthStart);

    const { data: monthRecords } = await supabase
      .from('attendance_records')
      .select('work_date, clock_in')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .gte('work_date', monthStartStr);

    const monthlyDays = monthlyDaysCount(monthRecords ?? []);

    // ── Member-only response ──
    if (!isAdmin) {
      return NextResponse.json({
        role,
        isWorkDayToday: isToday,
        myStatus,
        incompletePrior: incompletePrior?.work_date ?? null,
        monthlyDays,
        workStartTime: config.work_start_time,
        workEndTime: config.work_end_time,
        timezone: config.timezone,
      });
    }

    // ── Admin: org-wide summary ──
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('is_active', true);

    const expectedMemberIds = (members ?? []).map((m) => m.user_id);

    const { data: todayRecords } = await supabase
      .from('attendance_records')
      .select(
        'user_id, work_date, clock_in, clock_out, total_minutes, late_minutes, overtime_minutes, clock_in_method',
      )
      .eq('organization_id', orgId)
      .eq('work_date', today);

    const todayRecordsTyped: AttendanceRecord[] = (todayRecords ?? []).map((r) => ({
      ...r,
      user_name: '',
    } as AttendanceRecord));

    const summary = aggregateForAdmin(expectedMemberIds, todayRecordsTyped, config);

    // Pending manual entries count
    const { count: pendingRequestsCount } = await supabase
      .from('manual_entry_requests')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'pending');

    return NextResponse.json({
      role,
      isWorkDayToday: isToday,
      myStatus,
      incompletePrior: incompletePrior?.work_date ?? null,
      monthlyDays,
      summary,
      pendingRequests: pendingRequestsCount ?? 0,
      workStartTime: config.work_start_time,
      workEndTime: config.work_end_time,
      timezone: config.timezone,
    });
  } catch (e) {
    console.error('GET /api/clock/today error:', e);
    return NextResponse.json(
      { error: 'INTERNAL', message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}