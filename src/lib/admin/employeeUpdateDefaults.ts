// src/lib/admin/employeeUpdateDefaults.ts
//
// Atlas EIP - Taiwan Payroll Smart-Defaults
// ------------------------------------------------------------
// Pure function that applies Taiwan payroll smart-defaults to validated
// EmployeeUpdateInput. No I/O; caller fetches reference data and passes
// it in. Testable with synthetic bracket data.
//
// Smart defaults fire ONLY when:
//   1. salary_base is being updated (present in input)
//   2. salary_base > 0 (positive, not the 0-placeholder case)
//   3. the dependent field is undefined (admin didn't set it)
//
// The bracket lookups are the source of truth for ceilings/tiers.
// Nhi_insured_salary = bracket.insured_amount (with NH! ceiling 313,000)
// Labor_insured_salary = bracket.insured_amount (with Labor ceiling 45,800)
// Pension_contribution_wage = bracket.contribution_wage (with Pension ceiling 150,000)
//
// This replaces the ad-hoc hardcoded Math.min(salary, 45800) logic in the
// original Phase 3j route handler. Brackets are effective-dated in the DB,
// so this automatically handles 2027/2028/etc. changes without code edits.

import {
  findLaborInsuranceBracket,
  findNhiBracket,
  findPensionBracket,
} from "@/lib/payroll/bracketLookup";
import type { PayrollReferenceData } from "@/lib/payroll/fetchBrackets";
import type { EmployeeUpdateInput } from "./employeeUpdateSchema";

/**
 * Apply Taiwan payroll smart-defaults.
 *
 * Given validated input and payroll reference data, returns a new input
 * with NHI/Labor/Pension fields filled in where:
 *   - salary_base is present and positive
 *   - the dependent field was undefined (admin left blank)
 *
 * Does not mutate the input. Returns a new object.
 */
export function applyTaiwanPayrollDefaults(
  input: EmployeeUpdateInput,
  refData: PayrollReferenceData,
): EmployeeUpdateInput {
  const result: EmployeeUpdateInput = { ...input };

  // Only fire if salary_base is being updated to a positive value.
  // salary_base = 0 is the "unset/placeholder" case - skip defaults.
  // salary_base = undefined means admin didn't touch this field - skip.
  if (result.salary_base === undefined || result.salary_base <= 0) {
    return result;
  }

  const salary = result.salary_base;

  // NHI insured salary - fire if admin left it blank
  if (result.nhi_insured_salary === undefined) {
    const bracket = findNhiBracket(salary, refData.nhi);
    if (bracket) {
      result.nhi_insured_salary = bracket.insured_amount;
    }
  }

  // Labor insured salary - fire if admin left it blank
  if (result.labor_insured_salary === undefined) {
    const bracket = findLaborInsuranceBracket(salary, refData.labor);
    if (bracket) {
      result.labor_insured_salary = bracket.insured_amount;
    }
  }

  // Pension contribution wage - fire if admin left it blank
  if (result.pension_contribution_wage === undefined) {
    const bracket = findPensionBracket(salary, refData.pension);
    if (bracket) {
      result.pension_contribution_wage = bracket.contribution_wage;
    }
  }

  return result;
}
