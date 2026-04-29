// src/lib/payroll/__tests__/nhiSupplementCalc.test.ts
//
// Tests for nhiSupplementCalc.ts — 二代健保 補充保費 calculator.
// Pure function tests; no DB.

import { describe, it, expect } from "vitest";
import {
  computeNhiSupplementPremium,
  NHI_SUPPLEMENT_CALCULATOR_VERSION,
  type BonusType,
} from "../nhiSupplementCalc";
import type { EmployeeProfileSnapshot } from "../leaveAggregator";

// ── Fixture helper ───────────────────────────────────────────────────

function makeProfile(
  partial: Partial<EmployeeProfileSnapshot> = {},
): EmployeeProfileSnapshot {
  return {
    userId: "test-user",
    fullName: "Test User",
    nationalId: null,
    employeeId: null,
    department: null,
    jobTitle: null,
    salaryBase: 45000,
    salaryCurrency: "TWD",
    attendanceBonusMonthly: 0,
    laborInsuredSalary: 45800,
    nhiInsuredSalary: 31800, // matches 518職場熊報 example
    pensionContributionWage: 45000,
    voluntaryPensionRate: 0,
    nhiDependents: 0,
    bankCode: null,
    bankAccount: null,
    hireDate: new Date("2024-01-15T00:00:00Z"),
    gender: "female",
    terminationDate: null,
    ...partial,
  };
}

// ── 1. The canonical 518職場熊報 worked example ─────────────────────

describe("canonical worked example (518職場熊報 case)", () => {
  // 投保金額 31,800; 4× = 127,200
  // July: bonus 50,000 (cumulative 50,000) → 50,000 < 127,200 → no premium
  // December: bonus 100,000 (cumulative 150,000) → excess 22,800
  //   premium = 22,800 × 2.11% = 481.08 → 481 NTD

  it("July payment: 50,000 bonus, no prior YTD → no premium", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 50000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.premiumOwed).toBe(0);
    expect(result.basis).toBe(0);
    expect(result.exemptAmount).toBe(50000);
    expect(result.inScope).toBe(true);
  });

  it("December payment: 100,000 bonus with 50,000 prior YTD → 481 NTD", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 100000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 50000, // already paid in July
      ytdSupplementPremiumPaid: 0,
    });
    // YTD after = 150,000. Threshold = 127,200. Excess = 22,800.
    // Basis = min(100,000, 22,800) = 22,800.
    // Premium = 22,800 × 2.11% = 481.08 → 481.
    expect(result.basis).toBe(22800);
    expect(result.premiumOwed).toBe(481);
    expect(result.exemptAmount).toBe(100000 - 22800);
    expect(result.inScope).toBe(true);
  });

  it("calculationDetail captures the math from official formula", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 100000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 50000,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.calculationDetail).toContain("150000");
    expect(result.calculationDetail).toContain("127200");
    expect(result.calculationDetail).toContain("22800");
    expect(result.calculationDetail).toContain("481");
  });
});

// ── 2. The Money101 example (smaller bonus case) ─────────────────────

describe("Money101 worked example (small flower)", () => {
  // 投保薪資 30,300, 4× = 121,200
  // 全年 30萬 bonus, single payment
  // Excess = 300,000 - 121,200 = 178,800
  // Premium = 178,800 × 2.11% = 3,772.68 → 3,773
  it("single 300,000 bonus with 30,300 投保 → 3,773 NTD", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 30300 }),
      bonusAmount: 300000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 0,
    });
    // Threshold = 121,200. Excess = 178,800.
    // Basis = min(300,000, 178,800) = 178,800.
    // Premium = 178,800 × 0.0211 = 3,772.68 → 3,773.
    expect(result.basis).toBe(178800);
    expect(result.premiumOwed).toBe(3773);
    expect(result.exemptAmount).toBe(121200);
  });
});

// ── 3. Bonus type filtering ─────────────────────────────────────────

describe("bonus type filtering (in-scope check)", () => {
  it("'reward_bonus' is in scope", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 200000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.inScope).toBe(true);
    expect(result.premiumOwed).toBeGreaterThan(0);
  });

  for (const type of [
    "regular_compensation",
    "reimbursement",
    "overtime_pay",
    "other",
  ] as BonusType[]) {
    it(`'${type}' is NOT in scope (returns 0)`, () => {
      const result = computeNhiSupplementPremium({
        profile: makeProfile({ nhiInsuredSalary: 31800 }),
        bonusAmount: 200000,
        bonusType: type,
        ytdBonusBeforeThis: 0,
        ytdSupplementPremiumPaid: 0,
      });
      expect(result.inScope).toBe(false);
      expect(result.premiumOwed).toBe(0);
      expect(result.basis).toBe(0);
      expect(result.calculationDetail).toContain("not in scope");
    });
  }
});

