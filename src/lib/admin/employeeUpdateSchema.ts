// src/lib/admin/employeeUpdateSchema.ts
//
// Atlas EIP - Employee Profile Update Schema
// -------------------------------------------------------------
// Single source of truth for what /api/admin/employees PATCH accepts.
// Pure validation/coercion; no I/O. The handler orchestrates: parse
// with this schema, fetch payroll reference data, apply smart defaults
// (in employeeUpdateDefaults.ts), build the DB update payload.
//
// Three approved rules baked into this schema:
//   Q1 - salary_base allowed as 0 OR >= NT$29,500 (basic wage floor 2026)
//        Rationale: 0 = legitimate placeholder during multi-step onboarding.
//        Below basic wage but positive = data error or wage violation.
//        Compliance Scanner handles the legal-nuance cases.
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
// reject sub-basic-wage values. When 2027 lands, this constant updates
// alongside the bracket data.

/**
 * Basic monthly wage - minimum wage (2026)
 *
 * Source: Ministry of Labor 2025/9/26 announcement
 * Effective: ROC 115/1/1 (2026/1/1)
 * Statutory basis: Minimum Wage Act Article 10
 *
 * Used here ONLY as a validation floor: salary_base must be either 0
 * (placeholder) or at or above this amount (legal employment).
 *
 * Note: this duplicates information in the brackets table. Acceptable
 * here because schema validation cannot be async (cannot fetch brackets).
 * Update this constant when the basic wage changes - same review cycle
 * as the brackets table seed.
 */
const BASIC_MONTHLY_WAGE_2026 = 29_500;

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
 * salary_base field. Special validation: must be 0 (placeholder) or
 * >= basic wage. Sub-basic-wage positive values are rejected.
 */
const SalaryBaseField = z.preprocess(
  blankToUndefined,
  z.coerce
    .number()
    .int()
    .nonnegative()
    .refine(
      (val) => val === 0 || val >= BASIC_MONTHLY_WAGE_2026,
      {
        message: `salary_base must be 0 (unset) or at least the basic wage NT$${BASIC_MONTHLY_WAGE_2026.toLocaleString()}`,
      },
    )
    .optional(),
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

export const EmployeeUpdateSchema = z.object({
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
