// src/lib/admin/mergePartialEmployeeUpdate.ts
//
// Atlas EIP - Partial PATCH validation completion
// -------------------------------------------------------------
// Purpose:
//   The EmployeeUpdateSchema wage-floor rule (Q1) depends on three
//   fields together: salary_base, pay_basis, employment_type. When a
//   PATCH carries salary_base but omits pay_basis or employment_type,
//   the schema's superRefine deliberately skips the floor check
//   because it cannot fail what it cannot see. This helper closes
//   that gap: it fetches the missing context from the DB, merges it
//   with the input, and re-runs schema validation against the merged
//   object.
//
// Design notes (mirroring src/lib/manualApproval.ts):
// - Takes a Supabase client + already-validated input. Pure orchestration.
// - Does NOT enforce auth or org boundaries; the handler does that.
// - Idempotent: read-only DB call. Safe to call twice.
// - Returns a discriminated union with stable errorCodes the handler
//   maps to HTTP status and the UI maps to localized text.
//
// Caller contract:
//   The caller MUST run EmployeeUpdateSchema.safeParse on the input
//   first. This helper does not duplicate shape validation; it only
//   completes the rule-validation that requires DB context.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EmployeeUpdateSchema,
  type EmployeeUpdateInput,
} from "./employeeUpdateSchema";

// ── Module-level constants ─────────────────────────────────────────────────

/**
 * PostgREST error code for ".single() found zero rows".
 * Hoisted to module scope so any future PostgREST no-rows handling in
 * this file (or grep-discoverable across the codebase) shares one
 * named constant.
 *
 * https://docs.postgrest.org/en/v12/references/errors.html
 */
const PGRST_NO_ROWS = "PGRST116";

// ── Types ──────────────────────────────────────────────────────────────────

export interface MergeSuccess {
  ok: true;
  data: EmployeeUpdateInput;
  // True if a DB fetch happened. False when the input already had all
  // the context the schema needed (or when no context was needed at all,
  // e.g., salary_base absent). Useful for tests and future observability.
  contextFetched: boolean;
}

export interface MergeFailure {
  ok: false;
  // Human-readable error for logs and error responses.
  error: string;
  // Stable code the handler maps to HTTP status and the UI maps to
  // localized text. Mirrors the BELOW_BASIC_MONTHLY_WAGE pattern from
  // the schema's superRefine.
  errorCode:
    | "PROFILE_NOT_FOUND"           // user has no profiles row
    | "DB_FETCH_ERROR"               // Supabase returned an error
    | "PROFILE_PAY_BASIS_NULL"       // server-side data integrity violation (see below)
    | "PROFILE_EMPLOYMENT_TYPE_NULL" // user-facing: profile not yet fully filled in
    | "MERGED_VALIDATION_FAILED";    // re-validation after merge failed (e.g., wage floor)
  // HTTP status the handler should return.
  statusCode: 400 | 404 | 500;
  // For MERGED_VALIDATION_FAILED only: the structured errorCode from
  // the failing Zod issue (e.g., BELOW_BASIC_MONTHLY_WAGE), so the
  // handler can pass it through to the UI's i18n bridge.
  //
  // schemaErrorCode: typed as string for now. Convert to a shared
  // SchemaErrorCode union (extracted from employeeUpdateSchema.ts)
  // the next time you add an errorCode to the schema's superRefine.
  // At that point: search the schema for `errorCode:` literals,
  // extract them as a const tuple, derive the union type, import here.
  schemaErrorCode?: string;
}

export type MergeResult = MergeSuccess | MergeFailure;

// ── Implementation ─────────────────────────────────────────────────────────

/**
 * Complete validation for partial PATCHes by fetching missing context
 * from the DB and re-running schema validation against the merged
 * object.
 *
 * If no context fetch is needed (input already complete, or salary_base
 * absent/zero), returns the input unchanged with contextFetched=false.
 *
 * @param client    Supabase client. Service-role expected (matches handler).
 * @param validated Already-shape-validated EmployeeUpdateInput.
 */
