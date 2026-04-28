// scripts/smoke-step6-chain.ts
//
// Phase 3b.5 Step 6 smoke test
// ──────────────────────────────────────────────────────────────────────
// Verifies the chain-aware sick leave calculator works end-to-end
// against real production Supabase data. Narrowly focused on what
// Step 6 added — does NOT re-test Phase 3b totals (existing smoke
// covers that).
//
// Checks:
//   1. computeLeaveDeductions completes without error
//   2. CALCULATOR_VERSION === "phase-3b-v1.1"
//   3. No [CALENDAR_UNAVAILABLE] warning (calendar IS seeded for 2025+2026)
//   4. If any 病假 records exist for the period, surface chain detection
//      details (chain count, multi-record chain warnings, etc.)
//
// Usage:
//   npx tsx scripts/smoke-step6-chain.ts

import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local explicitly (matches aggregator smoke pattern)
config({ path: resolve(process.cwd(), ".env.local") });

import { computeLeaveDeductions } from "../src/lib/payroll/leaveDeduction";

const TEST_ORG_ID = "02bb4bee-5538-4add-9a2d-32872cbccd7d";
const PERIOD_YEAR = 2026;
const PERIOD_MONTH = 4;

async function main() {
  console.log("Atlas EIP — Phase 3b.5 Step 6 Smoke Test");
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
    process.exit(1);
  }
  console.log(`  ✓ Completed in ${Date.now() - t0}ms`);
  console.log();

  // Check 2: calculator version
  console.log("[2/4] Verifying calculator version...");
  const expectedVersion = "phase-3b-v1.1";
  if (result.calculatorVersion !== expectedVersion) {
    console.error(
      `  ✗ Expected ${expectedVersion}, got ${result.calculatorVersion}`,
    );
    process.exit(1);
  }
  console.log(`  ✓ ${result.calculatorVersion}`);
  console.log();

  // Check 3: calendar service loaded successfully (no degradation warning)
  console.log("[3/4] Verifying chain detection enabled...");
  const calUnavailable = result.runWarnings.find((w) =>
    w.includes("[CALENDAR_UNAVAILABLE]"),
  );
  if (calUnavailable) {
    console.error("  ✗ Calendar service degraded — chain detection skipped:");
    console.error(`    ${calUnavailable}`);
    process.exit(1);
  }
  console.log("  ✓ Calendar service loaded; chain detection active");
  console.log();

  // Check 4: chain detection details for any sick leaves
  console.log("[4/4] Surfacing chain detection details...");
  console.log();
  console.log(`  Employees processed: ${result.employees.length}`);

  let anySickFound = false;
  let totalChainWarnings = 0;
  for (const emp of result.employees) {
    const sickRecords = emp.leaveOccurrences.filter(
      (o) =>
        o.classification.ok === true &&
        o.classification.canonicalKey === "sick_unhospitalized",
    );
    const chainWarnings = emp.warnings.filter((w) =>
      w.includes("CONTINUOUS_SICK_LEAVE_CHAIN_DETECTED"),
    );
    if (sickRecords.length > 0 || chainWarnings.length > 0) {
      anySickFound = true;
      console.log();
      console.log(`  Employee: ${emp.fullName} (${emp.userId})`);
      console.log(`    Sick records: ${sickRecords.length}`);
      console.log(`    Chain warnings: ${chainWarnings.length}`);
      console.log(`    Total deduction: ${emp.totalLeaveDeductionAmount} NTD`);
      console.log(
        `    Half-pay days: ${emp.totalHalfPayLeaveDays}, ` +
          `Full-pay days: ${emp.totalFullPayLeaveDays}, ` +
          `Unpaid days: ${emp.totalUnpaidLeaveDays}`,
      );
      for (const sr of sickRecords) {
        if (sr.payTreatment) {
          console.log(`    Record ${sr.sourceWorkflowSubmissionId}:`);
          console.log(`      ${sr.payTreatment.calculationDetail}`);
        }
      }
      for (const w of chainWarnings) {
        console.log(`    ⚠ ${w}`);
        totalChainWarnings++;
      }
    }
  }

  if (!anySickFound) {
    console.log("  (No 病假 records in scope — chain logic not exercised");
    console.log("   for this period; legacy/non-sick paths verified instead.)");
  }
  console.log();

  // Run-level warnings summary
  if (result.runWarnings.length > 0) {
    console.log("Run warnings:");
    for (const w of result.runWarnings) {
      console.log(`  • ${w}`);
    }
    console.log();
  }

  console.log("─".repeat(60));
  console.log("✅ Step 6 smoke complete.");
  console.log(
    `   Calculator: ${result.calculatorVersion} | ` +
      `Employees: ${result.employees.length} | ` +
      `Chain warnings: ${totalChainWarnings} | ` +
      `Compute time: ${result.computeTimeMs}ms`,
  );
}

main().catch((err) => {
  console.error("\nUnhandled error:", err);
  process.exit(1);
});
