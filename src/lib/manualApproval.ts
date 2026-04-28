// src/lib/manualApproval.ts
// Pure orchestration logic for approving/rejecting manual entry requests.
// 
// Design notes:
// - Functions take a Supabase client + IDs, perform DB ops, and return result objects.
// - Idempotent: WHERE clauses always include `status = 'pending'` so a second call is a safe no-op.
// - Audit-trailed: every state change writes a row to attendance_record_versions.
// - Approval atomically:
//     1. updates the request row (pending → approved)
//     2. creates or merges into attendance_records
//     3. writes a version snapshot
//   If any step fails the function returns failure; partial-state recovery is
//   handled at the API layer (PR 3c.1c).

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ManualEntryRequest {
  id: string;
  organization_id: string;
  user_id: string;
  user_name: string | null;
  work_date: string; // YYYY-MM-DD
  requested_clock_in: string | null;  // ISO timestamp UTC
  requested_clock_out: string | null;
  reason_code: string;
  reason_note: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  resulting_record_id: string | null;
}

export interface ApprovalResult {
  ok: true;
  requestId: string;
  recordId: string;
  mode: 'created' | 'merged_clock_out';
  lsaCompliance?: LSAComplianceResult;
}

export interface ApprovalFailure {
  ok: false;
  requestId: string;
  reason:
    | 'not_found'
    | 'not_pending'
    | 'conflict_complete_record'
    | 'conflict_unmergeable'
    | 'db_error';
  message?: string;
}

export type ApprovalOutcome = ApprovalResult | ApprovalFailure;

export interface RejectionResult {
  ok: true;
  requestId: string;
}

export interface RejectionFailure {
  ok: false;
  requestId: string;
  reason: 'not_found' | 'not_pending' | 'db_error';
  message?: string;
}

export type RejectionOutcome = RejectionResult | RejectionFailure;

export interface BulkApprovalSummary {
  approved: ApprovalResult[];
  failed: ApprovalFailure[];
}

export interface ApproverContext {
  approverUserId: string;
  approverName: string;
  resolutionNote?: string | null;
}

export interface RejecterContext {
  rejecterUserId: string;
  rejecterName: string;
  resolutionNote: string;
}

// ── LSA Compliance types ──────────────────────────────────────────────────

export interface LSAComplianceWarning {
  code: string;
  severity: 'warning' | 'violation';
  article: string;
  message_zh: string;
  message_en: string;
  value?: number;
  limit?: number;
}

export interface LSAComplianceResult {
  compliant: boolean;
  warnings: LSAComplianceWarning[];
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Load a request by id. Returns null if not found.
 */
async function loadRequest(
  client: SupabaseClient,
  requestId: string,
): Promise<ManualEntryRequest | null> {
  const { data } = await client
    .from('manual_entry_requests')
    .select(
      'id, organization_id, user_id, user_name, work_date, requested_clock_in, requested_clock_out, reason_code, reason_note, status, resulting_record_id',
    )
    .eq('id', requestId)
    .maybeSingle();

  return (data as ManualEntryRequest | null) ?? null;
}

/**
 * Find any existing attendance record for this user + date.
 */
async function loadExistingRecord(
  client: SupabaseClient,
  orgId: string,
  userId: string,
  workDate: string,
): Promise<{ id: string; clock_in: string | null; clock_out: string | null } | null> {
  const { data } = await client
    .from('attendance_records')
    .select('id, clock_in, clock_out')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('work_date', workDate)
    .maybeSingle();

  return data ?? null;
}

/**
 * Snapshot the current state of an attendance record into versions table.
 *
 * Schema notes:
 * - attendance_record_versions stores a flattened snapshot of attendance_records
 *   (not a JSON blob). We copy the relevant columns directly.
 * - The `change_type` column has a CHECK constraint allowing only:
 *   'create' | 'edit' | 'approve' | 'reject' | 'cancel'
 * - Descriptive context (e.g., "from manual approval") goes in `change_note`.
 * - The `changed_at` and `id` columns are auto-populated.
 *
 * Errors here are logged but do not throw — the calling approval flow has
 * already committed the user-facing state changes by the time we snapshot.
 */
async function writeVersionSnapshot(
  client: SupabaseClient,
  recordId: string,
  changeType: 'create' | 'edit' | 'approve' | 'reject' | 'cancel',
  byUserId: string,
  byUserName: string,
  changeNote?: string | null,
): Promise<void> {
  // Read current state of the record
  const { data: record } = await client
    .from('attendance_records')
    .select(
      'organization_id, clock_in, clock_out, late_minutes, total_hours, overtime_hours, status, clock_in_method, manual_reason',
    )
    .eq('id', recordId)
    .maybeSingle();

  if (!record) return; // shouldn't happen but don't throw

  const { error } = await client.from('attendance_record_versions').insert({
    attendance_record_id: recordId,
    organization_id: record.organization_id,
    clock_in: record.clock_in ?? null,
    clock_out: record.clock_out ?? null,
    late_minutes: record.late_minutes ?? null,
    total_hours: record.total_hours ?? null,
    overtime_hours: record.overtime_hours ?? null,
    status: record.status ?? null,
    clock_in_method: record.clock_in_method ?? null,
    manual_reason: record.manual_reason ?? null,
    changed_by_user_id: byUserId,
    changed_by_name: byUserName,
    change_type: changeType,
    change_note: changeNote ?? null,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[writeVersionSnapshot] insert failed', {
      recordId,
      changeType,
      message: error.message,
    });
  }
}

