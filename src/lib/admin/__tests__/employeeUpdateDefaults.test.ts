// src/lib/admin/__tests__/employeeUpdateDefaults.test.ts
//
// Atlas EIP - Tests for applyTaiwanPayrollDefaults
// Strategy: pure-function tests with synthetic bracket data.

import { describe, it, expect } from "vitest";
import { applyTaiwanPayrollDefaults } from "../employeeUpdateDefaults";
import type { EmployeeUpdateInput } from "../employeeUpdateSchema";
import type { PayrollReferenceData } from "@/lib/payroll/fetchBrackets";

// Synthetic bracket fixtures - Taiwan 2026 real tiers
const SYNTHETIC_BRACKETS: PayrollReferenceData = {
  labor: [
    { id: "L1", effective_from: "2026-01-01", effective_to: null, level: 1, salary_floor: 0, salary_ceiling: 29500, insured_amount: 29500 },
    { id: "L2", effective_from: "2026-01-01", effective_to: null, level: 2, salary_floor: 29501, salary_ceiling: 30300, insured_amount: 30300 },
    { id: "L3", effective_from: "2026-01-01", effective_to: null, level: 3, salary_floor: 30301, salary_ceiling: 31800, insured_amount: 31800 },
    { id: "L11", effective_from: "2026-01-01", effective_to: null, level: 11, salary_floor: 43901, salary_ceiling: null, insured_amount: 45800 },
  ],
  nhi: [
    { id: "N1", effective_from: "2026-01-01", effective_to: null, level: 1, salary_floor: 0, salary_ceiling: 29500, insured_amount: 29500 },
    { id: "N6", effective_from: "2026-01-01", effective_to: null, level: 6, salary_floor: 33301, salary_ceiling: 34800, insured_amount: 34800 },
    { id: "N15", effective_from: "2026-01-01", effective_to: null, level: 15, salary_floor: 57801, salary_ceiling: 60800, insured_amount: 60800 },
    { id: "N58", effective_from: "2026-01-01", effective_to: null, level: 58, salary_floor: 219501, salary_ceiling: null, insured_amount: 313000 },
  ],
  pension: [
    { id: "P1", effective_from: "2026-01-01", effective_to: null, level: 1, group_number: 1, salary_floor: 0, salary_ceiling: 1500, contribution_wage: 1500 },
    { id: "P28", effective_from: "2026-01-01", effective_to: null, level: 28, group_number: 5, salary_floor: 28801, salary_ceiling: 30000, contribution_wage: 30000 },
    { id: "P40", effective_from: "2026-01-01", effective_to: null, level: 40, group_number: 7, salary_floor: 57801, salary_ceiling: 60800, contribution_wage: 60800 },
    { id: "P62", effective_from: "2026-01-01", effective_to: null, level: 62, group_number: 12, salary_floor: 147901, salary_ceiling: null, contribution_wage: 150000 },
  ],
  rates: {
    id: "R1", effective_from: "2026-01-01", effective_to: null,
    labor_total_rate: 0.125, labor_employee_share: 0.20,
    labor_employer_share: 0.70, labor_government_share: 0.10,
    nhi_rate: 0.0517, nhi_employee_share: 0.30,
    nhi_employer_share: 0.60, nhi_government_share: 0.10,
    nhi_avg_dependents: 0.56, nhi_dependent_cap: 3,
    pension_employer_min_rate: 0.06, pension_employee_max_rate: 0.06,
    nhi_supplementary_rate: 0.0211, nhi_supplementary_bonus_multiplier: 4,
  },
  fixtures: [],
};

const baseInput = (overrides: Partial<EmployeeUpdateInput> = {}): EmployeeUpdateInput => ({
  user_id: "user_test",
  ...overrides,
} as EmployeeUpdateInput);

describe("applyTaiwanPayrollDefaults - skip cases", () => {
  it("returns unchanged input when salary_base is undefined", () => {
    const input = baseInput();
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.nhi_insured_salary).toBeUndefined();
    expect(result.labor_insured_salary).toBeUndefined();
    expect(result.pension_contribution_wage).toBeUndefined();
  });

  it("returns unchanged input when salary_base = 0 (placeholder)", () => {
    const input = baseInput({ salary_base: 0 });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.nhi_insured_salary).toBeUndefined();
    expect(result.labor_insured_salary).toBeUndefined();
    expect(result.pension_contribution_wage).toBeUndefined();
  });

  it("does not mutate the input object", () => {
    const input = baseInput({ salary_base: 60000 });
    const inputCopy = { ...input };
    applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(input).toEqual(inputCopy);
  });
});

