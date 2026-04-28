// src/lib/payroll/fetchBrackets.ts
//
// Fetches payroll reference data (insurance brackets, rates, fixtures)
// from the dedicated `payroll` schema in Supabase.
//
// Uses the service-role client (admin.ts) — bypasses RLS.
// All reads happen server-side; never expose this to the browser.
//
// Type definitions are imported from the lookup/calc modules to keep a
// single source of truth. This file only fetches; it does not redefine
// shapes.

import { adminClient } from "@/lib/supabase/admin";
import type {
  LaborInsuranceBracket,
  NhiBracket,
  PensionBracket,
} from "./bracketLookup";
import type { BracketFixture } from "./deductionCalc";

// ── insurance_rates row shape (from `payroll.insurance_rates` schema) ───

export type InsuranceRates = {
  id: string;
  effective_from: string;
  effective_to: string | null;
  labor_total_rate: number;
  labor_employee_share: number;
  labor_employer_share: number;
  labor_government_share: number;
  nhi_rate: number;
  nhi_employee_share: number;
  nhi_employer_share: number;
  nhi_government_share: number;
  nhi_avg_dependents: number;
  nhi_dependent_cap: number;
  pension_employer_min_rate: number;
  pension_employee_max_rate: number;
  nhi_supplementary_rate: number;
  nhi_supplementary_bonus_multiplier: number;
};

export type PayrollReferenceData = {
  labor: LaborInsuranceBracket[];
  nhi: NhiBracket[];
  pension: PensionBracket[];
  rates: InsuranceRates;
  fixtures: BracketFixture[];
};

// ── Effective-date helper ────────────────────────────────────────────

/**
 * Returns the canonical "effective date" for a payroll period.
 * Convention: first day of the month — brackets/rates effective on or
 * before that date apply to the full month.
 */
export function effectiveDateForPeriod(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

// ── Main fetch function ──────────────────────────────────────────────

/**
 * Fetches all reference data needed to calculate payroll deductions for
 * a given effective date.
 *
 * @param effectiveDate - The date for which brackets/rates should be valid
 * @returns Promise<PayrollReferenceData>
 * @throws if no brackets/rates exist for the given date
 */
export async function fetchPayrollReferenceData(
  effectiveDate: Date,
): Promise<PayrollReferenceData> {
  const client = adminClient();
  const dateStr = effectiveDate.toISOString().split("T")[0];

  // All five queries run in parallel.
  const [laborResult, nhiResult, pensionResult, ratesResult, fixturesResult] =
    await Promise.all([
      client
        .schema("payroll")
        .from("labor_insurance_brackets")
        .select(
          "id, effective_from, effective_to, level, salary_floor, salary_ceiling, insured_amount",
        )
        .lte("effective_from", dateStr)
        .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
        .order("level", { ascending: true }),

      client
        .schema("payroll")
        .from("nhi_brackets")
        .select(
          "id, effective_from, effective_to, level, salary_floor, salary_ceiling, insured_amount",
        )
        .lte("effective_from", dateStr)
        .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
        .order("level", { ascending: true }),

      client
        .schema("payroll")
        .from("pension_brackets")
        .select(
          "id, effective_from, effective_to, level, group_number, salary_floor, salary_ceiling, contribution_wage",
        )
        .lte("effective_from", dateStr)
        .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
        .order("level", { ascending: true }),

      client
        .schema("payroll")
        .from("insurance_rates")
        .select(
          "id, effective_from, effective_to, labor_total_rate, labor_employee_share, labor_employer_share, labor_government_share, nhi_rate, nhi_employee_share, nhi_employer_share, nhi_government_share, nhi_avg_dependents, nhi_dependent_cap, pension_employer_min_rate, pension_employee_max_rate, nhi_supplementary_rate, nhi_supplementary_bonus_multiplier",
        )
        .lte("effective_from", dateStr)
        .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
        .single(),

      client
        .schema("payroll")
        .from("bracket_verification_fixtures")
        .select(
          "insurance_type, level, insured_amount, expected_employee_amount, expected_employer_amount, expected_government_amount, expected_employee_1_dep, expected_employee_2_dep, expected_employee_3_dep",
        )
        .order("insurance_type", { ascending: true })
        .order("level", { ascending: true }),
    ]);

  // ── Error checks ──
  if (laborResult.error)
    throw new Error(`Failed to fetch labor brackets: ${laborResult.error.message}`);
  if (nhiResult.error)
    throw new Error(`Failed to fetch NHI brackets: ${nhiResult.error.message}`);
  if (pensionResult.error)
    throw new Error(`Failed to fetch pension brackets: ${pensionResult.error.message}`);
  if (ratesResult.error)
    throw new Error(`Failed to fetch insurance rates: ${ratesResult.error.message}`);
  if (fixturesResult.error)
    throw new Error(`Failed to fetch fixtures: ${fixturesResult.error.message}`);

  if (!laborResult.data || laborResult.data.length === 0)
    throw new Error(`No labor insurance brackets found for ${dateStr}`);
  if (!nhiResult.data || nhiResult.data.length === 0)
    throw new Error(`No NHI brackets found for ${dateStr}`);
  if (!pensionResult.data || pensionResult.data.length === 0)
    throw new Error(`No pension brackets found for ${dateStr}`);
  if (!ratesResult.data)
    throw new Error(`No insurance rates found for ${dateStr}`);

  return {
    labor: laborResult.data as LaborInsuranceBracket[],
    nhi: nhiResult.data as NhiBracket[],
    pension: pensionResult.data as PensionBracket[],
    rates: ratesResult.data as InsuranceRates,
    fixtures: (fixturesResult.data ?? []) as BracketFixture[],
  };
}