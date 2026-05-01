// src/lib/admin/__tests__/mergePartialEmployeeUpdate.test.ts
//
// Atlas EIP - Tests for mergePartialEmployeeUpdate
//
// Strategy: tailored Supabase client mock that supports only the
// query pattern the helper uses: from().select().eq().single(). No
// insert, no update, no .then() awaiting. Each test passes a fixed
// { data, error } payload that .single() resolves to.
//
// Test organization mirrors the helper's branch structure:
//   - no fetch needed (3 tests)
//   - fetch and merge success (3 tests)
//   - fetch failures (3 tests)
//   - profile context completeness (2 tests)
//   - merged validation failure (1 test)

import { describe, it, expect } from "vitest";
import { mergePartialEmployeeUpdate } from "../mergePartialEmployeeUpdate";
import type { EmployeeUpdateInput } from "../employeeUpdateSchema";

const VALID_USER_ID = "user_3AcbPiBj0LCsYZHzchgbzO2ywtU";

// ── Mock client ────────────────────────────────────────────────────────────

type SingleResult = { data: unknown; error: unknown };

/**
 * Build a minimal Supabase client mock that supports the helper's one
 * query pattern: from(table).select(cols).eq(col, val).single().
 *
 * The mock records what it was called with so tests can assert that
 * the helper queried the right table, columns, and filter.
 */
function makeMockClient(singleResult: SingleResult) {
  const calls = {
    fromTable: null as string | null,
    selectCols: null as string | null,
    eqColumn: null as string | null,
    eqValue: null as unknown,
    singleCalled: false,
  };

  const builder: any = {
    select(cols: string) {
      calls.selectCols = cols;
      return builder;
    },
    eq(col: string, val: unknown) {
      calls.eqColumn = col;
      calls.eqValue = val;
      return builder;
    },
    single() {
      calls.singleCalled = true;
      return Promise.resolve(singleResult);
    },
  };

  return {
    from(table: string) {
      calls.fromTable = table;
      return builder;
    },
    _calls: calls,
  };
}

// Convenience: helper expects a SupabaseClient. Tests cast through any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (mock: ReturnType<typeof makeMockClient>) => mock as any;

// Convenience: build a minimal valid EmployeeUpdateInput with overrides.
// The cast preserves against future type tightening; today the inferred
// EmployeeUpdateInput already has every field optional except user_id,
// but if the schema is ever tightened the cast keeps these test fixtures
// from rotting.
const baseInput = (
  overrides: Partial<EmployeeUpdateInput> = {},
): EmployeeUpdateInput =>
  ({
    user_id: VALID_USER_ID,
    ...overrides,
  }) as EmployeeUpdateInput;

// ── Tests: no fetch needed ─────────────────────────────────────────────────

describe("mergePartialEmployeeUpdate - no fetch needed", () => {
  it("salary_base undefined: returns input unchanged, no DB call", async () => {
    const mock = makeMockClient({ data: null, error: null });
    const input = baseInput({ full_name: "Alice" });

    const result = await mergePartialEmployeeUpdate(asClient(mock), input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contextFetched).toBe(false);
      expect(result.data).toEqual(input);
    }
    // Verify no fetch happened: from() was never called.
    expect(mock._calls.fromTable).toBeNull();
    expect(mock._calls.singleCalled).toBe(false);
  });

  it("salary_base = 0 (placeholder): returns input unchanged, no DB call", async () => {
    const mock = makeMockClient({ data: null, error: null });
    const input = baseInput({ salary_base: 0 });

    const result = await mergePartialEmployeeUpdate(asClient(mock), input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contextFetched).toBe(false);
      expect(result.data).toEqual(input);
    }
    expect(mock._calls.fromTable).toBeNull();
  });

  it("salary_base positive AND both context fields present: no fetch needed", async () => {
    const mock = makeMockClient({ data: null, error: null });
    const input = baseInput({
      salary_base: 60000,
      pay_basis: "monthly",
      employment_type: "full_time",
    });

    const result = await mergePartialEmployeeUpdate(asClient(mock), input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contextFetched).toBe(false);
      expect(result.data).toEqual(input);
    }
    expect(mock._calls.fromTable).toBeNull();
  });
});

// ── Tests: fetch and merge success ─────────────────────────────────────────

