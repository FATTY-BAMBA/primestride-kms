// src/lib/payroll/bracketLookup.ts
// Pure lookup functions for Taiwan payroll insurance brackets.
// No DB access, no side effects. Caller fetches brackets and passes them in.
//
// Each insurance type (勞保 / 健保 / 勞退) has its own bracket table.
// Brackets are versioned by effective_from/effective_to. The caller is
// responsible for fetching only the brackets active for the run period.

export type LaborInsuranceBracket = {
  id: string;
  effective_from: string; // ISO date 'YYYY-MM-DD'
  effective_to: string | null;
  level: number;
  salary_floor: number;
  salary_ceiling: number | null; // null for top bracket
  insured_amount: number;
};

export type NhiBracket = {
  id: string;
  effective_from: string;
  effective_to: string | null;
  level: number;
  salary_floor: number;
  salary_ceiling: number | null;
  insured_amount: number;
};

export type PensionBracket = {
  id: string;
  effective_from: string;
  effective_to: string | null;
  level: number;
  group_number: number | null;
  salary_floor: number;
  salary_ceiling: number | null;
  contribution_wage: number;
};

/**
 * Find the labor insurance bracket for a given monthly salary.
 *
 * Rules per 勞保條例:
 *   - Salary at or below floor → lowest bracket (high-salary-low-report
 *     prevention; minimum wage floor applies)
 *   - Salary above top ceiling → top bracket (cap)
 *   - Otherwise → first bracket where salary <= salary_ceiling
 *
 * Returns null only if the brackets array is empty.
 */
export function findLaborInsuranceBracket(
  salary: number,
  brackets: LaborInsuranceBracket[],
): LaborInsuranceBracket | null {
  if (brackets.length === 0) return null;
  return findBracketByRange(salary, brackets, (b) => b.level, (b) => b.salary_ceiling);
}

/**
 * Find the NHI bracket for a given monthly salary.
 * Same logic as labor insurance, but uses the NHI bracket table.
 * Note: NHI ceiling (NT$313,000) is much higher than labor insurance ceiling
 * (NT$45,800). An employee earning NT$60,000 is bracketed differently in each.
 */
export function findNhiBracket(
  salary: number,
  brackets: NhiBracket[],
): NhiBracket | null {
  if (brackets.length === 0) return null;
  return findBracketByRange(salary, brackets, (b) => b.level, (b) => b.salary_ceiling);
}

/**
 * Find the pension contribution wage bracket for a given monthly salary.
 * Pension uses 勞退月提繳工資分級表 with 62 levels — completely different
 * structure from labor insurance.
 */
export function findPensionBracket(
  salary: number,
  brackets: PensionBracket[],
): PensionBracket | null {
  if (brackets.length === 0) return null;
  return findBracketByRange(salary, brackets, (b) => b.level, (b) => b.salary_ceiling);
}

/**
 * Generic bracket-finder shared by all three insurance types.
 * Sorts by level ascending, finds first row where salary <= ceiling.
 * If no match (salary above all ceilings), returns the highest-level row.
 */
function findBracketByRange<T>(
  salary: number,
  brackets: T[],
  getLevel: (b: T) => number,
  getCeiling: (b: T) => number | null,
): T {
  // Sort ascending by level (caller may pass unsorted)
  const sorted = [...brackets].sort((a, b) => getLevel(a) - getLevel(b));

  for (const bracket of sorted) {
    const ceiling = getCeiling(bracket);
    // Top bracket has null ceiling — anything reaching here matches
    if (ceiling === null) return bracket;
    if (salary <= ceiling) return bracket;
  }

  // Fallback: salary exceeds all ceilings (shouldn't happen if top bracket
  // has null ceiling, but defend against malformed data)
  return sorted[sorted.length - 1];
}