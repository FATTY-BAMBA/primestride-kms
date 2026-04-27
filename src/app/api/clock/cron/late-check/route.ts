// src/app/api/clock/cron/late-check/route.ts
// Vercel cron: runs at 02:30 UTC = 10:30 Taipei time (UTC+8)
// Finds all active org members who have NOT clocked in today
// on a work day, flags them as absent, notifies admins.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { taipeiDateString } from '@/lib/time';
import { getClockConfig } from '@/lib/clockConfig';
import { isWorkDay } from '@/lib/attendanceToday';
import { sendAbsentAlertEmail } from '@/lib/email/templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://primestrideatlas.com';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  const today = taipeiDateString(now);
  const results: { orgId: string; absent: number; notified: boolean }[] = [];

  try {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name');

    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ ok: true, message: 'No orgs', results });
    }

    for (const org of orgs) {
      try {
        const config = await getClockConfig(org.id);

        if (!isWorkDay(now, config.work_days)) {
          results.push({ orgId: org.id, absent: 0, notified: false });
          continue;
        }

        const { data: members } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', org.id)
          .eq('is_active', true);

        if (!members || members.length === 0) continue;

        const memberIds = members.map(m => m.user_id);

        const { data: todayRecords } = await supabase
          .from('attendance_records')
          .select('user_id')
          .eq('organization_id', org.id)
          .eq('work_date', today);

        const clockedInIds = new Set((todayRecords ?? []).map(r => r.user_id));
        const absentIds = memberIds.filter(id => !clockedInIds.has(id));

        if (absentIds.length === 0) {
          results.push({ orgId: org.id, absent: 0, notified: false });
          continue;
        }

        const { data: absentProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', absentIds);

        // Insert absent records (skip if already exists)
        for (const uid of absentIds) {
          const { data: existing } = await supabase
            .from('attendance_records')
            .select('id')
            .eq('organization_id', org.id)
            .eq('user_id', uid)
            .eq('work_date', today)
            .maybeSingle();

          if (!existing) {
            await supabase.from('attendance_records').insert({
              organization_id: org.id,
              user_id: uid,
              work_date: today,
              clock_in_method: 'system',
              status: 'absent',
              late_minutes: 0,
            });
          }
        }

        // Notify admins
        const { data: admins } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', org.id)
          .in('role', ['admin', 'owner'])
          .eq('is_active', true);

        const adminIds = (admins ?? []).map(a => a.user_id);

        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', adminIds);

        const absentEmployees = (absentProfiles ?? []).map(p => ({
          name: p.full_name || p.email || p.id,
          email: p.email || '',
        }));

        for (const admin of (adminProfiles ?? [])) {
          if (!admin.email) continue;
          await sendAbsentAlertEmail(admin.email, {
            adminName: admin.full_name || '管理員',
            orgName: org.name,
            workDate: today,
            absentEmployees,
            dashboardUrl: APP_URL,
          });
        }

        results.push({ orgId: org.id, absent: absentIds.length, notified: true });
      } catch (orgErr) {
        console.error(`[late-check] org ${org.id} error:`, orgErr);
        results.push({ orgId: org.id, absent: 0, notified: false });
      }
    }

    return NextResponse.json({ ok: true, date: today, results });
  } catch (e) {
    console.error('[late-check] fatal error:', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