describe("mergePartialEmployeeUpdate - fetch and merge success", () => {
  it("missing pay_basis: fetches DB, merges, validates", async () => {
    const mock = makeMockClient({
      data: { pay_basis: "monthly", employment_type: "full_time" },
      error: null,
    });
    const input = baseInput({
      salary_base: 60000,
      employment_type: "full_time",
      // pay_basis missing
    });

    const result = await mergePartialEmployeeUpdate(asClient(mock), input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contextFetched).toBe(true);
      expect(result.data.pay_basis).toBe("monthly"); // filled from DB
      expect(result.data.employment_type).toBe("full_time"); // from input
      expect(result.data.salary_base).toBe(60000);
    }
    // Verify the right query happened.
    expect(mock._calls.fromTable).toBe("profiles");
    expect(mock._calls.selectCols).toBe("pay_basis, employment_type");
    expect(mock._calls.eqColumn).toBe("id");
    expect(mock._calls.eqValue).toBe(VALID_USER_ID);
  });

  it("input pay_basis wins over DB pay_basis (input is hourly, DB is monthly)", async () => {
    const mock = makeMockClient({
      data: { pay_basis: "monthly", employment_type: "full_time" },
      error: null,
    });
    const input = baseInput({
      salary_base: 200, // would be below floor if treated as monthly
      pay_basis: "hourly",
      // employment_type missing
    });

    const result = await mergePartialEmployeeUpdate(asClient(mock), input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contextFetched).toBe(true);
      expect(result.data.pay_basis).toBe("hourly"); // input wins
      expect(result.data.employment_type).toBe("full_time"); // from DB
      // hourly bypasses monthly floor, so 200 is acceptable
    }
  });

  it("missing both context fields: both filled from DB", async () => {
    const mock = makeMockClient({
      data: { pay_basis: "monthly", employment_type: "full_time" },
      error: null,
    });
    const input = baseInput({
      salary_base: 60000,
      // both pay_basis and employment_type missing
    });

    const result = await mergePartialEmployeeUpdate(asClient(mock), input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contextFetched).toBe(true);
      expect(result.data.pay_basis).toBe("monthly");
      expect(result.data.employment_type).toBe("full_time");
    }
  });
});

// ── Tests: fetch failures ──────────────────────────────────────────────────

describe("mergePartialEmployeeUpdate - fetch failures", () => {
  it("PROFILE_NOT_FOUND: PostgREST PGRST116 maps to 404", async () => {
    const mock = makeMockClient({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    const input = baseInput({
      salary_base: 60000,
      // missing context to force fetch
    });

    const result = await mergePartialEmployeeUpdate(asClient(mock), input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("PROFILE_NOT_FOUND");
      expect(result.statusCode).toBe(404);
    }
  });

  it("DB_FETCH_ERROR: arbitrary PostgREST error maps to 500", async () => {
    const mock = makeMockClient({
      data: null,
      error: {
        code: "PGRST301",
        message: "JWT expired or session invalid",
      },
    });
    const input = baseInput({ salary_base: 60000 });

    const result = await mergePartialEmployeeUpdate(asClient(mock), input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("DB_FETCH_ERROR");
      expect(result.statusCode).toBe(500);
      expect(result.error).toContain("JWT expired");
    }
  });

  it("DB_FETCH_ERROR: error object with no .code falls through to 500", async () => {
    const mock = makeMockClient({
      data: null,
      error: { message: "auth/network failure with no code field" },
    });
    const input = baseInput({ salary_base: 60000 });

    const result = await mergePartialEmployeeUpdate(asClient(mock), input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("DB_FETCH_ERROR");
      expect(result.statusCode).toBe(500);
    }
  });
});

// ── Tests: profile context completeness ────────────────────────────────────

describe("mergePartialEmployeeUpdate - profile context completeness", () => {
  it("PROFILE_PAY_BASIS_NULL: row exists, pay_basis null, returns 500", async () => {
    const mock = makeMockClient({
      data: { pay_basis: null, employment_type: "full_time" },
      error: null,
    });
    const input = baseInput({
      salary_base: 60000,
      // missing context to force fetch
    });

    const result = await mergePartialEmployeeUpdate(asClient(mock), input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("PROFILE_PAY_BASIS_NULL");
      expect(result.statusCode).toBe(500);
      expect(result.error).toContain("Phase 3k.1");
    }
  });

  it("PROFILE_EMPLOYMENT_TYPE_NULL: row exists, employment_type null, returns 400", async () => {
    const mock = makeMockClient({
      data: { pay_basis: "monthly", employment_type: null },
      error: null,
    });
    const input = baseInput({
      salary_base: 60000,
      // missing context to force fetch
    });

    const result = await mergePartialEmployeeUpdate(asClient(mock), input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("PROFILE_EMPLOYMENT_TYPE_NULL");
      expect(result.statusCode).toBe(400);
      expect(result.error).toContain("employment_type");
    }
  });
});

// ── Tests: merged validation failure ───────────────────────────────────────

describe("mergePartialEmployeeUpdate - merged validation failure", () => {
  it("MERGED_VALIDATION_FAILED with schemaErrorCode: below-floor salary fails after merge", async () => {
    const mock = makeMockClient({
      data: { pay_basis: "monthly", employment_type: "full_time" },
      error: null,
    });
    // Input has salary_base = 5000 (below floor) and employment_type = full_time.
    // pay_basis missing, will be filled from DB as 'monthly'.
    // After merge, schema's superRefine sees full_time + monthly + 5000 and rejects.
    const input = baseInput({
      salary_base: 5000,
      employment_type: "full_time",
    });

    const result = await mergePartialEmployeeUpdate(asClient(mock), input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("MERGED_VALIDATION_FAILED");
      expect(result.statusCode).toBe(400);
      // The schema's structured errorCode propagates through.
      expect(result.schemaErrorCode).toBe("BELOW_BASIC_MONTHLY_WAGE");
      // And the human-readable message contains the wage-rule shape phrase.
      expect(result.error).toContain("basic monthly wage");
    }
  });
});