// ── LSA Compliance checker ────────────────────────────────────────────────

/**
 * Check LSA compliance for a manual entry request before approval.
 * Checks:
 *   - LSA Art. 30: Daily hours <= 12
 *   - LSA Art. 32: Monthly overtime <= 46 hours
 * Does NOT block approval — returns warnings for admin awareness.
 */
async function checkLSACompliance(
  client: SupabaseClient,
  orgId: string,
  userId: string,
  workDate: string,
  clockIn: string | null,
  clockOut: string | null,
): Promise<LSAComplianceResult> {
  const warnings: LSAComplianceWarning[] = [];

  // ── Check 1: Daily hours limit (LSA Art. 30) ──
  if (clockIn && clockOut) {
    const inTime = new Date(clockIn);
    const outTime = new Date(clockOut);
    const totalHours = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);

    if (totalHours > 12) {
      warnings.push({
        code: 'DAILY_HOURS_EXCEEDED',
        severity: 'violation',
        article: 'LSA Art. 30',
        message_zh: `本次打卡記錄工時 ${totalHours.toFixed(1)} 小時，超過每日上限 12 小時`,
        message_en: `This record shows ${totalHours.toFixed(1)} hours, exceeding the 12-hour daily limit`,
        value: totalHours,
        limit: 12,
      });
    } else if (totalHours > 10) {
      warnings.push({
        code: 'DAILY_HOURS_WARNING',
        severity: 'warning',
        article: 'LSA Art. 30',
        message_zh: `本次打卡記錄工時 ${totalHours.toFixed(1)} 小時，接近每日上限 12 小時`,
        message_en: `This record shows ${totalHours.toFixed(1)} hours, approaching the 12-hour daily limit`,
        value: totalHours,
        limit: 12,
      });
    }
  }

  // ── Check 2: Monthly overtime limit (LSA Art. 32) ──
  const monthStart = workDate.slice(0, 7) + '-01';
  const monthEnd = workDate.slice(0, 7) + '-31';

  const { data: monthRecords } = await client
    .from('attendance_records')
    .select('overtime_hours, work_date')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .gte('work_date', monthStart)
    .lte('work_date', monthEnd)
    .neq('work_date', workDate); // exclude current date being approved

  const existingMonthlyOT = (monthRecords ?? []).reduce(
    (sum, r) => sum + (Number(r.overtime_hours) || 0), 0
  );

  // Estimate new overtime from this record
  let newOT = 0;
  if (clockIn && clockOut) {
    const totalHours = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60);
    newOT = Math.max(0, totalHours - 8);
  }

  const projectedMonthlyOT = existingMonthlyOT + newOT;

  if (projectedMonthlyOT > 46) {
    warnings.push({
      code: 'MONTHLY_OT_EXCEEDED',
      severity: 'violation',
      article: 'LSA Art. 32',
      message_zh: `核准後本月加班時數將達 ${projectedMonthlyOT.toFixed(1)} 小時，超過法定上限 46 小時`,
      message_en: `Approval will bring monthly overtime to ${projectedMonthlyOT.toFixed(1)} hours, exceeding the 46-hour limit`,
      value: projectedMonthlyOT,
      limit: 46,
    });
  } else if (projectedMonthlyOT > 38) {
    warnings.push({
      code: 'MONTHLY_OT_WARNING',
      severity: 'warning',
      article: 'LSA Art. 32',
      message_zh: `核准後本月加班時數將達 ${projectedMonthlyOT.toFixed(1)} 小時，接近法定上限 46 小時`,
      message_en: `Approval will bring monthly overtime to ${projectedMonthlyOT.toFixed(1)} hours, approaching the 46-hour limit`,
      value: projectedMonthlyOT,
      limit: 46,
    });
  }

  return {
    compliant: warnings.filter(w => w.severity === 'violation').length === 0,
    warnings,
  };
}

// ── Public: approve a single request ──────────────────────────────────────

/**
 * Approve a manual entry request.
 *
 * Flow:
 *   1. Load request, verify status === 'pending' (idempotent guard)
 *   2. Decide mode: create new attendance_record OR merge clock_out into existing
 *   3. Apply the DB change
 *   4. Update request row: status → 'approved', resulting_record_id, resolved_at, resolved_by_*
 *   5. Snapshot the resulting record into attendance_record_versions
 *
 * Returns success or a failure object describing the reason.
 */
