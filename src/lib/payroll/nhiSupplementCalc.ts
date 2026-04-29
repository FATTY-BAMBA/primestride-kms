// src/lib/payroll/nhiSupplementCalc.ts
//
// Atlas EIP — 二代健保 補充保費 (NHI Supplement Premium) Calculator
// ──────────────────────────────────────────────────────────────────────
// Phase 3d.3a implementation of Q4 from the Phase 3b legal review.
//
// LEGAL FRAMEWORK:
//
//   全民健康保險法 第31條 (Health Insurance Act Article 31):
//     Six categories of supplemental income are subject to a 2.11%
//     supplemental premium. For payroll specifically, only Category 1
//     (高額獎金 — high bonuses) is in scope.
//
//   Categories 2-3 (part-time wages, professional fees) are edge cases
//   for SMBs handled separately. Categories 4-6 (dividends, interest,
//   rent) are personal income outside payroll entirely.
//
//   衛生福利部中央健康保險署 (NHI) official formula
//   (https://www.nhi.gov.tw/ch/cp-2489-1e757-3151-1.html):
//
//     補充保險費 = 獎金之費基 × 費率 (2.11%)
//     累計超過4倍投保金額之獎金 = (給付時當年度累計獎金金額 − 給付時投保金額×4)
//     費基 = MIN(本次給付獎金, 累計超過4倍投保金額之獎金)
//
//   Worked example from 518職場熊報:
//     投保金額 NT$31,800
//     7月: 獎金 50,000. 累計 50,000. 4×31,800 = 127,200. 累計 < 127,200 → 不扣
//     12月: 獎金 100,000. 累計 150,000. 超過 = 22,800. 補充保費 = 22,800 × 2.11% = 481
//
// KEY RULES:
//   1. Threshold: cumulative bonuses YTD must exceed 4 × current month's
//      投保金額 to trigger any premium.
//   2. Per-event: premium calculated PER bonus payment (no year-end
//      reconciliation, no 結算).
//   3. Take the smaller: 費基 = min(this bonus, cumulative-over-4× amount).
//   4. Annual cap per employee: investment cap × 4 × 2.11%
//      = 182,000 × 4 × 2.11% ≈ 219,000 NTD/year.
//   5. Investment amount used: CURRENT month's 投保金額 at time of payment.
//      No retroactive adjustment if it changes mid-year.
//
// BONUS TYPE FILTERING:
//   Only "reward bonuses" (年終, 三節, 績效, 紅利) trigger the supplement.
//   Per 所得格式代號 50: bonuses with reward character that are NOT
//   already included in the regular 投保金額 calculation.
//
//   Excluded from this calculator's scope:
//     - 經常性薪資 (regular salary — that's general 健保 5.17%)
//     - 加班費 (overtime — separate)
//     - 獎金 already factored into 投保金額
//
// PENDING LEGAL CHANGE (2027):
//   衛福部 announced (Nov 2025) intent to lower the threshold from
//   "4× 投保金額" to "4× 基本工資" (NT$28,590 × 4 = NT$114,360).
//   Still in legislative process — not law yet. We implement current
//   law and flag for future revision.

import type { EmployeeProfileSnapshot } from "./leaveAggregator";

// ── Public types ─────────────────────────────────────────────────────

/**
 * Categorization of a bonus payment for supplement-premium scope.
 *
 *   - 'reward_bonus': 年終, 三節, 績效, 紅利 — IN SCOPE for 第31條
 *   - 'regular_compensation': part of 經常性薪資 already in 投保金額 — OUT
 *   - 'reimbursement': travel/expense reimbursement — OUT
 *   - 'overtime_pay': 加班費 — OUT (own scope)
 *   - 'other': fallback — caller must decide
 *
 * Only 'reward_bonus' triggers premium calculation. All others return
 * a zero result with explanatory note.
 */
export type BonusType =
  | "reward_bonus"
  | "regular_compensation"
  | "reimbursement"
  | "overtime_pay"
  | "other";

/**
 * Result of the supplement premium calculation.
 */
export type NhiSupplementResult = {
  /** Bonus amount as input */
  bonusAmount: number;
  /** Bonus type as input (passed through for audit) */
  bonusType: BonusType;
  /**
   * Amount on which premium is calculated. May be less than bonusAmount
   * (only the portion exceeding 4× 投保金額 contributes).
   */
  basis: number;
  /** Premium owed (NTD, integer, half-up rounded). 0 if not in scope. */
  premiumOwed: number;
  /**
   * Amount that was BELOW the 4× threshold and exempt from premium.
   * For audit clarity: bonusAmount = exemptAmount + basis (when basis > 0).
   */
  exemptAmount: number;
  /**
   * Whether this bonus was in scope of 第31條 supplement at all.
   * False for non-reward bonuses; true for reward bonuses (even when
   * threshold not yet reached).
   */
  inScope: boolean;
  /**
   * Whether the annual cap was applied.
   * True if premium was reduced because YTD supplement payments would
   * exceed the 219,000 NTD/year cap.
   */
  annualCapApplied: boolean;
  /** Human-readable description of the math for audit log */
  calculationDetail: string;
  /** Audit notes (legal citations, edge cases hit) */
  notes: string[];
  /** Calculator version stamp for reproducibility */
  calculatorVersion: string;
};

