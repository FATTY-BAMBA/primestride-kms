// src/lib/admin/__tests__/employeeUpdateSchema.test.ts
//
// Atlas EIP - Tests for EmployeeUpdateSchema
// Strategy: pure-function tests against Zod schema. No I/O, no DB.
//
// Some tests in this file are explicitly marked as KNOWN GAP. They
// document behavior that is currently accepted by the schema but
// should be enforced once the schema-factory refactor lands. When
// those gaps are closed, flip the assertion in the marked tests
// from `expect(true)` to `expect(false)` so the test catches the
// fix rather than silently passing.
//
// The schema-side documentation of these gaps lives in the
// superRefine block of employeeUpdateSchema.ts.

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

describe("EmployeeUpdateSchema - salary_base validation (Q1 rule, conditional on pay_basis + employment_type)", () => {
  // Cases that pass regardless of pay_basis / employment_type.

  it("accepts salary_base = 0 (placeholder for unset)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.salary_base).toBe(0);
  });

  it("accepts salary_base = 29500 with full_time + monthly (at floor)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 29500,
      pay_basis: "monthly",
      employment_type: "full_time",
    });
    expect(result.success).toBe(true);
  });

  it("accepts salary_base = 60000 with full_time + monthly (above floor)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 60000,
      pay_basis: "monthly",
      employment_type: "full_time",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative salary_base (field-level shape check)", () => {
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

  // Fail case: full_time + monthly + below floor.

  it("rejects salary_base = 5000 with full_time + monthly (below floor)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 5000,
      pay_basis: "monthly",
      employment_type: "full_time",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Assert the message shape, not the specific number, so this test
      // survives the next annual minimum-wage update without edits.
      expect(result.error.issues[0].message).toContain("basic monthly wage");
      // The structured errorCode is the contract the UI layer translates
      // against. Asserting it locks in the i18n bridge.
      expect(
        (result.error.issues[0] as { params?: { errorCode?: string } }).params
          ?.errorCode,
      ).toBe("BELOW_BASIC_MONTHLY_WAGE");
    }
  });

  it("rejects salary_base = 29499 with full_time + monthly (one below floor)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 29499,
      pay_basis: "monthly",
      employment_type: "full_time",
    });
    expect(result.success).toBe(false);
  });

  // Pass cases: same below-floor salary, but the rule does not apply
  // because of pay_basis or employment_type. Several of these are
  // documented gaps - see the superRefine comment in the schema file.

  it("accepts salary_base = 15000 with part_time + monthly (no schema-level enforcement; contracted hours not modeled - see schema gap note)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 15000,
      pay_basis: "monthly",
      employment_type: "part_time",
    });
    expect(result.success).toBe(true);
  });

  it("accepts salary_base = 200 with full_time + hourly (above NT$196 hourly minimum; schema does not enforce hourly floor in this layer)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 200,
      pay_basis: "hourly",
      employment_type: "full_time",
    });
    expect(result.success).toBe(true);
  });

  it("KNOWN GAP: accepts salary_base = 50 with full_time + hourly (below NT$196 hourly minimum). Should fail under proper hourly-floor enforcement; flip when Phase 3k.x lands.", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 50,
      pay_basis: "hourly",
      employment_type: "full_time",
    });
    // Currently passes because schema does not enforce hourly floor.
    // When the schema-factory refactor adds hourly-floor enforcement,
    // change this assertion to expect(result.success).toBe(false).
    expect(result.success).toBe(true);
  });

  it("accepts salary_base = 10000 with contractor + not_applicable (schema trusts the contractor classification; misclassification risk is a Compliance Scanner concern, not a schema concern)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 10000,
      pay_basis: "not_applicable",
      employment_type: "contractor",
    });
    expect(result.success).toBe(true);
  });

  it("accepts salary_base = 5000 with contractor + monthly (contractor classification suppresses monthly-paid floor; retainer-style arrangement)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 5000,
      pay_basis: "monthly",
      employment_type: "contractor",
    });
    expect(result.success).toBe(true);
  });

  it("accepts salary_base = 30000 with intern + monthly (above floor; intern subtype not modeled at this layer)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 30000,
      pay_basis: "monthly",
      employment_type: "intern",
    });
    expect(result.success).toBe(true);
  });

  it("KNOWN GAP: accepts salary_base = 5000 with intern + monthly. Schema does not distinguish learning-type from labor-type interns; labor-type interns are LSA-covered and would require full minimum wage. Flip when intern subtype field is added.", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 5000,
      pay_basis: "monthly",
      employment_type: "intern",
    });
    // Currently passes because all interns bypass the floor check.
    // When intern_subtype is added, labor-type interns should fail.
    expect(result.success).toBe(true);
  });

  // Pass cases: missing context. The handler is responsible for fetching
  // existing values from the DB and re-running validation with merged
  // context. Schema cannot fail what it cannot see.

  it("accepts salary_base = 5000 without pay_basis (deferred to handler)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 5000,
      employment_type: "full_time",
    });
    expect(result.success).toBe(true);
  });

  it("accepts salary_base = 5000 without employment_type (deferred to handler)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 5000,
      pay_basis: "monthly",
    });
    expect(result.success).toBe(true);
  });

  it("accepts salary_base = 5000 without either pay_basis or employment_type", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      salary_base: 5000,
    });
    expect(result.success).toBe(true);
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

  it("accepts Feb 30 (JavaScript Date permissive; documented limitation - the form layer should validate calendar dates if strictness is needed)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      hire_date: "2024-02-30",
    });
    // JS Date interprets Feb 30 as Mar 2. Our refine check passes.
    // This is a known limitation, not intended behavior.
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

describe("EmployeeUpdateSchema - pay_basis enum", () => {
  it("accepts monthly (and round-trips the value through result.data)", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      pay_basis: "monthly",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pay_basis).toBe("monthly");
  });

  it("accepts hourly", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      pay_basis: "hourly",
    });
    expect(result.success).toBe(true);
  });

  it("accepts daily", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      pay_basis: "daily",
    });
    expect(result.success).toBe(true);
  });

  it("accepts piecework", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      pay_basis: "piecework",
    });
    expect(result.success).toBe(true);
  });

  it("accepts not_applicable", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      pay_basis: "not_applicable",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown pay_basis", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      pay_basis: "weekly",
    });
    expect(result.success).toBe(false);
  });

  it("treats blank pay_basis as undefined", () => {
    const result = EmployeeUpdateSchema.safeParse({
      user_id: VALID_USER_ID,
      pay_basis: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pay_basis).toBeUndefined();
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
