// scripts/smoke-leave-aggregator.ts
//
// Phase 3b read-only smoke test for src/lib/payroll/leaveAggregator.ts.
//
// Calls aggregateLeaveData() against a real organization and inspects
// the output structure. Validates that:
//   1. Supabase column names are correct (no missing-column errors)
//   2. Active employee filter works (only is_active=true users included)
//   3. Profile field mapping is correct (salary_base, hire_date, etc.)
//   4. Period intersection logic produces sensible numbers
//   5. YTD partition correctly excludes current-period leaves
//   6. Form data parsing handles real production strings ("病假", "特休")
//   7. Warnings are surfaced where data is incomplete
//
// SAFETY: This script is strictly read-only. It uses .select() exclusively.
// No writes, no inserts, no updates, no deletes occur in any code path.
//
// Usage:
//   npx tsx scripts/smoke-leave-aggregator.ts
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local)

import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  aggregateLeaveData,
  type AggregatedLeaveData,
  type AggregatedEmployee,
} from "../src/lib/payroll/leaveAggregator";

// ── Configuration ─────────────────────────────────────────────────

// Org with real production leave data (per Phase 3b schema investigation).
// Has at least one employee with sick_used: 27 (close to 30-day cap).
const TEST_ORG_ID = "02bb4bee-5538-4add-9a2d-32872cbccd7d";

// April 2026 — chosen to exercise the YTD partition logic. The test
// user (user_3AenzTmppp6NfJID57yREWOrYq4) has 2 leaves in March 2026,
// which become YTD context for an April run, and 0 leaves in April,
// which keeps leavesInPeriod empty. This isolates and validates the
// YTD window math without confounding it with intersection logic.
const TEST_PERIOD_YEAR = 2026;
const TEST_PERIOD_MONTH = 4;

// ── Output formatters ─────────────────────────────────────────────