// ── Constants ────────────────────────────────────────────────────────

/**
 * Premium rate — 2.11% per 健保法 第34-1條 (effective 110/01/01).
 * Subject to legislative adjustment; current calculator targets the
 * 2021-onwards rate. If rate changes, bump CALCULATOR_VERSION.
 */
const SUPPLEMENT_PREMIUM_RATE = 0.0211;

/**
 * Threshold multiplier — 4× 投保金額 per 健保法 第31條.
 * Bonuses with cumulative YTD below this multiplier × 投保金額 are exempt.
 */
const BONUS_THRESHOLD_MULTIPLIER = 4;

/**
 * Annual cap per employee on supplement premium owed.
 *
 *   Cap basis: 投保金額上限 (NT$182,000) × 4 × 2.11% ≈ NT$219,000
 *
 * This is the maximum total supplement premium an employee can pay in
 * one year across all six categories combined. For our payroll-only
 * scope (Category 1 bonus), this serves as a defensive ceiling.
 *
 * Source: 健保署 (https://www.daywayfirm.com/nhiss-surcharge-calculator
 * confirms this from official 健保署 publications).
 */
const ANNUAL_PREMIUM_CAP_NTD = 219000;

/**
 * Single-payment cap on bonus basis: 1,000萬 NTD per the 健保署.
 * Bonuses exceeding this in a single payment have basis capped at 10M.
 *
 * Source: multiple secondary sources cite 1,000萬 cap. From 健保署
 * 補充保費試算 page formula.
 */
const SINGLE_PAYMENT_BASIS_CAP = 10_000_000;

/**
 * Calculator version stamp. Bumped on any behavioral change.
 */
export const NHI_SUPPLEMENT_CALCULATOR_VERSION = "phase-3d-v1.0";

// ── Helpers ──────────────────────────────────────────────────────────

/** Round half-up to integer NTD. Matches Phase 3b/3c convention. */
function roundHalfUpToInt(amount: number): number {
  return Math.floor(amount + 0.5);
}

// ── Main calculator ──────────────────────────────────────────────────

/**
 * Compute the 二代健保 補充保費 (NHI Supplement Premium) for a single
 * bonus payment event.
 *
 * Pure function: no I/O, deterministic, no side effects. Caller is
 * responsible for tracking YTD cumulative values across payment events.
 *
 * @param input.profile employee profile (provides nhi_insured_salary)
 * @param input.bonusAmount this payment's bonus amount in NTD
 * @param input.bonusType classification of the bonus (filters scope)
 * @param input.ytdBonusBeforeThis cumulative reward-bonus payments YTD
 *        BEFORE this event (excluding this payment). Caller tracks.
 * @param input.ytdSupplementPremiumPaid cumulative supplement premium
 *        already withheld YTD across all categories (excluding this).
 *        Used for annual cap enforcement. Caller tracks.
 * @returns NhiSupplementResult with premium and full audit detail
 */
