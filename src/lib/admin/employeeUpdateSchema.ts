// src/lib/admin/employeeUpdateSchema.ts
//
// Atlas EIP - Employee Profile Update Schema
// -------------------------------------------------------------
// Single source of truth for what /api/admin/employees PATCH accepts.
// Pure validation/coercion; no I/O. The handler orchestrates: parse
// with this schema, fetch payroll reference data, apply smart defaults
// (in employeeUpdateDefaults.ts), build the DB update payload.
//
// Approved rules baked into this schema:
//   Q1 - salary_base wage-floor check is conditional on pay_basis and
//        employment_type:
//        - undefined: skip (caller did not touch the field)
//        - 0: allow (legitimate placeholder during multi-step onboarding)
//        - positive AND pay_basis='monthly' AND employment_type='full_time':
//          must be >= the basic monthly wage (Taiwan 2026: NT$29,500)
//        - any other combination: no schema-level floor (hourly workers,
//          part-timers on prorated monthly pay, contractors outside LSA,
//          and interns are all handled differently or outside the LSA)
//        For partial PATCHes that omit pay_basis or employment_type, the
//        handler is responsible for fetching the existing values from the
//        DB and re-running this schema with the merged context. This is
//        why missing context skips rather than fails.
//   Q2 - Under-reporting NOT validated at schema level.
//        Rationale: legal definition uses total monthly comp,
//        not salary_base. Compliance Scanner has the context.
//   Q3 - Explicit 0 wins over smart-defaults.
//        Smart-defaults fire only when field is undefined (omitted/blank).
//        Implemented in companion module employeeUpdateDefaults.ts.
//
// FORM CONTRACT:
//   AdminDashboard sends: { user_id, ...editForm }
//   Where editForm[field] is "" for blank inputs (form initializes empty
//   strings, not undefined). The blankToUndefined preprocessor maps "" to
//   undefined BEFORE Zod sees the value, so optional() works as expected.

import { z } from "zod";

// ------------------------------------------------------------
// Constants - only the schema's own validation thresholds
// ------------------------------------------------------------
//
// IMPORTANT: payroll ceilings (NHI 313K, Labor 45.8K, Pension 150K)
// are NOT hardcoded here. They live in the bracket tables fetched by
// fetchPayrollReferenceData(). Smart-defaults read from there.
//
// The basic wage floor IS hardcoded here as a validation threshold
// (not a calculation input) - it changes annually and the schema must
// reject sub-basic-wage values for the worker categories where it
// applies.

/**
 * Pay basis values - how a worker is compensated.
 *
 * Mirrors the CHECK constraint on profiles.pay_basis added in
 * migration 20260501000001_pay_basis_and_statutory_minimums.sql.
 *
 * Exported for use by form components (Layer 4) and any other code
 * that needs the canonical list. Single source of truth.
 */
export const PAY_BASIS_VALUES = [
  "monthly",
  "hourly",
  "daily",
  "piecework",
  "not_applicable",
] as const;

export type PayBasis = (typeof PAY_BASIS_VALUES)[number];

/**
 * Basic monthly wage - Taiwan minimum wage (2026)
 *
 * Source: Ministry of Labor 2025/9/26 announcement
 * Effective: ROC 115/1/1 (2026/1/1)
 * Statutory basis: Minimum Wage Act Article 10
 *
 * Used here ONLY as a validation floor: when salary_base is positive
 * AND pay_basis='monthly' AND employment_type='full_time', salary_base
 * must be at or above this amount.
 *
 * !!! WARNING - INTENTIONAL-BUT-TEMPORARY DUPLICATION !!!
 *
 * This value MUST stay in sync with the latest TW row of
 * statutory_minimums in:
 *   supabase/migrations/20260501000001_pay_basis_and_statutory_minimums.sql
 *
 * If you change one without the other, validation silently diverges
 * from what the database considers the truth. The deliberately ugly
 * name is the alarm: any time you read or modify this constant, the
 * name reminds you to update the migration too (or vice versa).
 *
 * TODO(Phase 3k.x): Replace this constant with a schema-factory pattern
 * that reads the basic wage from statutory_minimums via the handler. The
 * handler already fetches PayrollReferenceData; extend that fetch to
 * include the basic wage, then pass it to a makeEmployeeUpdateSchema
 * factory. Schema validation is sync, so the factory must receive an
 * already-resolved value rather than fetch internally.
 */
const BASIC_MONTHLY_WAGE_DUPLICATED_FROM_DB = 29_500;

// ------------------------------------------------------------
// Pre-processors - convert form-sent strings to typed values
// ------------------------------------------------------------

/**
 * Empty string and null become undefined.
 * "Blank in form" === "field absent" semantically.
 */
const blankToUndefined = (val: unknown): unknown => {
  if (val === "" || val === null) return undefined;
  return val;
};

/**
 * Number field accepting 0 or positive integers. Blank to absent.
 * Used for: nhi_insured_salary, labor_insured_salary, pension_contribution_wage,
 *           attendance_bonus_monthly.
 */
const NonNegativeIntField = z.preprocess(
  blankToUndefined,
  z.coerce.number().int().nonnegative().optional(),
);

/**
 * salary_base field. Shape-only at the field level: 0 or positive integer.
 * The wage-floor rule (Q1) is enforced at the object level via
 * superRefine() because it depends on pay_basis and employment_type.
 */
const SalaryBaseField = z.preprocess(
  blankToUndefined,
  z.coerce.number().int().nonnegative().optional(),
);

/**
 * Date field: accepts YYYY-MM-DD string. Blank to absent.
 * Validates format AND that the string parses as a real date.
 */