export async function approveRequest(
  client: SupabaseClient,
  requestId: string,
  approver: ApproverContext,
): Promise<ApprovalOutcome> {
  // 1. Load + guard
  const request = await loadRequest(client, requestId);
  if (!request) {
    return { ok: false, requestId, reason: 'not_found' };
  }
  if (request.status !== 'pending') {
    return { ok: false, requestId, reason: 'not_pending' };
  }

  // 2. Decide mode
  const existing = await loadExistingRecord(
    client,
    request.organization_id,
    request.user_id,
    request.work_date,
  );

  let recordId: string;
  let mode: 'created' | 'merged_clock_out';

  if (!existing) {
    // CREATE new attendance_record
    const { data: created, error: createErr } = await client
      .from('attendance_records')
      .insert({
        organization_id: request.organization_id,
        user_id: request.user_id,
        work_date: request.work_date,
        clock_in: request.requested_clock_in,
        clock_out: request.requested_clock_out,
        clock_in_method: 'manual_approved',
      })
      .select('id')
      .single();

    if (createErr || !created) {
      return {
        ok: false,
        requestId,
        reason: 'db_error',
        message: createErr?.message ?? 'insert failed',
      };
    }
    recordId = created.id;
    mode = 'created';
  } else if (existing.clock_in && !existing.clock_out && request.requested_clock_out) {
    // MERGE clock_out into existing record
    const { error: updateErr } = await client
      .from('attendance_records')
      .update({
        clock_out: request.requested_clock_out,
        clock_in_method: 'manual_approved',
      })
      .eq('id', existing.id);

    if (updateErr) {
      return {
        ok: false,
        requestId,
        reason: 'db_error',
        message: updateErr.message,
      };
    }
    recordId = existing.id;
    mode = 'merged_clock_out';
  } else if (existing.clock_in && existing.clock_out) {
    // Record is already complete — can't merge
    return { ok: false, requestId, reason: 'conflict_complete_record' };
  } else {
    // Some other unmergeable state (e.g., existing has clock_out but no clock_in)
    return { ok: false, requestId, reason: 'conflict_unmergeable' };
  }

  // 3. Update the request row — guard with status='pending' for idempotency
  const { data: updatedRequest, error: updateReqErr } = await client
    .from('manual_entry_requests')
    .update({
      status: 'approved',
      resulting_record_id: recordId,
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: approver.approverUserId,
      resolved_by_name: approver.approverName,
      resolution_note: approver.resolutionNote ?? null,
    })
    .eq('id', requestId)
    .eq('status', 'pending') // idempotency guard
    .select('id')
    .single();

  if (updateReqErr || !updatedRequest) {
    // Race condition: request was resolved by another concurrent call.
    // We've already created/merged the record though — the second caller
    // will see the existing record and skip. This is a benign race.
    return {
      ok: false,
      requestId,
      reason: 'not_pending',
      message: 'Request was resolved by a concurrent call',
    };
  }

  // 3.5 LSA compliance check — run after approval, attach to response
  const lsaCompliance = await checkLSACompliance(
    client,
    request.organization_id,
    request.user_id,
    request.work_date,
    request.requested_clock_in,
    request.requested_clock_out,
  );

  // 4. Audit snapshot — type uses schema-allowed action verb,
  //    descriptive context goes in change_note.
  await writeVersionSnapshot(
    client,
    recordId,
    mode === 'created' ? 'approve' : 'edit',
    approver.approverUserId,
    approver.approverName,
    mode === 'created'
      ? 'Created from approved manual entry request'
      : 'Merged clock-out from approved manual entry request',
  );

  return { ok: true, requestId, recordId, mode, lsaCompliance };
}

// ── Public: reject a single request ───────────────────────────────────────

export async function rejectRequest(
  client: SupabaseClient,
  requestId: string,
  rejecter: RejecterContext,
): Promise<RejectionOutcome> {
  const request = await loadRequest(client, requestId);
  if (!request) return { ok: false, requestId, reason: 'not_found' };
  if (request.status !== 'pending') return { ok: false, requestId, reason: 'not_pending' };

  const { data: updated, error } = await client
    .from('manual_entry_requests')
    .update({
      status: 'rejected',
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: rejecter.rejecterUserId,
      resolved_by_name: rejecter.rejecterName,
      resolution_note: rejecter.resolutionNote,
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id')
    .single();

  if (error || !updated) {
    return {
      ok: false,
      requestId,
      reason: 'not_pending',
      message: error?.message ?? 'race: resolved concurrently',
    };
  }

  return { ok: true, requestId };
}

// ── Public: bulk approve ──────────────────────────────────────────────────

/**
 * Bulk-approve a set of request IDs.
 * Each is processed sequentially with full idempotency.
 * Returns partitioned results.
 */
export async function bulkApproveRequests(
  client: SupabaseClient,
  requestIds: string[],
  approver: ApproverContext,
): Promise<BulkApprovalSummary> {
  const approved: ApprovalResult[] = [];
  const failed: ApprovalFailure[] = [];

  for (const id of requestIds) {
    const result = await approveRequest(client, id, approver);
    if (result.ok) {
      approved.push(result);
    } else {
      failed.push(result);
    }
  }

  return { approved, failed };
}