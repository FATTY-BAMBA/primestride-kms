// src/lib/__tests__/manualApproval.test.ts
// Mock Supabase client tailored to the query patterns used by manualApproval.ts.
// Supports: from().select().eq().maybeSingle()
//           from().select().eq().single()
//           from().insert(data).select().single()
//           from().update(data).eq().eq().select().single()
//           from().update(data).eq()  // bare update (no terminator)
//
// The mock is hand-written and small; we accept its limits in exchange for
// having no external test dependencies and clear failure messages.

import { describe, it, expect } from 'vitest';
import {
  approveRequest,
  rejectRequest,
  bulkApproveRequests,
  type ManualEntryRequest,
} from '../manualApproval';

// ── Mock state ────────────────────────────────────────────────────────────

interface MockState {
  manual_entry_requests: Array<Record<string, unknown>>;
  attendance_records: Array<Record<string, unknown>>;
  attendance_record_versions: Array<Record<string, unknown>>;
}

function makeMockClient(initial: {
  manual_entry_requests?: ManualEntryRequest[];
  attendance_records?: Array<{
    id: string;
    organization_id: string;
    user_id: string;
    work_date: string;
    clock_in: string | null;
    clock_out: string | null;
  }>;
}) {
  const state: MockState = {
    manual_entry_requests: (initial.manual_entry_requests ?? []).map((r) => ({ ...r })),
    attendance_records: (initial.attendance_records ?? []).map((r) => ({ ...r })),
    attendance_record_versions: [],
  };

  let idCounter = 1000;
  const nextId = () => `rec_${idCounter++}`;

  function from(tableName: keyof MockState) {
    const filters: Array<[string, unknown]> = [];
    let pendingInsert: Record<string, unknown> | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;

    const matchRow = (row: Record<string, unknown>) =>
      filters.every(([col, val]) => row[col] === val);

    const findMatches = () => state[tableName].filter(matchRow);

    // Make builder thenable so `await client.from(t).update(d).eq()` works.
    const builder: any = {
      select(_cols?: string) {
        return builder;
      },
      insert(data: Record<string, unknown>) {
        pendingInsert = data;
        return builder;
      },
      update(data: Record<string, unknown>) {
        pendingUpdate = data;
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return builder;
      },

      // Read terminator: returns first match or null.
      maybeSingle() {
        const matches = findMatches();
        return Promise.resolve({ data: matches[0] ?? null, error: null });
      },

      // Strict-single terminator: returns single row, applying any pending insert/update.
      single() {
        if (pendingInsert) {
          const newRow = { id: nextId(), ...pendingInsert };
          state[tableName].push(newRow);
          return Promise.resolve({ data: newRow, error: null });
        }
        if (pendingUpdate) {
          const matches = findMatches();
          if (matches.length === 0) {
            return Promise.resolve({
              data: null,
              error: { message: 'no rows matched' },
            });
          }
          for (const m of matches) Object.assign(m, pendingUpdate);
          return Promise.resolve({ data: matches[0], error: null });
        }
        const matches = findMatches();
        return Promise.resolve({
          data: matches[0] ?? null,
          error: matches[0] ? null : { message: 'not found' },
        });
      },

      // Awaiting the builder directly (no terminator) applies pending update/insert.
      // This handles `await client.from(t).update(d).eq(...)` without `.single()`.
      then(resolve: (v: { data: unknown; error: unknown }) => void) {
        if (pendingInsert) {
          const newRow = { id: nextId(), ...pendingInsert };
          state[tableName].push(newRow);
          resolve({ data: newRow, error: null });
          return;
        }
        if (pendingUpdate) {
          const matches = findMatches();
          for (const m of matches) Object.assign(m, pendingUpdate);
          resolve({
            data: null,
            error: matches.length === 0 ? { message: 'no rows matched' } : null,
          });
          return;
        }
        // Read with no terminator — return all matches as data array
        resolve({ data: findMatches(), error: null });
      },
    };

    return builder;
  }

  return {
    from,
    _state: state,
  };
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const baseRequest: ManualEntryRequest = {
  id: 'req_1',
  organization_id: 'org_1',
  user_id: 'user_1',
  user_name: 'Alice',
  work_date: '2026-04-24',
  requested_clock_in: '2026-04-24T00:00:00Z',
  requested_clock_out: '2026-04-24T09:30:00Z',
  reason_code: 'forgot',
  reason_note: 'Forgot phone at home',
  status: 'pending',
  resulting_record_id: null,
};

const approver = {
  approverUserId: 'admin_1',
  approverName: 'Boss Smith',
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('approveRequest — create new attendance_record', () => {
  it('creates a new attendance record when none exists for the date', async () => {
    const client = makeMockClient({ manual_entry_requests: [baseRequest] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await approveRequest(client as any, 'req_1', approver);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mode).toBe('created');
      expect(result.recordId).toMatch(/^rec_/);
    }

    const requests = client._state.manual_entry_requests;
    expect(requests[0].status).toBe('approved');
    expect(requests[0].resolved_by_user_id).toBe('admin_1');

    const records = client._state.attendance_records;
    expect(records).toHaveLength(1);
    expect(records[0].clock_in_method).toBe('manual_approved');
  });
});

describe('approveRequest — merge into existing record', () => {
  it('merges clock_out when existing record has clock_in but no clock_out', async () => {
    const existing = {
      id: 'rec_existing',
      organization_id: 'org_1',
      user_id: 'user_1',
      work_date: '2026-04-24',
      clock_in: '2026-04-24T00:00:00Z',
      clock_out: null,
    };

    const requestWithOnlyClockOut: ManualEntryRequest = {
      ...baseRequest,
      requested_clock_in: null,
      requested_clock_out: '2026-04-24T09:30:00Z',
    };

    const client = makeMockClient({
      manual_entry_requests: [requestWithOnlyClockOut],
      attendance_records: [existing],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await approveRequest(client as any, 'req_1', approver);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mode).toBe('merged_clock_out');
      expect(result.recordId).toBe('rec_existing');
    }

    const records = client._state.attendance_records;
    expect(records).toHaveLength(1);
    expect(records[0].clock_out).toBe('2026-04-24T09:30:00Z');
  });
});

describe('approveRequest — failures', () => {
  it('returns not_found when request does not exist', async () => {
    const client = makeMockClient({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await approveRequest(client as any, 'missing', approver);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('returns not_pending when status is already approved (idempotent no-op)', async () => {
    const alreadyApproved: ManualEntryRequest = { ...baseRequest, status: 'approved' };
    const client = makeMockClient({ manual_entry_requests: [alreadyApproved] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await approveRequest(client as any, 'req_1', approver);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_pending');

    expect(client._state.attendance_records).toHaveLength(0);
  });

  it('returns conflict_complete_record when existing record is already full', async () => {
    const fullExisting = {
      id: 'rec_full',
      organization_id: 'org_1',
      user_id: 'user_1',
      work_date: '2026-04-24',
      clock_in: '2026-04-24T00:00:00Z',
      clock_out: '2026-04-24T09:00:00Z',
    };

    const client = makeMockClient({
      manual_entry_requests: [baseRequest],
      attendance_records: [fullExisting],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await approveRequest(client as any, 'req_1', approver);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('conflict_complete_record');

    const requests = client._state.manual_entry_requests;
    expect(requests[0].status).toBe('pending');
  });
});

describe('rejectRequest', () => {
  it('rejects a pending request', async () => {
    const client = makeMockClient({ manual_entry_requests: [baseRequest] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await rejectRequest(client as any, 'req_1', {
      rejecterUserId: 'admin_1',
      rejecterName: 'Boss Smith',
      resolutionNote: 'Insufficient evidence',
    });

    expect(result.ok).toBe(true);
    const requests = client._state.manual_entry_requests;
    expect(requests[0].status).toBe('rejected');
    expect(requests[0].resolution_note).toBe('Insufficient evidence');
  });

  it('returns not_pending when request is already rejected (idempotent)', async () => {
    const alreadyRejected: ManualEntryRequest = { ...baseRequest, status: 'rejected' };
    const client = makeMockClient({ manual_entry_requests: [alreadyRejected] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await rejectRequest(client as any, 'req_1', {
      rejecterUserId: 'admin_1',
      rejecterName: 'Boss Smith',
      resolutionNote: 'note',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_pending');
  });

  it('returns not_found for missing id', async () => {
    const client = makeMockClient({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await rejectRequest(client as any, 'missing', {
      rejecterUserId: 'admin_1',
      rejecterName: 'Boss Smith',
      resolutionNote: 'note',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});

describe('bulkApproveRequests', () => {
  it('partitions mixed results correctly', async () => {
    const r1: ManualEntryRequest = { ...baseRequest, id: 'req_1', user_id: 'user_1' };
    const r2: ManualEntryRequest = {
      ...baseRequest,
      id: 'req_2',
      user_id: 'user_2',
      status: 'approved',
    };
    const r3: ManualEntryRequest = { ...baseRequest, id: 'req_3', user_id: 'user_3' };

    const client = makeMockClient({ manual_entry_requests: [r1, r2, r3] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary = await bulkApproveRequests(
      client as any,
      ['req_1', 'req_2', 'req_3', 'missing'],
      approver,
    );

    expect(summary.approved).toHaveLength(2);
    expect(summary.failed).toHaveLength(2);

    const failedReasons = summary.failed.map((f) => f.reason);
    expect(failedReasons).toContain('not_pending');
    expect(failedReasons).toContain('not_found');

    expect(client._state.attendance_records).toHaveLength(2);
  });

  it('returns empty result for empty input', async () => {
    const client = makeMockClient({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary = await bulkApproveRequests(client as any, [], approver);
    expect(summary.approved).toHaveLength(0);
    expect(summary.failed).toHaveLength(0);
  });
});