export function computeNhiSupplementPremium(input: {
  profile: EmployeeProfileSnapshot;
  bonusAmount: number;
  bonusType: BonusType;
  ytdBonusBeforeThis: number;
  ytdSupplementPremiumPaid: number;
}): NhiSupplementResult {
  const { profile, bonusAmount, bonusType, ytdBonusBeforeThis, ytdSupplementPremiumPaid } = input;
  const notes: string[] = [];

  // ── Edge case: zero or negative bonus ──
  if (bonusAmount <= 0) {
    return {
      bonusAmount,
      bonusType,
      basis: 0,
      premiumOwed: 0,
      exemptAmount: 0,
      inScope: false,
      annualCapApplied: false,
      calculationDetail:
        bonusAmount === 0
          ? "No bonus paid; no premium calculation."
          : `Invalid negative bonus amount (${bonusAmount}); treated as 0.`,
      notes:
        bonusAmount < 0
          ? [`Bonus amount ${bonusAmount} is negative — calculator returned 0`]
          : [],
      calculatorVersion: NHI_SUPPLEMENT_CALCULATOR_VERSION,
    };
  }

  // ── Scope check: only 'reward_bonus' triggers 第31條 supplement ──
  if (bonusType !== "reward_bonus") {
    return {
      bonusAmount,
      bonusType,
      basis: 0,
      premiumOwed: 0,
      exemptAmount: bonusAmount,
      inScope: false,
      annualCapApplied: false,
      calculationDetail:
        `Bonus type '${bonusType}' is not in scope of 健保法 第31條 ` +
        `Category 1 (高額獎金). No supplement premium owed.`,
      notes: [
        `第31條 supplement premium applies only to 'reward_bonus' type ` +
          `(年終/三節/績效/紅利). Other types are either part of regular ` +
          `salary (already in general 健保) or out of payroll scope.`,
      ],
      calculatorVersion: NHI_SUPPLEMENT_CALCULATOR_VERSION,
    };
  }

  // ── Validate insured amount ──
  const insuredAmount = profile.nhiInsuredSalary;
  if (insuredAmount === null || insuredAmount <= 0) {
    return {
      bonusAmount,
      bonusType,
      basis: 0,
      premiumOwed: 0,
      exemptAmount: bonusAmount,
      inScope: true,
      annualCapApplied: false,
      calculationDetail:
        `Cannot calculate supplement: employee has no nhi_insured_salary ` +
        `set (got ${insuredAmount}). Premium calculation skipped — admin ` +
        `must configure 健保投保金額 before payroll can include this employee.`,
      notes: [
        `[NHI_INSURED_SALARY_MISSING] Employee profile has no valid ` +
          `nhi_insured_salary. The 健保 supplement calculation requires ` +
          `the 健保投保金額 to compute the 4× threshold per 健保法 第31條.`,
      ],
      calculatorVersion: NHI_SUPPLEMENT_CALCULATOR_VERSION,
    };
  }

  // ── Apply the formula ──
  //
  // 累計超過4倍投保金額之獎金 = (給付時當年度累計獎金金額 − 給付時投保金額×4)
  // 費基 = MIN(本次給付獎金, 累計超過4倍投保金額之獎金)

  const threshold = insuredAmount * BONUS_THRESHOLD_MULTIPLIER;
  const ytdAfterThis = ytdBonusBeforeThis + bonusAmount;
  const cumulativeOverThreshold = Math.max(0, ytdAfterThis - threshold);

  // Basis = min(this bonus, cumulative-over-threshold)
  let basis = Math.min(bonusAmount, cumulativeOverThreshold);

  // Apply single-payment basis cap (1,000萬 NTD)
  if (basis > SINGLE_PAYMENT_BASIS_CAP) {
    notes.push(
      `Single-payment basis cap applied: bonus basis ${basis} exceeds ` +
        `${SINGLE_PAYMENT_BASIS_CAP} NTD; capped at ${SINGLE_PAYMENT_BASIS_CAP}.`,
    );
    basis = SINGLE_PAYMENT_BASIS_CAP;
  }

  // ── Threshold not reached → no premium ──
  if (basis === 0) {
    return {
      bonusAmount,
      bonusType,
      basis: 0,
      premiumOwed: 0,
      exemptAmount: bonusAmount,
      inScope: true,
      annualCapApplied: false,
      calculationDetail:
        `Cumulative YTD bonus (${ytdAfterThis}) does not exceed 4× 投保金額 ` +
        `threshold (${threshold}). All ${bonusAmount} exempt; no supplement owed.`,
      notes: [
        `Per 健保法 第31條: bonuses are exempt below the 4× 投保金額 threshold. ` +
          `Threshold for this employee = ${insuredAmount} × 4 = ${threshold} NTD.`,
      ],
      calculatorVersion: NHI_SUPPLEMENT_CALCULATOR_VERSION,
    };
  }

  // ── Compute premium ──
  let premiumOwed = roundHalfUpToInt(basis * SUPPLEMENT_PREMIUM_RATE);

  // ── Apply annual cap ──
  let annualCapApplied = false;
  const remainingCap = Math.max(0, ANNUAL_PREMIUM_CAP_NTD - ytdSupplementPremiumPaid);
  if (premiumOwed > remainingCap) {
    notes.push(
      `Annual cap applied: would-be premium ${premiumOwed} reduced to ` +
        `${remainingCap} NTD (YTD supplement paid: ${ytdSupplementPremiumPaid}, ` +
        `cap: ${ANNUAL_PREMIUM_CAP_NTD}).`,
    );
    premiumOwed = remainingCap;
    annualCapApplied = true;
  }

  const exemptAmount = bonusAmount - basis;
  const calculationDetail =
    `${ytdAfterThis} (YTD累計) − ${threshold} (4×${insuredAmount}) = ` +
    `${ytdAfterThis - threshold} 超過; ` +
    `費基 = MIN(${bonusAmount}, ${ytdAfterThis - threshold}) = ${basis}; ` +
    `補充保費 = ${basis} × 2.11% = ${premiumOwed} NTD`;

  notes.unshift(
    `Per 健保法 第31條 + 健保署 official formula: 補充保險費 = 費基 × 2.11%; ` +
      `累計超過4倍投保金額之獎金 = (給付時當年度累計獎金金額 − 給付時投保金額×4); ` +
      `費基 = MIN(本次給付獎金, 累計超過4倍投保金額之獎金).`,
  );

  return {
    bonusAmount,
    bonusType,
    basis,
    premiumOwed,
    exemptAmount,
    inScope: true,
    annualCapApplied,
    calculationDetail,
    notes,
    calculatorVersion: NHI_SUPPLEMENT_CALCULATOR_VERSION,
  };
}