// ── 4. Threshold edge cases ─────────────────────────────────────────

describe("threshold edge cases", () => {
  it("YTD exactly at threshold → no premium (boundary)", () => {
    // 投保 31,800 × 4 = 127,200. Bonus that brings YTD to exactly 127,200.
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 27200,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 100000,
      ytdSupplementPremiumPaid: 0,
    });
    // YTD after = 127,200. Threshold = 127,200. Excess = 0.
    expect(result.premiumOwed).toBe(0);
    expect(result.basis).toBe(0);
  });

  it("YTD one dollar above threshold → 1 NTD basis, premium computed", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 27201, // +1 over the threshold
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 100000,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.basis).toBe(1);
    expect(result.premiumOwed).toBe(0); // 1 × 0.0211 = 0.0211, rounds to 0
  });

  it("first bonus already exceeds threshold (cumulative starts at 0)", () => {
    // 投保 31,800; first bonus is 200,000 in March
    // Threshold = 127,200. Excess = 72,800.
    // Basis = min(200,000, 72,800) = 72,800.
    // Premium = 72,800 × 0.0211 = 1,536.08 → 1,536
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 200000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.basis).toBe(72800);
    expect(result.premiumOwed).toBe(1536);
  });
});

// ── 5. The MIN(this bonus, excess) rule ──────────────────────────────

describe("basis = MIN(this bonus, cumulative excess)", () => {
  // The basis takes the SMALLER of: this single payment OR the cumulative excess.
  // This prevents double-charging when YTD has been growing over months.
  it("when this bonus is smaller than excess, basis = this bonus", () => {
    // YTD already 200,000 BEFORE this. Threshold 127,200. After bonus 50,000:
    //   YTD after = 250,000. Excess = 122,800.
    //   Basis should be MIN(50,000, 122,800) = 50,000 (the whole bonus is taxable
    //   because we're already past the threshold).
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 50000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 200000,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.basis).toBe(50000);
    expect(result.premiumOwed).toBe(roundExpected(50000 * 0.0211));
  });

  it("when excess is smaller (first crossing), basis = excess only", () => {
    // YTD 100,000 before. Threshold 127,200. Bonus 100,000.
    //   YTD after = 200,000. Excess = 72,800.
    //   Basis = MIN(100,000, 72,800) = 72,800.
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 100000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 100000,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.basis).toBe(72800);
    expect(result.premiumOwed).toBe(roundExpected(72800 * 0.0211));
  });
});

// ── 6. Annual cap enforcement ───────────────────────────────────────

describe("annual cap (NT$219,000)", () => {
  it("normal premium below cap is unaffected", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 200000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 100000,
    });
    expect(result.annualCapApplied).toBe(false);
  });

  it("premium that would exceed cap is reduced to remaining cap", () => {
    // ytdSupplementPaid = 200,000. Remaining = 19,000.
    // Try to charge 1,536 NTD on 72,800 basis → fits within 19,000.
    // Force a larger premium by using a much bigger bonus.
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 5000000, // large bonus
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 200000, // 19,000 remaining cap
    });
    // Threshold 127,200. Basis = min(5,000,000, 4,872,800) = 4,872,800.
    // Premium uncapped = 4,872,800 × 0.0211 = 102,816.08
    // But cap remaining = 219,000 - 200,000 = 19,000
    expect(result.annualCapApplied).toBe(true);
    expect(result.premiumOwed).toBe(19000);
    expect(result.notes.some((n) => n.includes("Annual cap applied"))).toBe(true);
  });

  it("ytd already at cap → premium is 0", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 500000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 219000, // cap exhausted
    });
    expect(result.annualCapApplied).toBe(true);
    expect(result.premiumOwed).toBe(0);
  });

  it("ytd above cap → still 0, no negative premium", () => {
    // Defensive: shouldn't happen but if data has YTD over cap, return 0
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 200000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 250000, // OVER cap
    });
    expect(result.premiumOwed).toBe(0);
    expect(result.annualCapApplied).toBe(true);
  });
});

// ── 7. Single-payment basis cap (1,000萬) ───────────────────────────

