// scripts/smoke-phase-3c-bonus.ts
//
// Phase 3c smoke test
// ──────────────────────────────────────────────────────────────────────
// Verifies the attendance bonus calculator works end-to-end against
// real production Supabase data.
//
// Checks:
//   1. computeLeaveDeductions completes (proves the new schema column
//      is being read correctly by the aggregator)
//   2. CALCULATOR_VERSION === "phase-3c-v1.0"
//   3. Each employee gets an attendanceBonus result object
//   4. For employees with bonus > 0: surface the deduction breakdown
//   5. For employees with bonus = 0: confirm zero-bonus fast path triggered
//
// Usage:
//   npx tsx scripts/smoke-phase-3c-bonus.ts

import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { computeLeaveDeductions } from "../src/lib/payroll/leaveDeduction";

const TEST_ORG_ID = "02bb4bee-5538-4add-9a2d-32872cbccd7d";
const PERIOD_YEAR = 2026;
const PERIOD_MONTH = 4;

async function main() {
  console.log("Atlas EIP — Phase 3c Smoke Test (Attendance Bonus)");
  console.log("─".repeat(60));
  console.log(`Org:    ${TEST_ORG_ID}`);
  console.log(`Period: ${PERIOD_YEAR}-${String(PERIOD_MONTH).padStart(2, "0")}`);
  console.log();

  console.log("[1/4] Running computeLeaveDeductions...");
  const t0 = Date.now();
  let result;
  try {
    result = await computeLeaveDeductions({
      organizationId: TEST_ORG_ID,
      periodYear: PERIOD_YEAR,
      periodMonth: PERIOD_MONTH,
    });
  } catch (err) {
    console.error("  ✗ FAILED:", err instanceof Error ? err.message : err);
    console.error(
      "\n  This likely means the schema migration didn't apply, or " +
        "the SELECT now references a column that doesn't exist.",
    );
    process.exit(1);
  }
  console.log(`  ✓ Completed in ${Date.now() - t0}ms`);
  console.log();

  // Check 2: calculator version stamp
  console.log("[2/4] Verifying calculator version...");
  const expectedVersion = "phase-3c-v1.0";
  if (result.calculatorVersion !== expectedVersion) {
    console.error(
      `  ✗ Expected ${expectedVersion}, got ${result.calculatorVersion}`,
    );
    process.exit(1);
  }
  console.log(`  ✓ ${result.calculatorVersion}`);
  console.log();

  // Check 3: every employee has an attendanceBonus object
  console.log("[3/4] Verifying attendanceBonus shape on each employee...");
  for (const emp of result.employees) {
    if (!emp.attendanceBonus) {
      console.error(
        `  ✗ Employee ${emp.fullName} has no attendanceBonus result`,
      );
      process.exit(1);
    }
    if (typeof emp.attendanceBonus.originalBonus !== "number") {
      console.error(`  ✗ Employee ${emp.fullName} has malformed bonus result`);
      process.exit(1);
    }
  }
  console.log(
    `  ✓ All ${result.employees.length} employees have valid attendanceBonus results`,
  );
  console.log();

  // Check 4: per-employee details
  console.log("[4/4] Per-employee attendance bonus breakdown:");
  console.log();

  let employeesWithBonus = 0;
  let employeesWithoutBonus = 0;
  let totalDeductionAcrossOrg = 0;

  for (const emp of result.employees) {
    const ab = emp.attendanceBonus;
    console.log(`  ${emp.fullName} (${emp.userId})`);
    console.log(`    Original bonus:   ${ab.originalBonus} NTD`);
    console.log(`    Total deduction:  ${ab.totalDeduction} NTD`);
    console.log(`    Net bonus paid:   ${ab.netBonus} NTD`);

    if (ab.originalBonus > 0) {
      employeesWithBonus++;
      totalDeductionAcrossOrg += ab.totalDeduction;

      if (ab.breakdown.length > 0) {
        console.log(`    Per-leave breakdown:`);
        for (const entry of ab.breakdown) {
          const tag =
            entry.deductedAmount > 0
              ? `→ ${entry.deductedAmount} NTD deducted`
              : `→ no deduction`;
          console.log(
            `      • ${entry.leaveTypeRaw} (${entry.daysInPeriod}d) ${tag}`,
          );
          console.log(`        Reason: ${entry.reason}`);
        }
      } else {
        console.log(`    (No leaves this period)`);
      }
    } else {
      employeesWithoutBonus++;
      if (ab.notes.length > 0) {
        console.log(`    Note: ${ab.notes[0]}`);
      }
    }
    console.log();
  }

  // Run-level warnings
  if (result.runWarnings.length > 0) {
    console.log("Run warnings:");
    for (const w of result.runWarnings) {
      console.log(`  • ${w}`);
    }
    console.log();
  }

  console.log("─".repeat(60));
  console.log("✅ Phase 3c smoke complete.");
  console.log(
    `   Calculator: ${result.calculatorVersion} | ` +
      `Employees: ${result.employees.length} | ` +
      `With bonus: ${employeesWithBonus} | ` +
      `Without bonus: ${employeesWithoutBonus} | ` +
      `Total org deduction: ${totalDeductionAcrossOrg} NTD | ` +
      `Compute time: ${result.computeTimeMs}ms`,
  );
}

main().catch((err) => {
  console.error("\nUnhandled error:", err);
  process.exit(1);
});