describe("applyTaiwanPayrollDefaults - smart-default fires when blank (Q3 rule)", () => {
  it("fills nhi_insured_salary from bracket when blank", () => {
    const input = baseInput({ salary_base: 60000 });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.nhi_insured_salary).toBe(60800);
  });

  it("fills labor_insured_salary from bracket when blank", () => {
    const input = baseInput({ salary_base: 60000 });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.labor_insured_salary).toBe(45800);
  });

  it("fills pension_contribution_wage from bracket when blank", () => {
    const input = baseInput({ salary_base: 60000 });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.pension_contribution_wage).toBe(60800);
  });

  it("fills all three defaults at once when all blank", () => {
    const input = baseInput({ salary_base: 30000 });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    // 30000 > 29500 (N1 ceiling), walks to N6 where ceiling = 34800. 30000 <= 34800 passes.
    expect(result.nhi_insured_salary).toBe(34800);
    expect(result.labor_insured_salary).toBe(30300);
    expect(result.pension_contribution_wage).toBe(30000);
  });
});

describe("applyTaiwanPayrollDefaults - explicit values win over defaults (Q3 rule)", () => {
  it("respects explicit nhi_insured_salary over default", () => {
    const input = baseInput({ salary_base: 60000, nhi_insured_salary: 50000 });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.nhi_insured_salary).toBe(50000); // explicit wins
    expect(result.labor_insured_salary).toBe(45800); // labor still defaults
  });

  it("respects explicit zero (admin sets bonus to 0)", () => {
    const input = baseInput({ salary_base: 60000, nhi_insured_salary: 0 });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.nhi_insured_salary).toBe(0); // explicit 0 wins
  });

  it("respects all three explicit values", () => {
    const input = baseInput({
      salary_base: 60000,
      nhi_insured_salary: 50000,
      labor_insured_salary: 45000,
      pension_contribution_wage: 40000,
    });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.nhi_insured_salary).toBe(50000);
    expect(result.labor_insured_salary).toBe(45000);
    expect(result.pension_contribution_wage).toBe(40000);
  });
});

describe("applyTaiwanPayrollDefaults - bracket boundary cases", () => {
  it("snaps salary above all labor brackets to top tier (45800 cap)", () => {
    const input = baseInput({ salary_base: 200000 });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.labor_insured_salary).toBe(45800);
  });

  it("snaps salary above all NHI brackets to top tier (313000 cap)", () => {
    const input = baseInput({ salary_base: 500000 });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.nhi_insured_salary).toBe(313000);
  });

  it("snaps salary above all pension brackets to top tier (150000 cap)", () => {
    const input = baseInput({ salary_base: 500000 });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.pension_contribution_wage).toBe(150000);
  });

  it("uses the lowest tier for salary at basic wage (29500)", () => {
    const input = baseInput({ salary_base: 29500 });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.labor_insured_salary).toBe(29500); // L1
    expect(result.nhi_insured_salary).toBe(29500); // N1
  });
});

describe("applyTaiwanPayrollDefaults - real-world scenarios", () => {
  it("CEO with NT$200,000 salary - all caps applied correctly", () => {
    const input = baseInput({ salary_base: 200000 });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.labor_insured_salary).toBe(45800);
    expect(result.nhi_insured_salary).toBe(313000);
    expect(result.pension_contribution_wage).toBe(150000);
  });

  it("New hire at minimum wage (29500) - all use lowest brackets", () => {
    const input = baseInput({ salary_base: 29500 });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.labor_insured_salary).toBe(29500);
    expect(result.nhi_insured_salary).toBe(29500);
    // P1 ceiling is 1500, walks past to P28 (30000)
    expect(result.pension_contribution_wage).toBe(30000);
  });

  it("admin updates only phone, no payroll defaults applied", () => {
    const input = baseInput({ phone: "0912345678" });
    const result = applyTaiwanPayrollDefaults(input, SYNTHETIC_BRACKETS);
    expect(result.nhi_insured_salary).toBeUndefined();
    expect(result.labor_insured_salary).toBeUndefined();
    expect(result.pension_contribution_wage).toBeUndefined();
    expect(result.phone).toBe("0912345678");
  });
});