describe("single-payment basis cap (NT$10,000,000)", () => {
  it("basis above 10M is capped to 10M", () => {
    // Use a high investment amount to bypass annual cap concerns
    // 投保金額 182,000 × 4 = 728,000 threshold.
    // Bonus 50M. Excess = 49,272,000. Basis pre-cap = min(50M, 49.27M) = 49.27M.
    // After 10M cap: basis = 10M.
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 182000 }),
      bonusAmount: 50_000_000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.basis).toBe(10_000_000);
    // Premium uncapped from 10M basis = 10M × 0.0211 = 211,000
    // Annual cap remaining = 219,000 - 0 = 219,000 → fits
    expect(result.premiumOwed).toBe(211_000);
    expect(result.notes.some((n) => n.includes("Single-payment basis cap"))).toBe(true);
  });
});

// ── 8. Edge cases — invalid inputs ──────────────────────────────────

describe("edge case handling", () => {
  it("zero bonus → 0 premium, no error", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 0,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.premiumOwed).toBe(0);
    expect(result.inScope).toBe(false);
    expect(result.calculationDetail).toContain("No bonus paid");
  });

  it("negative bonus → 0 premium with audit note", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: -1000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.premiumOwed).toBe(0);
    expect(result.notes.some((n) => n.includes("negative"))).toBe(true);
  });

  it("nhi_insured_salary null → 0 premium with [NHI_INSURED_SALARY_MISSING] warning", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: null }),
      bonusAmount: 200000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.premiumOwed).toBe(0);
    expect(result.inScope).toBe(true);
    expect(result.notes.some((n) => n.includes("NHI_INSURED_SALARY_MISSING"))).toBe(true);
  });

  it("nhi_insured_salary zero → 0 premium with warning", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 0 }),
      bonusAmount: 200000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.premiumOwed).toBe(0);
    expect(result.notes.some((n) => n.includes("NHI_INSURED_SALARY_MISSING"))).toBe(true);
  });
});

// ── 9. Calculator version stamp ─────────────────────────────────────

describe("calculator version", () => {
  it("stamps the version on every result", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile(),
      bonusAmount: 0,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.calculatorVersion).toBe(NHI_SUPPLEMENT_CALCULATOR_VERSION);
    expect(result.calculatorVersion).toMatch(/^phase-3d-v/);
  });
});

// ── 10. Audit trail completeness ────────────────────────────────────

describe("audit trail", () => {
  it("notes include 第31條 citation when in scope", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 200000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.notes.join(" ")).toContain("第31條");
  });

  it("exemptAmount + basis sums to bonusAmount when in scope", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 200000,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.exemptAmount + result.basis).toBe(200000);
  });

  it("bonusAmount and bonusType pass through unchanged", () => {
    const result = computeNhiSupplementPremium({
      profile: makeProfile({ nhiInsuredSalary: 31800 }),
      bonusAmount: 12345,
      bonusType: "reward_bonus",
      ytdBonusBeforeThis: 0,
      ytdSupplementPremiumPaid: 0,
    });
    expect(result.bonusAmount).toBe(12345);
    expect(result.bonusType).toBe("reward_bonus");
  });
});

// ── 11. Realistic scenario: 5-month bonus stream ────────────────────

describe("multi-event scenario simulation", () => {
  it("five quarterly bonuses for a 投保 31,800 employee accumulate correctly", () => {
    const profile = makeProfile({ nhiInsuredSalary: 31800 });
    let ytdBonus = 0;
    let ytdPremiumPaid = 0;
    const events: Array<{ amount: number; expectedPremium: number }> = [
      // Q1 30k → cumulative 30k, threshold 127,200 → no premium
      { amount: 30000, expectedPremium: 0 },
      // Q2 30k → cumulative 60k → no
      { amount: 30000, expectedPremium: 0 },
      // Q3 30k → cumulative 90k → no
      { amount: 30000, expectedPremium: 0 },
      // Q4 30k → cumulative 120k → no
      { amount: 30000, expectedPremium: 0 },
      // 年終 80k → cumulative 200k. Excess = 72,800. Basis = min(80k, 72.8k) = 72,800.
      // Premium = 72,800 × 0.0211 = 1,536.08 → 1,536
      { amount: 80000, expectedPremium: 1536 },
    ];

    for (const event of events) {
      const result = computeNhiSupplementPremium({
        profile,
        bonusAmount: event.amount,
        bonusType: "reward_bonus",
        ytdBonusBeforeThis: ytdBonus,
        ytdSupplementPremiumPaid: ytdPremiumPaid,
      });
      expect(result.premiumOwed).toBe(event.expectedPremium);
      ytdBonus += event.amount;
      ytdPremiumPaid += result.premiumOwed;
    }

    // Final cumulative should match the 1,536 from the year-end bonus
    expect(ytdPremiumPaid).toBe(1536);
  });
});

// ── Helper for rounding test expectations ──
function roundExpected(amount: number): number {
  return Math.floor(amount + 0.5);
}
