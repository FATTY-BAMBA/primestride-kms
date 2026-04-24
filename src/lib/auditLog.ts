// src/lib/auditLog.ts
// Thin wrapper over the existing audit_logs table for clock-in events.
// Service role client — audit writes must never fail silently.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export type AuditAction =
  | 'clock.punch_in'
  | 'clock.punch_out'
  | 'clock.qr_token_issued'
  | 'clock.punch_rejected';

export type AuditLogEntry = {
  organizationId: string;
  userId: string;
  userName: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  targetTitle?: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
};

/** Write an audit log entry. Does not throw — logs failures to console. */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      organization_id: entry.organizationId,
      user_id: entry.userId,
      user_name: entry.userName,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      target_title: entry.targetTitle ?? null,
      details: entry.details ?? null,
      ip_address: entry.ipAddress ?? null,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[auditLog] write failed', { action: entry.action, error: error.message });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[auditLog] unexpected error', { action: entry.action, e });
  }
}
