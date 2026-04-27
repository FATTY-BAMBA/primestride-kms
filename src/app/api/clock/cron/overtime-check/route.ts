// src/app/api/clock/cron/overtime-check/route.ts
// Vercel cron: runs at 11:00 UTC = 19:00 Taipei time (UTC+8)
// Finds employees who:
//   1. Clocked in today but NOT clocked out (still at work past 7pm)
//   2. Have 10+ hours elapsed since clock-in without an overtime request
// Notifies both the employee AND admin.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { taipeiDateString } from '@/lib/time';
import { getClockConfig } from '@/lib/clockConfig';
import { isWorkDay } from '@/lib/attendanceToday';
import { sendOvertimeAlertEmail } from '@/lib/email/templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://primestrideatlas.com';
const OT_HOURS_THRESHOLD = 10; // flag if worked 10+ hours

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  const today = taipeiDateString(now);
  const results: { orgId: string; flagged: number; notified: boolean }[] = [];

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
          results.push({ orgId: org.id, flagged: 0, notified: false });
          continue;
        }

        // Find records with clock_in but no clock_out today
        const { data: openRecords } = await supabase
          .from('attendance_records')
          .select('id, user_id, clock_in, total_hours, overtime_hours')
          .eq('organization_id', org.id)
          .eq('work_date', today)
          .is('clock_out', null)
          .not('clock_in', 'is', null);

        if (!openRecords || openRecords.length === 0) {
          results.push({ orgId: org.id, flagged: 0, notified: false });
          continue;
        }

        // Filter: only those who've been in 10+ hours
        const flagged = openRecords.filter(r => {
          if (!r.clock_in) return false;
          const elapsedHours = (now.getTime() - new Date(r.clock_in).getTime()) / (1000 * 60 * 60);
          return elapsedHours >= OT_HOURS_THRESHOLD;
        });

        if (flagged.length === 0) {
          results.push({ orgId: org.id, flagged: 0, notified: false });
          continue;
        }

        const flaggedUserIds = flagged.map(r => r.user_id);

        // Check who has already filed an overtime request today
        const { data: existingOT } = await supabase
          .from('workflow_submissions')
          .select('submitted_by')
          .eq('organization_id', org.id)
          .eq('form_type', 'overtime')
          .in('submitted_by', flaggedUserIds)
          .gte('created_at', `${today}T00:00:00+08:00`);

        const alreadyFiledIds = new Set((existingOT ?? []).map(r => r.submitted_by));

        // Only flag those who haven't filed OT yet
        const unfiled = flagged.filter(r => !alreadyFiledIds.has(r.user_id));

        if (unfiled.length === 0) {
          results.push({ orgId: org.id, flagged: 0, notified: false });
          continue;
        }

        const unfiledIds = unfiled.map(r => r.user_id);

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', unfiledIds);

        // Get admin profiles
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

        // Notify each flagged employee
        for (const record of unfiled) {
          const profile = (profiles ?? []).find(p => p.id === record.user_id);
          if (!profile?.email) continue;

          const elapsedHours = Math.floor(
            (now.getTime() - new Date(record.clock_in!).getTime()) / (1000 * 60 * 60)
          );

          await sendOvertimeAlertEmail(profile.email, {
            employeeName: profile.full_name || profile.email,
            orgName: org.name,
            workDate: today,
            elapsedHours,
            dashboardUrl: APP_URL,
            isAdminAlert: false,
          });
        }

        // Notify admins
        const flaggedEmployees = (profiles ?? []).map(p => ({
          name: p.full_name || p.email || p.id,
          email: p.email || '',
          elapsedHours: Math.floor(
            (now.getTime() - new Date(
              unfiled.find(r => r.user_id === p.id)?.clock_in ?? now.toISOString()
            ).getTime()) / (1000 * 60 * 60)
          ),
        }));

        for (const admin of (adminProfiles ?? [])) {
          if (!admin.email) continue;
          await sendOvertimeAlertEmail(admin.email, {
            employeeName: admin.full_name || '管理員',
            orgName: org.name,
            workDate: today,
            elapsedHours: 0,
            dashboardUrl: APP_URL,
            isAdminAlert: true,
            flaggedEmployees,
          });
        }

        results.push({ orgId: org.id, flagged: unfiled.length, notified: true });
      } catch (orgErr) {
        console.error(`[overtime-check] org ${org.id} error:`, orgErr);
        results.push({ orgId: org.id, flagged: 0, notified: false });
      }
    }

    return NextResponse.json({ ok: true, date: today, results });
  } catch (e) {
    console.error('[overtime-check] fatal error:', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