export async function mergePartialEmployeeUpdate(
  client: SupabaseClient,
  validated: EmployeeUpdateInput,
): Promise<MergeResult> {
  // 1. Decide whether a DB fetch is needed.
  //
  // The wage-floor rule only fires when salary_base is positive AND
  // pay_basis === 'monthly' AND employment_type === 'full_time'. So
  // we only need DB context when:
  //   - salary_base is present (not undefined)
  //   - salary_base > 0 (0 is the placeholder; schema accepts unconditionally)
  //   - at least one of pay_basis / employment_type is missing
  //
  // All other shapes pass through unchanged.

  const needsFetch =
    validated.salary_base !== undefined &&
    validated.salary_base > 0 &&
    (validated.pay_basis === undefined ||
      validated.employment_type === undefined);

  if (!needsFetch) {
    return { ok: true, data: validated, contextFetched: false };
  }

  // 2. Fetch context from profiles.
  //
  // Single-row read; expects exactly one match because validated.user_id
  // is required by the schema. PostgREST returns code PGRST116 when
  // .single() finds zero rows; we map that to PROFILE_NOT_FOUND. Any
  // other error is surfaced as DB_FETCH_ERROR (500).

  const { data: profile, error } = await client
    .from("profiles")
    .select("pay_basis, employment_type")
    .eq("id", validated.user_id)
    .single();

  if (error) {
    if (error.code === PGRST_NO_ROWS) {
      return {
        ok: false,
        error: "Profile not found for user_id",
        errorCode: "PROFILE_NOT_FOUND",
        statusCode: 404,
      };
    }
    return {
      ok: false,
      error: error.message ?? "Database fetch failed",
      errorCode: "DB_FETCH_ERROR",
      statusCode: 500,
    };
  }

  // 3. Validate fetched context completeness.
  //
  // The two missing-context cases are NOT equivalent and get different
  // HTTP status codes:

  const fetchedPayBasis = profile?.pay_basis ?? null;
  const fetchedEmploymentType = profile?.employment_type ?? null;

  if (fetchedPayBasis === null) {
    // pay_basis was backfilled to 'monthly' by the Phase 3k.1 migration
    // (20260501000001_pay_basis_and_statutory_minimums.sql) with
    // NOT NULL DEFAULT. Under current schema invariants, this branch is
    // unreachable. If it fires, the database is in an inconsistent state -
    // either the migration did not run for this row, or pay_basis was
    // manually set to NULL. Surface as a 500.
    return {
      ok: false,
      error:
        "Profile pay_basis is null. This should not occur after the Phase 3k.1 migration; the database is in an inconsistent state.",
      errorCode: "PROFILE_PAY_BASIS_NULL",
      statusCode: 500,
    };
  }

  if (fetchedEmploymentType === null) {
    // employment_type is genuinely nullable on legacy profiles. This is
    // a real user-facing situation: an admin tries to update salary_base
    // on a profile that never had employment_type filled in. Return a
    // 400 with actionable guidance.
    return {
      ok: false,
      error:
        "Cannot validate wage rule: employment_type is not set on this profile. Edit the profile to set employment_type first.",
      errorCode: "PROFILE_EMPLOYMENT_TYPE_NULL",
      statusCode: 400,
    };
  }

  // 4. Merge: input wins where present, DB fills undefined slots.
  //
  // The ?? operator preserves the input's value when defined (including
  // explicit values the admin chose) and falls back to the DB value
  // only when the input field is undefined.

  const merged: EmployeeUpdateInput = {
    ...validated,
    pay_basis: validated.pay_basis ?? fetchedPayBasis,
    employment_type:
      validated.employment_type ?? fetchedEmploymentType,
  };

  // 5. Re-run schema validation on the merged object.
  //
  // The schema's superRefine now sees full context and can apply the
  // wage-floor rule. If validation fails, propagate the schema's
  // structured errorCode (e.g., BELOW_BASIC_MONTHLY_WAGE) so the
  // handler can route it through to the UI's i18n bridge.

  const reparsed = EmployeeUpdateSchema.safeParse(merged);

  if (!reparsed.success) {
    const issue = reparsed.error.issues[0];
    // If issue.params is missing or has no errorCode field,
    // schemaErrorCode is undefined. This is intentional defensive
    // behavior - see TODO on the schemaErrorCode field above.
    const schemaErrorCode = (
      issue as { params?: { errorCode?: string } }
    ).params?.errorCode;

    return {
      ok: false,
      error: issue.message,
      errorCode: "MERGED_VALIDATION_FAILED",
      statusCode: 400,
      schemaErrorCode,
    };
  }

  // 6. Return success.

  return { ok: true, data: reparsed.data, contextFetched: true };
}
