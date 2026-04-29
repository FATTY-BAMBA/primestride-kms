// scripts/smoke-phase-3d-persist.ts
//
// Phase 3d.1+3d.2 smoke test
// ──────────────────────────────────────────────────────────────────────
// End-to-end verification of the persistence layer against real prod.
//
// Flow:
//   1. computeLeaveDeductions for April 2026, test org
//   2. persistPayrollRun (first run) — should INSERT, no prior to supersede
//   3. getCurrentPayrollRun — read it back
//   4. getPayrollLineItems — read all line items
//   5. Diff persisted data vs. in-memory result
//   6. Run AGAIN — second run should supersede the first
//   7. Verify supersededRunId points back; verify only one current run exists
//
// Usage:
//   npx tsx scripts/smoke-phase-3d-persist.ts

import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { computeLeaveDeductions } from "../src/lib/payroll/leaveDeduction";
import {
  persistPayrollRun,
  getPayrollRun,
  getCurrentPayrollRun,
  getPayrollLineItems,
} from "../src/lib/payroll/payrollPersistence";
import { adminClient } from "../src/lib/supabase/admin";

const TEST_ORG_ID = "02bb4bee-5538-4add-9a2d-32872cbccd7d";
const PERIOD_YEAR = 2026;
const PERIOD_MONTH = 4;
const TRIGGERED_BY = "smoke-test-user";
const TRIGGERED_BY_NAME = "Phase 3d Smoke Test";

let validations = 0;
let failures = 0;

