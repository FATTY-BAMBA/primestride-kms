// scripts/smoke-fetch-brackets.ts
//
// One-shot smoke test for fetchBrackets.ts.
// Validates:
//   - admin.ts client connects to Supabase
//   - payroll schema is accessible via service-role
//   - All bracket tables, rates, and fixtures return expected counts
//
// Run: npx tsx scripts/smoke-fetch-brackets.ts

import { config } from "dotenv";
import path from "path";

// Load .env.local (Next.js convention, not picked up by default for scripts)
config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  fetchPayrollReferenceData,
  effectiveDateForPeriod,
} from "../src/lib/payroll/fetchBrackets";

async function main() {
  console.log("─────────────────────────────────────────────");
  console.log("  fetchBrackets.ts smoke test");
  console.log("─────────────────────────────────────────────");
  console.log("");

  // Use April 2026 as the test period
  const effectiveDate = effectiveDateForPeriod(2026, 4);
  console.log(`Effective date: ${effectiveDate.toISOString().split("T")[0]}`);
  console.log("");

  console.log("Calling fetchPayrollReferenceData()...");
  const start = Date.now();

  const data = await fetchPayrollReferenceData(effectiveDate);
  const elapsed = Date.now() - start;

  console.log(`✓ Returned in ${elapsed}ms`);
  console.log("");

  // Print counts
  console.log("Counts:");
  console.log(`  labor brackets:       ${data.labor.length}`);
  console.log(`  NHI brackets:         ${data.nhi.length}`);
  console.log(`  pension brackets:     ${data.pension.length}`);
  console.log(`  fixtures:             ${data.fixtures.length}`);
  console.log("");

  // Print key rate values
  console.log("Insurance rates (key values):");
  console.log(`  labor_total_rate:           ${data.rates.labor_total_rate}`);
  console.log(`  nhi_rate:                   ${data.rates.nhi_rate}`);
  console.log(`  pension_employer_min_rate:  ${data.rates.pension_employer_min_rate}`);
  console.log("");

  // Validate against expected
  const expected = { labor: 11, nhi: 58, pension: 62, fixtures: 76, laborRate: 0.125 };
  const checks = [
    { name: "labor count", actual: data.labor.length, expected: expected.labor },
    { name: "NHI count", actual: data.nhi.length, expected: expected.nhi },
    { name: "pension count", actual: data.pension.length, expected: expected.pension },
    { name: "fixtures count", actual: data.fixtures.length, expected: expected.fixtures },
    { name: "labor_total_rate", actual: data.rates.labor_total_rate, expected: expected.laborRate },
  ];

  console.log("Validation:");
  let allPassed = true;
  for (const check of checks) {
    const ok = check.actual === check.expected;
    if (!ok) allPassed = false;
    console.log(`  ${ok ? "✓" : "✗"} ${check.name}: ${check.actual} (expected ${check.expected})`);
  }
  console.log("");

  if (allPassed) {
    console.log("✓ ALL CHECKS PASSED — fetchBrackets.ts is wired correctly.");
    process.exit(0);
  } else {
    console.log("✗ SOME CHECKS FAILED — investigation needed.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("");
  console.error("✗ SMOKE TEST FAILED:");
  console.error(err);
  console.error("");
  process.exit(1);
});