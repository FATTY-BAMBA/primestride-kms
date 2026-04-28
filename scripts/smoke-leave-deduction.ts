// scripts/smoke-leave-deduction.ts
//
// End-to-end smoke test for the Phase 3b leave-deduction orchestrator.
//
// READ-ONLY against real production Supabase. Exercises the full
// pipeline: aggregator (DB read) → classifier → ytdCaps → payTreatment →
// orchestrator. Validates the result against predicted expectations.
//
// Runs against the cleaned test user (user_3AenzTmppp6NfJID57yREWOrYq4)
// in org 02bb4bee-... who has:
//   - salary_base = 45000 (daily rate = 1500)
//   - hire_date = 2024-01-15
//   - 2 leaves: 事假 1d (2026-03-09), 病假 Sick 1d (2026-03-15)
//
// Tests TWO periods sequentially:
//   - April 2026: exercises YTD partition (March leaves → YTD context,
//     no in-period leaves → 0 deduction, 2 YTD records)
//   - March 2026: exercises in-period calculation (Jan/Feb empty YTD,
//     2 in-period leaves → 2,250 NTD deduction)
//
// Usage:
//   npx tsx scripts/smoke-leave-deduction.ts

// Load .env.local explicitly — Next.js convention puts Supabase URLs there
// (matches the pattern used by smoke-leave-aggregator.ts and the rest
// of the project).
import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  computeLeaveDeductions,
  type LeaveDeductionRunResult,
  type EmployeeLeaveDeductionResult,
} from "../src/lib/payroll/leaveDeduction";

// ── Constants ────────────────────────────────────────────────────────

const TEST_ORG_ID = "02bb4bee-5538-4add-9a2d-32872cbccd7d";
const TEST_USER_ID = "user_3AenzTmppp6NfJID57yREWOrYq4";

// ── ANSI helpers ────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function pass(msg: string): void {
  console.log(`  ${c.green}✓${c.reset} ${msg}`);
}
function fail(msg: string): void {
  console.log(`  ${c.red}✗${c.reset} ${msg}`);
}
function header(msg: string): void {
  console.log(
    `\n${c.cyan}════════════════════════════════════════════════════════════════════════${c.reset}`,
  );
  console.log(`${c.bold}${msg}${c.reset}`);
  console.log(
    `${c.cyan}════════════════════════════════════════════════════════════════════════${c.reset}`,
  );
}
function sub(msg: string): void {
  console.log(
    `\n${c.dim}────────────────────────────────────────────────────────────────────────${c.reset}`,
  );
  console.log(`${c.bold}${msg}${c.reset}`);
  console.log(
    `${c.dim}────────────────────────────────────────────────────────────────────────${c.reset}`,
  );
}

// ── Validation helper ───────────────────────────────────────────────

type ValidationResult = { passed: number; failed: number };

function check(
  cond: boolean,
  description: string,
  vr: ValidationResult,
): void {
  if (cond) {
    pass(description);
    vr.passed++;
  } else {
    fail(description);
    vr.failed++;
  }
}

// ── Result printers ─────────────────────────────────────────────────

function printRunSummary(result: LeaveDeductionRunResult): void {
  console.log(`\norganizationId: ${result.organizationId}`);
  console.log(
    `period: ${result.periodYear}-${String(result.periodMonth).padStart(2, "0")} (${result.periodStartDate} → ${result.periodEndDate})`,
  );
  console.log(`employees in scope: ${result.employees.length}`);
  console.log(`compute time: ${result.computeTimeMs}ms`);
  console.log(`calculator version: ${result.calculatorVersion}`);

  if (result.runWarnings.length > 0) {
    console.log(
      `\n${c.yellow}org-level warnings (${result.runWarnings.length}):${c.reset}`,
    );
    for (const w of result.runWarnings) {
      console.log(`  ${c.yellow}⚠${c.reset} ${w}`);
    }
  }
}

