// src/lib/admin/__tests__/employeeUpdateSchema.test.ts
//
// Atlas EIP - Tests for EmployeeUpdateSchema
// Strategy: pure-function tests against Zod schema. No I/O, no DB.

import { describe, it, expect } from "vitest";
import {
  EmployeeUpdateSchema,
  buildSupabaseUpdate,
} from "../employeeUpdateSchema";

const VALID_USER_ID = "user_3AcbPiBj0LCsYZHzchgbzO2ywtU";

describe("EmployeeUpdateSchema - required fields", () => {
  it("accepts minimal valid input (only user_id)", () => {
    const result = EmployeeUpdateSchema.safeParse({ user_id: VALID_USER_ID });
    expect(result.success).toBe(true);
  });

  it("rejects missing user_id", () => {
    const result = EmployeeUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty string user_id", () => {
    const result = EmployeeUpdateSchema.safeParse({ user_id: "" });
    expect(result.success).toBe(false);
  });
});

describe("EmployeeUpdateSchema - salary_base validation (Q1 rule)", () => {
  it("accepts salary_base = 0 (placeholder for unset)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.salary_base).toBe(0);
  });

  it("accepts salary_base = 29500 (basic wage 2026)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 29500,
    });
    expect(result.success).toBe(true);
  });

  it("accepts salary_base = 60000 (above basic wage)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 60000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects salary_base = 5000 (below basic wage but positive)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 5000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("29,500");
    }
  });

  it("rejects salary_base = 29499 (one below basic wage)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 29499,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative salary_base", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: -1000,
    });
    expect(result.success).toBe(false);
  });

  it("treats blank string salary_base as undefined (omitted)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.salary_base).toBeUndefined();
  });

  it("coerces string '60000' to number 60000", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: "60000",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.salary_base).toBe(60000);
  });
});

describe("EmployeeUpdateSchema - other number fields", () => {
  it("accepts nhi_insured_salary = 0 (explicit zero)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      nhi_insured_salary: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.nhi_insured_salary).toBe(0);
  });

  it("accepts attendance_bonus_monthly = 1500", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      attendance_bonus_monthly: 1500,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative attendance_bonus_monthly", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      attendance_bonus_monthly: -100,
    });
    expect(result.success).toBe(false);
  });

  it("treats blank labor_insured_salary as undefined", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      labor_insured_salary: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.labor_insured_salary).toBeUndefined();
  });

  it("treats null pension_contribution_wage as undefined", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      pension_contribution_wage: null,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pension_contribution_wage).toBeUndefined();
  });
});

describe("EmployeeUpdateSchema - date fields", () => {
  it("accepts valid YYYY-MM-DD hire_date", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      hire_date: "2024-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      hire_date: "01/15/2024",
    });
    expect(result.success).toBe(false);
  });

  it("accepts Feb 30 (JavaScript Date permissive; documented limitation)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      hire_date: "2024-02-30",
    });
    // JS Date interprets Feb 30 as Mar 2. Our refine check passes.
    expect(result.success).toBe(true);
  });

  it("treats blank hire_date as undefined", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      hire_date: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hire_date).toBeUndefined();
  });
});

describe("EmployeeUpdateSchema - employment_type enum", () => {
  it("accepts full_time", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      employment_type: "full_time",
    });
    expect(result.success).toBe(true);
  });

  it("accepts part_time", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      employment_type: "part_time",
    });
    expect(result.success).toBe(true);
  });

  it("accepts contractor", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      employment_type: "contractor",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown employment_type", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      employment_type: "consultant",
    });
    expect(result.success).toBe(false);
  });

  it("treats blank employment_type as undefined", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      employment_type: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.employment_type).toBeUndefined();
  });
});

describe("EmployeeUpdateSchema - string fields", () => {
  it("accepts and trims full_name", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      full_name: "  Heng Chang  ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.full_name).toBe("Heng Chang");
  });

  it("treats blank string as undefined (does not clear)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      full_name: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.full_name).toBeUndefined();
  });

  it("rejects whitespace-only (fails min(1) after trim)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      full_name: "   ",
    });
    expect(result.success).toBe(false);
  });
});

describe("buildSupabaseUpdate", () => {
  it("strips user_id from output", () => {
    const result = buildSupabaseUpdate({
      user_id: VALID_USER_ID,
      full_name: "Test",
    } as any);
    expect(result.user_id).toBeUndefined();
    expect(result.full_name).toBe("Test");
  });

  it("adds updated_at timestamp", () => {
    const result = buildSupabaseUpdate({ user_id: VALID_USER_ID } as any);
    expect(typeof result.updated_at).toBe("string");
    expect(result.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("strips undefined fields (column stays untouched)", () => {
    const result = buildSupabaseUpdate({
      user_id: VALID_USER_ID,
      full_name: undefined,
      salary_base: 60000,
    } as any);
    expect(result.full_name).toBeUndefined();
    expect("full_name" in result).toBe(false);
    expect(result.salary_base).toBe(60000);
  });

  it("preserves explicit zero (treats 0 as a real value)", () => {
    const result = buildSupabaseUpdate({
      user_id: VALID_USER_ID,
      attendance_bonus_monthly: 0,
    } as any);
    expect(result.attendance_bonus_monthly).toBe(0);
  });
});