function fmtDate(d: Date | null): string {
  if (!d) return "(null)";
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function summarize(data: AggregatedLeaveData): void {
  console.log("\n" + "═".repeat(72));
  console.log("AGGREGATED LEAVE DATA");
  console.log("═".repeat(72));

  console.log(`\norganizationId: ${data.organizationId}`);
  console.log(
    `period: ${data.period.year}-${String(data.period.month).padStart(2, "0")} ` +
      `(${fmtDate(data.period.startDate)} → ${fmtDate(data.period.endDate)}, ` +
      `${data.period.daysInMonth} days)`,
  );
  console.log(`employees: ${data.employees.length}`);

  if (data.warnings.length > 0) {
    console.log(`\norg-level warnings (${data.warnings.length}):`);
    for (const w of data.warnings) console.log(`  ⚠ ${w}`);
  } else {
    console.log("\norg-level warnings: none");
  }

  // Per-employee summary
  for (let i = 0; i < data.employees.length; i++) {
    summarizeEmployee(data.employees[i], i + 1);
  }

  console.log("\n" + "═".repeat(72));
  console.log("AGGREGATE TOTALS");
  console.log("═".repeat(72));

  const totalLeavesInPeriod = data.employees.reduce(
    (sum, e) => sum + e.leavesInPeriod.length,
    0,
  );
  const totalYtdRecords = data.employees.reduce(
    (sum, e) => sum + e.ytdContext.rawRecords.length,
    0,
  );
  const totalDaysInPeriod = data.employees.reduce(
    (sum, e) =>
      sum +
      e.leavesInPeriod.reduce((s, l) => s + l.daysInPeriod, 0),
    0,
  );
  const totalWarnings = data.employees.reduce(
    (sum, e) => sum + e.warnings.length,
    0,
  );

  console.log(`employees in scope:        ${data.employees.length}`);
  console.log(`leaves in this period:     ${totalLeavesInPeriod}`);
  console.log(`leave-days in this period: ${totalDaysInPeriod}`);
  console.log(`YTD records:               ${totalYtdRecords}`);
  console.log(`employee-level warnings:   ${totalWarnings}`);
  console.log("");
}

function summarizeEmployee(emp: AggregatedEmployee, idx: number): void {
  console.log("\n" + "─".repeat(72));
  console.log(
    `Employee #${idx}: ${emp.profile.fullName ?? "(no name)"} ` +
      `[${emp.profile.userId.substring(0, 20)}…]`,
  );
  console.log("─".repeat(72));

  console.log(`  salary_base:        ${emp.profile.salaryBase} ${emp.profile.salaryCurrency}`);
  console.log(`  hire_date:          ${fmtDate(emp.profile.hireDate)}`);
  console.log(`  termination_date:   ${fmtDate(emp.profile.terminationDate)}`);
  console.log(`  gender:             ${emp.profile.gender ?? "(not set)"}`);
  console.log(`  department:         ${emp.profile.department ?? "(not set)"}`);
  console.log(
    `  insurance:          labor=${emp.profile.laborInsuredSalary ?? "(null)"} ` +
      `nhi=${emp.profile.nhiInsuredSalary ?? "(null)"} ` +
      `pension=${emp.profile.pensionContributionWage ?? "(null)"} ` +
      `voluntary=${emp.profile.voluntaryPensionRate} ` +
      `dependents=${emp.profile.nhiDependents}`,
  );
  console.log(
    `  YTD window:         ${fmtDate(emp.ytdContext.windowStart)} → ${fmtDate(emp.ytdContext.windowEnd)} (exclusive)`,
  );
  console.log(`  YTD records:        ${emp.ytdContext.rawRecords.length}`);
  if (emp.ytdContext.rawRecords.length > 0) {
    for (const r of emp.ytdContext.rawRecords.slice(0, 5)) {
      console.log(
        `    - "${r.leaveTypeRaw}" ${r.daysClaimed}d ` +
          `[${fmtDate(r.startDate)} → ${fmtDate(r.endDate)}] ` +
          `(${r.durationType ?? "no-type"})`,
      );
    }
    if (emp.ytdContext.rawRecords.length > 5) {
      console.log(`    ...and ${emp.ytdContext.rawRecords.length - 5} more`);
    }
  }

  console.log(`  leaves in period:   ${emp.leavesInPeriod.length}`);
  for (const l of emp.leavesInPeriod) {
    const span = l.spansBeyondPeriod ? " ⚠ spans periods" : "";
    console.log(
      `    - "${l.leaveTypeRaw}" claimed=${l.daysClaimedFull}d, in-period=${l.daysInPeriod}d ` +
        `[${fmtDate(l.originalStart)} → ${fmtDate(l.originalEnd)}] ` +
        `(intersected: ${fmtDate(l.effectiveStart)} → ${fmtDate(l.effectiveEnd)}) ` +
        `${l.durationType ?? "no-type"}${span}`,
    );
    if (l.reason) {
      console.log(`        reason: "${l.reason}"`);
    }
  }

  if (emp.warnings.length > 0) {
    console.log(`  warnings (${emp.warnings.length}):`);
    for (const w of emp.warnings) console.log(`    ⚠ ${w}`);
  }
}

// ── Validation checks ─────────────────────────────────────────────

function runValidations(data: AggregatedLeaveData): void {
  console.log("\n" + "═".repeat(72));
  console.log("VALIDATION CHECKS");
  console.log("═".repeat(72) + "\n");

  let pass = 0;
  let fail = 0;

  function check(label: string, condition: boolean, detail?: string): void {
    if (condition) {
      console.log(`  ✓ ${label}`);
      pass++;
    } else {
      console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
      fail++;
    }
  }

  // Period sanity
  check(
    "period.startDate is first of month",
    data.period.startDate.getUTCDate() === 1,
  );
  check(
    "period.startDate < period.endDate",
    data.period.startDate < data.period.endDate,
  );
  check(
    "period.daysInMonth in range 28..31",
    data.period.daysInMonth >= 28 && data.period.daysInMonth <= 31,
  );

  // Employees sanity
  check(
    "at least one active employee returned",
    data.employees.length > 0,
    data.employees.length === 0
      ? "0 employees found — check org_id is correct"
      : undefined,
  );

  for (const emp of data.employees) {
    // Identity
    check(
      `[${emp.profile.userId.substring(0, 16)}…] has userId`,
      !!emp.profile.userId,
    );
    check(
      `[${emp.profile.userId.substring(0, 16)}…] has salary_base`,
      typeof emp.profile.salaryBase === "number" && emp.profile.salaryBase > 0,
      `got ${emp.profile.salaryBase}`,
    );
    check(
      `[${emp.profile.userId.substring(0, 16)}…] is active (not terminated before period)`,
      emp.isActive &&
        (!emp.profile.terminationDate ||
          emp.profile.terminationDate > data.period.startDate),
    );

    // YTD window
    check(
      `[${emp.profile.userId.substring(0, 16)}…] YTD windowStart is Jan 1 of period year`,
      emp.ytdContext.windowStart.getUTCMonth() === 0 &&
        emp.ytdContext.windowStart.getUTCDate() === 1 &&
        emp.ytdContext.windowStart.getUTCFullYear() === data.period.year,
    );
    check(
      `[${emp.profile.userId.substring(0, 16)}…] YTD windowEnd === period.startDate`,
      emp.ytdContext.windowEnd.getTime() === data.period.startDate.getTime(),
    );

    // Per-leave invariants
    for (const l of emp.leavesInPeriod) {
      check(
        `[${emp.profile.userId.substring(0, 16)}…] leave "${l.leaveTypeRaw}" effectiveStart >= period.startDate`,
        l.effectiveStart >= data.period.startDate,
      );
      check(
        `[${emp.profile.userId.substring(0, 16)}…] leave "${l.leaveTypeRaw}" effectiveEnd <= period.endDate`,
        l.effectiveEnd <= data.period.endDate,
      );
      check(
        `[${emp.profile.userId.substring(0, 16)}…] leave "${l.leaveTypeRaw}" daysInPeriod > 0`,
        l.daysInPeriod > 0,
      );
      check(
        `[${emp.profile.userId.substring(0, 16)}…] leave "${l.leaveTypeRaw}" daysInPeriod <= daysClaimedFull`,
        l.daysInPeriod <= l.daysClaimedFull,
      );
    }

    // YTD records should NOT include current-period leaves
    for (const r of emp.ytdContext.rawRecords) {
      check(
        `[${emp.profile.userId.substring(0, 16)}…] YTD record "${r.leaveTypeRaw}" started before period`,
        r.startDate < data.period.startDate,
      );
      check(
        `[${emp.profile.userId.substring(0, 16)}…] YTD record "${r.leaveTypeRaw}" started in period year`,
        r.startDate >= emp.ytdContext.windowStart,
      );
    }
  }

  console.log("\n" + "─".repeat(72));
  console.log(`RESULTS: ${pass} passed, ${fail} failed`);
  console.log("─".repeat(72));

  if (fail > 0) {
    console.log("\n❌ Validation failures detected. Aggregator needs investigation.");
    process.exit(1);
  } else {
    console.log("\n✅ All validations passed.");
  }
}

// ── Entry point ────────────────────────────────────────────────────

async function main() {
  console.log("Smoke-testing leaveAggregator against real data (READ-ONLY)");
  console.log(`org:    ${TEST_ORG_ID}`);
  console.log(`period: ${TEST_PERIOD_YEAR}-${String(TEST_PERIOD_MONTH).padStart(2, "0")}`);
  console.log("");

  const t0 = Date.now();
  const data = await aggregateLeaveData({
    organizationId: TEST_ORG_ID,
    periodYear: TEST_PERIOD_YEAR,
    periodMonth: TEST_PERIOD_MONTH,
  });
  const elapsed = Date.now() - t0;

  console.log(`✓ aggregator completed in ${elapsed}ms`);

  summarize(data);
  runValidations(data);
}

main().catch((err) => {
  console.error("\n❌ Smoke test failed:");
  console.error(err);
  process.exit(1);
});