function printEmployeeBlock(emp: EmployeeLeaveDeductionResult): void {
  console.log(`\n${c.bold}EMPLOYEE: ${emp.fullName}${c.reset} [${emp.userId.substring(0, 25)}...]`);
  console.log(
    `  salary_base: ${emp.profileSnapshot.salaryBase} TWD  daily_rate: ${emp.profileSnapshot.salaryBase / 30}`,
  );
  console.log(
    `  hire_date: ${emp.profileSnapshot.hireDate?.toISOString().split("T")[0] ?? "(null)"}`,
  );
  console.log(`  gender: ${emp.profileSnapshot.gender ?? "(null)"}`);

  console.log(`  ${c.dim}YTD context:${c.reset}`);
  console.log(`    sickHalfPayDaysUsed: ${emp.ytdSummary.sickHalfPayDaysUsed}`);
  console.log(
    `    menstrualSeparateDaysUsed: ${emp.ytdSummary.menstrualSeparateDaysUsed}`,
  );
  console.log(
    `    menstrualTotalDaysUsed: ${emp.ytdSummary.menstrualTotalDaysUsed}`,
  );
  console.log(
    `    classifiedRecords: ${emp.ytdSummary.classifiedRecordCount}, unclassified: ${emp.ytdSummary.unclassifiedRecordCount}`,
  );
  if (Object.keys(emp.ytdSummary.byCanonicalKey).length > 0) {
    console.log(`    byCanonicalKey:`);
    for (const [k, v] of Object.entries(emp.ytdSummary.byCanonicalKey)) {
      console.log(`      - ${k}: ${v}d`);
    }
  }

  console.log(`  ${c.dim}leaves in period:${c.reset} ${emp.leaveOccurrences.length}`);
  for (const occ of emp.leaveOccurrences) {
    const cl = occ.classification;
    let cls: string;
    if (cl.ok === true) {
      cls = `→ ${cl.canonicalKey}`;
    } else {
      cls = `${c.yellow}[${cl.reason}]${c.reset}`;
    }
    const filtered = occ.filteredAsSkipFromPayroll ? ` ${c.yellow}[SKIPPED: parental_leave]${c.reset}` : "";
    const deduction = occ.payTreatment
      ? ` → ${occ.payTreatment.deductionAmount} NTD`
      : "";
    console.log(
      `    - "${occ.leaveTypeRaw}" ${occ.daysInPeriod}d [${occ.effectiveStart}] ${cls}${deduction}${filtered}`,
    );
    if (occ.payTreatment?.calculationDetail) {
      console.log(`      ${c.dim}${occ.payTreatment.calculationDetail}${c.reset}`);
    }
    for (const note of occ.payTreatment?.notes ?? []) {
      console.log(`      ${c.yellow}note:${c.reset} ${note}`);
    }
  }

  console.log(`  ${c.bold}TOTALS:${c.reset}`);
  console.log(`    total_leave_deduction: ${emp.totalLeaveDeductionAmount} NTD`);
  console.log(`    unpaid_leave_days:    ${emp.totalUnpaidLeaveDays}`);
  console.log(`    half_pay_leave_days:  ${emp.totalHalfPayLeaveDays}`);
  console.log(`    full_pay_leave_days:  ${emp.totalFullPayLeaveDays}`);

  console.log(`  ${c.dim}Q5 flags:${c.reset}`);
  console.log(
    `    anyProtectedLeave: ${emp.attendanceBonusFlags.anyProtectedLeave}`,
  );
  console.log(
    `    proportionallyDeductibleDays: ${emp.attendanceBonusFlags.proportionallyDeductibleDays}`,
  );
  console.log(
    `    sickDaysInPeriod: ${emp.attendanceBonusFlags.sickDaysInPeriod}`,
  );

  if (emp.warnings.length > 0) {
    console.log(`  ${c.yellow}warnings (${emp.warnings.length}):${c.reset}`);
    for (const w of emp.warnings) {
      console.log(`    ⚠ ${w}`);
    }
  }
  if (emp.errors.length > 0) {
    console.log(`  ${c.red}errors (${emp.errors.length}):${c.reset}`);
    for (const e of emp.errors) {
      console.log(`    ✗ ${e}`);
    }
  }
}

// ── Test 1: April 2026 — YTD partition ─────────────────────────────