function check(label: string, cond: boolean, detail = ""): void {
  validations++;
  const tag = cond ? "✓" : "✗";
  console.log(`  ${tag} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

async function main() {
  console.log("Atlas EIP — Phase 3d Smoke Test (Persistence)");
  console.log("─".repeat(60));
  console.log(`Org:    ${TEST_ORG_ID}`);
  console.log(`Period: ${PERIOD_YEAR}-${String(PERIOD_MONTH).padStart(2, "0")}`);
  console.log();

  // ── Step 1: Compute ──

  console.log("[1/8] Computing payroll (in-memory)...");
  const t0 = Date.now();
  const computed1 = await computeLeaveDeductions({
    organizationId: TEST_ORG_ID,
    periodYear: PERIOD_YEAR,
    periodMonth: PERIOD_MONTH,
  });
  console.log(`  ✓ Computed in ${Date.now() - t0}ms`);
  console.log(`    Calculator: ${computed1.calculatorVersion}`);
  console.log(`    Employees: ${computed1.employees.length}`);
  console.log();

  // ── Step 2: Persist (first run) ──

  console.log("[2/8] Persisting first run...");
  const persist1 = await persistPayrollRun({
    runResult: computed1,
    triggeredBy: TRIGGERED_BY,
    triggeredByName: TRIGGERED_BY_NAME,
  });
  console.log(`  ✓ Persisted run ${persist1.runId}`);
  console.log(`    Line items written: ${persist1.lineItemsWritten}`);
  console.log(`    Superseded prior run: ${persist1.supersededRunId ?? "(none)"}`);
  console.log();

  // ── Step 3: Read back the run ──

  console.log("[3/8] Reading back the run...");
  const run1 = await getPayrollRun(persist1.runId);
  check("run exists by ID", run1 !== null);
  if (!run1) {
    console.error("Cannot continue without run; aborting.");
    process.exit(1);
  }
  check("calculator_version matches", run1.calculatorVersion === computed1.calculatorVersion,
    `${run1.calculatorVersion} vs ${computed1.calculatorVersion}`);
  check("triggered_by matches", run1.triggeredBy === TRIGGERED_BY);
  check("triggered_by_name matches", run1.triggeredByName === TRIGGERED_BY_NAME);
  check("period matches",
    run1.periodYear === PERIOD_YEAR && run1.periodMonth === PERIOD_MONTH);
  check("organization_id matches", run1.organizationId === TEST_ORG_ID);
  check("not yet superseded", run1.supersededAt === null);
  check("compute_time_ms preserved", run1.computeTimeMs === computed1.computeTimeMs);
  console.log();

  // ── Step 4: Read back line items ──

  console.log("[4/8] Reading back line items...");
  const lines1 = await getPayrollLineItems(persist1.runId);
  check("line items count matches",
    lines1.length === persist1.lineItemsWritten,
    `${lines1.length} vs ${persist1.lineItemsWritten}`);
  console.log(`    Line items: ${lines1.length}`);
  for (const t of ["leave_deduction", "leave_filtered", "attendance_bonus_deduction", "attendance_bonus_paid"]) {
    const count = lines1.filter((l) => l.lineType === t).length;
    if (count > 0) console.log(`      • ${t}: ${count}`);
  }
  console.log();

  // ── Step 5: Diff persisted vs. in-memory ──

  console.log("[5/8] Diffing persisted data vs. in-memory result...");

  // Total leave deduction across employees
  const expectedLeaveTotal = computed1.employees.reduce(
    (sum, e) => sum + e.totalLeaveDeductionAmount,
    0,
  );
  check("total_leave_deduction_amount matches",
    Number(run1.totalLeaveDeductionAmount) === expectedLeaveTotal,
    `${run1.totalLeaveDeductionAmount} vs ${expectedLeaveTotal}`);

  const expectedBonusTotal = computed1.employees.reduce(
    (sum, e) => sum + e.attendanceBonus.totalDeduction,
    0,
  );
  check("total_attendance_bonus_deduction matches",
    Number(run1.totalAttendanceBonusDeduction) === expectedBonusTotal,
    `${run1.totalAttendanceBonusDeduction} vs ${expectedBonusTotal}`);

  check("total_employees matches",
    run1.totalEmployees === computed1.employees.length,
    `${run1.totalEmployees} vs ${computed1.employees.length}`);

  // Verify all source_workflow_submission_ids round-trip for leave_deduction lines
  const expectedSourceIds = computed1.employees.flatMap((e) =>
    e.leaveOccurrences.map((o) => o.sourceWorkflowSubmissionId),
  );
  const persistedSourceIds = lines1
    .filter((l) => l.lineType === "leave_deduction" || l.lineType === "leave_filtered")
    .map((l) => l.sourceWorkflowSubmissionId)
    .filter((id): id is string => id !== null);
  check(
    "all source_workflow_submission_ids preserved",
    expectedSourceIds.every((id) => persistedSourceIds.includes(id)),
    `${persistedSourceIds.length}/${expectedSourceIds.length} found`,
  );

  // Verify run_warnings flow through
  check("run_warnings count matches",
    run1.runWarnings.length === computed1.runWarnings.length,
    `${run1.runWarnings.length} vs ${computed1.runWarnings.length}`);

  console.log();

  // ── Step 6: Re-run and supersede ──

  console.log("[6/8] Re-running to test soft-replace...");
  const computed2 = await computeLeaveDeductions({
    organizationId: TEST_ORG_ID,
    periodYear: PERIOD_YEAR,
    periodMonth: PERIOD_MONTH,
  });
  const persist2 = await persistPayrollRun({
    runResult: computed2,
    triggeredBy: TRIGGERED_BY,
    triggeredByName: TRIGGERED_BY_NAME + " (rerun)",
  });
  console.log(`  ✓ Second run persisted: ${persist2.runId}`);
  console.log(`    Supersedes: ${persist2.supersededRunId}`);
  console.log();

  // ── Step 7: Verify soft-replace ──

  console.log("[7/8] Verifying soft-replace bookkeeping...");
  check("second run reports superseding the first",
    persist2.supersededRunId === persist1.runId,
    `${persist2.supersededRunId} vs ${persist1.runId}`);

  // Re-fetch the FIRST run; it should now be marked superseded
  const run1AfterRerun = await getPayrollRun(persist1.runId);
  check("first run superseded_at is set",
    run1AfterRerun !== null && run1AfterRerun.supersededAt !== null);
  check("first run superseded_by_run_id points to second",
    run1AfterRerun !== null && run1AfterRerun.supersededByRunId === persist2.runId,
    `${run1AfterRerun?.supersededByRunId} vs ${persist2.runId}`);

  // The current run should now be the second
  const currentRun = await getCurrentPayrollRun({
    organizationId: TEST_ORG_ID,
    periodYear: PERIOD_YEAR,
    periodMonth: PERIOD_MONTH,
  });
  check("current run is the second run",
    currentRun !== null && currentRun.id === persist2.runId,
    `${currentRun?.id} vs ${persist2.runId}`);

  // Verify only ONE current run exists for this period (no duplicates)
  const supabase = adminClient();
  const { data: currentRunsForPeriod } = await supabase
    .from("payroll_runs")
    .select("id")
    .eq("organization_id", TEST_ORG_ID)
    .eq("period_year", PERIOD_YEAR)
    .eq("period_month", PERIOD_MONTH)
    .is("superseded_at", null);
  check(
    "exactly one current run for period",
    (currentRunsForPeriod?.length ?? 0) === 1,
    `found ${currentRunsForPeriod?.length} current run(s)`,
  );
  console.log();

  // ── Step 8: Cleanup ──

  console.log("[8/8] Cleaning up test runs...");
  // Delete both runs (line items cascade via FK)
  const { error: del1 } = await supabase
    .from("payroll_runs")
    .delete()
    .in("id", [persist1.runId, persist2.runId]);
  if (del1) {
    console.log(`  ⚠ Cleanup error: ${del1.message}`);
  } else {
    console.log(`  ✓ Cleaned up both test runs`);
  }
  console.log();

  // ── Summary ──

  console.log("─".repeat(60));
  if (failures === 0) {
    console.log(`✅ Phase 3d smoke complete. All ${validations} validations passed.`);
  } else {
    console.log(`⚠ Phase 3d smoke complete with ${failures}/${validations} validations FAILED.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nUnhandled error:", err);
  process.exit(1);
});