const DateField = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format")
    .refine(
      (s) => {
        const d = new Date(s);
        return !isNaN(d.getTime());
      },
      { message: "Invalid date" },
    )
    .optional(),
);

/**
 * Optional trimmed string. Blank to absent (does NOT clear the column).
 * To explicitly clear, admin must use a different mechanism (not exposed
 * in the current AdminDashboard form).
 */
const OptionalStringField = z.preprocess(
  blankToUndefined,
  z.string().trim().min(1).optional(),
);

// ------------------------------------------------------------
// Main schema - the API contract
// ------------------------------------------------------------

export const EmployeeUpdateSchema = z
  .object({
    // Identity (required)
    user_id: z.string().min(1, "user_id is required"),

    // Personal info
    full_name: OptionalStringField,
    phone: OptionalStringField,
    address: OptionalStringField,
    national_id: OptionalStringField,
    birth_date: DateField,
    gender: OptionalStringField,
    nationality: OptionalStringField,

    // Emergency contact
    emergency_contact_name: OptionalStringField,
    emergency_contact_phone: OptionalStringField,

    // Employment
    hire_date: DateField,
    department: OptionalStringField,
    job_title: OptionalStringField,
    employee_id: OptionalStringField,
    employment_type: z.preprocess(
      blankToUndefined,
      z.enum(["full_time", "part_time", "contractor", "intern"]).optional(),
    ),
    pay_basis: z.preprocess(
      blankToUndefined,
      z.enum(PAY_BASIS_VALUES).optional(),
    ),

    // Banking
    bank_code: OptionalStringField,
    bank_account: OptionalStringField,

    // Insurance ID numbers
    labor_insurance_id: OptionalStringField,
    health_insurance_id: OptionalStringField,

    // PAYROLL CALCULATOR FIELDS
    salary_base: SalaryBaseField,
    nhi_insured_salary: NonNegativeIntField,
    labor_insured_salary: NonNegativeIntField,
    attendance_bonus_monthly: NonNegativeIntField,
    pension_contribution_wage: NonNegativeIntField,

    // Currency
    salary_currency: OptionalStringField,

    // Termination
    termination_date: DateField,
    termination_reason: OptionalStringField,

    // Notes
    notes: OptionalStringField,
  })
  .superRefine((data, ctx) => {
    // Q1 wage-floor rule (object-level because it depends on multiple fields).
    //
    // Skip cases (in order):
    //   1. salary_base undefined - caller did not touch the field.
    //   2. salary_base === 0    - legitimate placeholder during onboarding.
    //   3. pay_basis or employment_type missing - handler will fetch
    //      existing values from DB and re-run this schema with the merged
    //      context. Schema cannot fail what it cannot see.
    //
    // Fail case:
    //   pay_basis === 'monthly' AND employment_type === 'full_time'
    //   AND salary_base < BASIC_MONTHLY_WAGE_DUPLICATED_FROM_DB
    //
    // All other combinations pass at the schema layer, but several
    // of them have known gaps that should be addressed in future
    // phases. These gaps are documented here, mirrored in the test
    // file, and tracked as TODO(Phase 3k.x):
    //
    // - hourly workers: Taiwan has a statutory hourly minimum
    //   (NT$196/hr in 2026, same MOL announcement as the monthly
    //   minimum) which we do not enforce here. salary_base for
    //   hourly workers stores the hourly rate, and the schema-
    //   factory refactor should add hourly-floor enforcement
    //   alongside the monthly one.
    //
    // - part-timers on prorated monthly pay: legal below the
    //   monthly floor when contracted hours are reduced. We do not
    //   track contracted hours today so we cannot compute the
    //   prorated floor and do not enforce. Adding a
    //   contracted_hours_per_week field would let us enforce the
    //   prorated rule.
    //
    // - contractors: schema trusts the contractor classification
    //   and does not enforce a floor. Misclassification risk
    //   (false-contractor, real-employment in Taiwan labor law) is
    //   a Compliance Scanner concern, not a schema concern.
    //
    // - interns: schema does not distinguish learning-type
    //   (typically university-affiliated, outside LSA) from labor-
    //   type (LSA-covered and entitled to minimum wage). All
    //   interns currently bypass the floor check. Adding an
    //   intern_subtype field would let us enforce correctly for
    //   labor-type interns.
    //
    // The error includes a structured code in params so the UI
    // layer can surface a localized message without parsing the
    // English text.

    if (data.salary_base === undefined) return;
    if (data.salary_base === 0) return;
    if (data.pay_basis === undefined) return;
    if (data.employment_type === undefined) return;

    if (
      data.pay_basis === "monthly" &&
      data.employment_type === "full_time" &&
      data.salary_base < BASIC_MONTHLY_WAGE_DUPLICATED_FROM_DB
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salary_base"],
        message: `For full-time monthly-paid employees, salary_base must be 0 (placeholder) or at least the basic monthly wage NT$${BASIC_MONTHLY_WAGE_DUPLICATED_FROM_DB.toLocaleString()} (2026)`,
        params: { errorCode: "BELOW_BASIC_MONTHLY_WAGE" },
      });
    }
  });

export type EmployeeUpdateInput = z.infer<typeof EmployeeUpdateSchema>;

// ------------------------------------------------------------
// Update payload builder - converts validated input to DB UPDATE shape
// ------------------------------------------------------------

/**
 * Strips user_id, adds updated_at,
 * removes any undefined fields (so DB columns stay untouched).
 *
 * The result is safe to pass directly to supabase.update().
 */
export function buildSupabaseUpdate(
  input: EmployeeUpdateInput,
): Record<string, unknown> {
  const { user_id, ...rest } = input;
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      update[key] = value;
    }
  }
  return update;
}