async function testAprilPeriod(): Promise<ValidationResult> {
  const vr: ValidationResult = { passed: 0, failed: 0 };

  header("TEST 1: APRIL 2026 (validates YTD partition)");

  const result = await computeLeaveDeductions({
    organizationId: TEST_ORG_ID,
    periodYear: 2026,
    periodMonth: 4,
  });

  printRunSummary(result);

  // Find the test user
  const testUser = result.employees.find((e) => e.userId === TEST_USER_ID);
  if (!testUser) {
    console.log(
      `\n${c.red}FATAL: test user ${TEST_USER_ID} not found in result${c.reset}`,
    );
    vr.failed++;
    return vr;
  }
  printEmployeeBlock(testUser);

  // ── Validations for April ──
  sub("VALIDATION CHECKS — April 2026");

  // Run-level
  check(result.organizationId === TEST_ORG_ID, "organizationId matches input", vr);
  check(result.periodYear === 2026, "periodYear === 2026", vr);
  check(result.periodMonth === 4, "periodMonth === 4", vr);
  check(result.periodStartDate === "2026-04-01", "periodStartDate is 2026-04-01", vr);
  check(result.periodEndDate === "2026-04-30", "periodEndDate is 2026-04-30", vr);
  check(
    result.calculatorVersion.startsWith("phase-3b-v"),
    "calculatorVersion stamped",
    vr,
  );

  // Aggregator-level (should still skip 3 users)
  check(
    result.runWarnings.length >= 1,
    `runWarnings present (${result.runWarnings.length})`,
    vr,
  );

  // Test user found (1+ employee in scope)
  check(result.employees.length >= 1, "at least 1 employee in scope", vr);

  // YTD partition: 2 records (the March leaves)
  check(
    testUser.ytdSummary.classifiedRecordCount === 2,
    `YTD has 2 classified records (got ${testUser.ytdSummary.classifiedRecordCount})`,
    vr,
  );
  check(
    testUser.ytdSummary.unclassifiedRecordCount === 0,
    "no YTD classification failures",
    vr,
  );
  check(
    testUser.ytdSummary.sickHalfPayDaysUsed === 1,
    `YTD sickHalfPayDaysUsed === 1 (got ${testUser.ytdSummary.sickHalfPayDaysUsed})`,
    vr,
  );
  check(
    testUser.ytdSummary.byCanonicalKey["sick_unhospitalized"] === 1,
    "YTD byCanonicalKey['sick_unhospitalized'] === 1",
    vr,
  );
  check(
    testUser.ytdSummary.byCanonicalKey["personal_leave"] === 1,
    "YTD byCanonicalKey['personal_leave'] === 1",
    vr,
  );
  check(
    testUser.ytdSummary.menstrualTotalDaysUsed === 0,
    "no menstrual leave in YTD",
    vr,
  );

  // No leaves in period
  check(
    testUser.leaveOccurrences.length === 0,
    `0 leaves in April period (got ${testUser.leaveOccurrences.length})`,
    vr,
  );
  check(
    testUser.totalLeaveDeductionAmount === 0,
    "total deduction is 0 NTD",
    vr,
  );
  check(
    testUser.totalUnpaidLeaveDays === 0,
    "totalUnpaidLeaveDays is 0",
    vr,
  );
  check(
    testUser.totalHalfPayLeaveDays === 0,
    "totalHalfPayLeaveDays is 0",
    vr,
  );

  // Q5 flags
  check(
    testUser.attendanceBonusFlags.anyProtectedLeave === false,
    "anyProtectedLeave is false (no in-period leaves)",
    vr,
  );
  check(
    testUser.attendanceBonusFlags.proportionallyDeductibleDays === 0,
    "proportionallyDeductibleDays is 0",
    vr,
  );
  check(
    testUser.attendanceBonusFlags.sickDaysInPeriod === 0,
    "sickDaysInPeriod is 0",
    vr,
  );

  // No warnings on test user (clean data)
  check(testUser.warnings.length === 0, "test user has no warnings", vr);
  check(testUser.errors.length === 0, "test user has no errors", vr);

  return vr;
}

// ── Test 2: March 2026 — in-period calculation ─────────────────────

async function testMarchPeriod(): Promise<ValidationResult> {
  const vr: ValidationResult = { passed: 0, failed: 0 };

  header("TEST 2: MARCH 2026 (validates in-period calculation)");

  const result = await computeLeaveDeductions({
    organizationId: TEST_ORG_ID,
    periodYear: 2026,
    periodMonth: 3,
  });

  printRunSummary(result);

  const testUser = result.employees.find((e) => e.userId === TEST_USER_ID);
  if (!testUser) {
    console.log(
      `\n${c.red}FATAL: test user ${TEST_USER_ID} not found in result${c.reset}`,
    );
    vr.failed++;
    return vr;
  }
  printEmployeeBlock(testUser);

  // ── Validations for March ──
  sub("VALIDATION CHECKS — March 2026");

  check(result.periodMonth === 3, "periodMonth === 3", vr);
  check(result.periodStartDate === "2026-03-01", "periodStartDate is 2026-03-01", vr);
  check(result.periodEndDate === "2026-03-31", "periodEndDate is 2026-03-31", vr);

  // YTD: Jan-Feb 2026 had no leaves, so YTD is empty
  check(
    testUser.ytdSummary.classifiedRecordCount === 0,
    `YTD has 0 records (got ${testUser.ytdSummary.classifiedRecordCount})`,
    vr,
  );
  check(
    testUser.ytdSummary.sickHalfPayDaysUsed === 0,
    "YTD sickHalfPayDaysUsed === 0",
    vr,
  );

  // 2 leaves in period
  check(
    testUser.leaveOccurrences.length === 2,
    `2 leaves in March period (got ${testUser.leaveOccurrences.length})`,
    vr,
  );

  // Both classify cleanly
  const allClassified = testUser.leaveOccurrences.every(
    (occ) => occ.classification.ok,
  );
  check(allClassified, "all leaves classified successfully", vr);

  // Find each leave
  const personal = testUser.leaveOccurrences.find(
    (o) =>
      o.classification.ok && o.classification.canonicalKey === "personal_leave",
  );
  const sick = testUser.leaveOccurrences.find(
    (o) =>
      o.classification.ok &&
      o.classification.canonicalKey === "sick_unhospitalized",
  );

  check(personal !== undefined, "事假 record present and classified", vr);
  check(sick !== undefined, "病假 record present and classified", vr);

  if (personal !== undefined) {
    check(
      personal.daysInPeriod === 1,
      `事假 daysInPeriod === 1 (got ${personal.daysInPeriod})`,
      vr,
    );
    check(
      personal.payTreatment?.deductionAmount === 1500,
      `事假 deduction === 1500 NTD (got ${personal.payTreatment?.deductionAmount})`,
      vr,
    );
    check(
      personal.payTreatment?.unpaidDays === 1,
      "事假 unpaidDays === 1",
      vr,
    );
    check(
      personal.payTreatment?.treatmentKind === "unpaid",
      "事假 treatmentKind === 'unpaid'",
      vr,
    );
  }

  if (sick !== undefined) {
    check(
      sick.daysInPeriod === 1,
      `病假 daysInPeriod === 1 (got ${sick.daysInPeriod})`,
      vr,
    );
    check(
      sick.payTreatment?.deductionAmount === 750,
      `病假 deduction === 750 NTD (got ${sick.payTreatment?.deductionAmount})`,
      vr,
    );
    check(
      sick.payTreatment?.halfPayDays === 1,
      "病假 halfPayDays === 1",
      vr,
    );
    check(
      sick.payTreatment?.treatmentKind === "half_pay_with_ytd_cap",
      "病假 treatmentKind === 'half_pay_with_ytd_cap'",
      vr,
    );
  }

  // Totals
  check(
    testUser.totalLeaveDeductionAmount === 2250,
    `total deduction === 2,250 NTD (got ${testUser.totalLeaveDeductionAmount})`,
    vr,
  );
  check(
    testUser.totalUnpaidLeaveDays === 1,
    `totalUnpaidLeaveDays === 1 (got ${testUser.totalUnpaidLeaveDays})`,
    vr,
  );
  check(
    testUser.totalHalfPayLeaveDays === 1,
    `totalHalfPayLeaveDays === 1 (got ${testUser.totalHalfPayLeaveDays})`,
    vr,
  );

  // Q5 flags
  check(
    testUser.attendanceBonusFlags.anyProtectedLeave === false,
    "anyProtectedLeave is false (事假 + 病假 are NOT protected types)",
    vr,
  );
  check(
    testUser.attendanceBonusFlags.proportionallyDeductibleDays === 2,
    `proportionallyDeductibleDays === 2 (1d 事假 + 1d 病假, got ${testUser.attendanceBonusFlags.proportionallyDeductibleDays})`,
    vr,
  );
  check(
    testUser.attendanceBonusFlags.sickDaysInPeriod === 1,
    `sickDaysInPeriod === 1 (got ${testUser.attendanceBonusFlags.sickDaysInPeriod})`,
    vr,
  );

  // The sick leave note should mention 第9-1條
  const sickNote = testUser.attendanceBonusFlags.perLeaveNotes.find(
    (n) => n.canonicalKey === "sick_unhospitalized",
  );
  check(
    sickNote !== undefined && sickNote.note.includes("第9-1條"),
    "sick leave note references 第9-1條 (10-day YTD protection)",
    vr,
  );

  return vr;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    `\n${c.bold}Atlas EIP — Phase 3b End-to-End Smoke Test (READ-ONLY)${c.reset}`,
  );
  console.log(`Test user: ${TEST_USER_ID}`);
  console.log(`Test org:  ${TEST_ORG_ID}`);

  let totalPassed = 0;
  let totalFailed = 0;

  try {
    const aprilResult = await testAprilPeriod();
    totalPassed += aprilResult.passed;
    totalFailed += aprilResult.failed;

    const marchResult = await testMarchPeriod();
    totalPassed += marchResult.passed;
    totalFailed += marchResult.failed;
  } catch (err) {
    console.error(`\n${c.red}FATAL ERROR: ${(err as Error).message}${c.reset}`);
    console.error((err as Error).stack);
    process.exit(1);
  }

  // Final scoreboard
  header("FINAL SCOREBOARD");
  console.log(`Total passed: ${c.green}${totalPassed}${c.reset}`);
  console.log(`Total failed: ${totalFailed > 0 ? c.red : c.green}${totalFailed}${c.reset}`);

  if (totalFailed === 0) {
    console.log(`\n${c.green}${c.bold}✅ All validations passed. Phase 3b is end-to-end functional.${c.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${c.red}${c.bold}❌ Validation failures detected. Investigate before proceeding.${c.reset}\n`);
    process.exit(1);
  }
}

main();
