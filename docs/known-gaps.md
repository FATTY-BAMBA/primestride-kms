# Atlas EIP - Known Gaps in Wage Validation

**Status:** Living document. Updated as gaps are closed or new ones surfaced.
**Scope:** Wage-validation correctness in the Phase 3k pipeline. Other operational concerns (migration drift, RLS hardening, etc.) live in separate documents if at all.

---

## Thesis

The Phase 3k commits (`ae180b0` migration, `65884ae` schema, `967f142` handler) implement a correct end-to-end wage-floor enforcement for the configuration that Atlas EIP currently models: a single `salary_base` column on `profiles`, with `pay_basis` and `employment_type` context fetched and merged for partial PATCHes.

Within that scope, the validation works as designed. Outside that scope, there are real gaps. This document names them so they're tracked rather than rediscovered.

The gaps fall into two categories:

- **Schema-level gaps** - cases where the wage-floor rule could fire but doesn't, because the schema's input fields don't carry enough information to apply the rule.
- **Model-level gaps** - cases where the underlying data model is too simple to represent Taiwanese payroll reality, which means the wage-floor rule is correct against the wrong abstraction.

Schema gaps are smaller and can be closed inside the existing schema-factory refactor. Model gaps are larger and require new columns, new migrations, and rework of `applyTaiwanPayrollDefaults`.

---

## Schema-level gaps (Phase 3k superRefine)

These are documented inline in `src/lib/admin/employeeUpdateSchema.ts` and in two `KNOWN GAP` tests in `src/lib/admin/__tests__/employeeUpdateSchema.test.ts`. Listed here for visibility.

### G1. Hourly minimum wage not enforced

**What:** Taiwan's 2026 statutory hourly minimum is NT$196/hr (same MOL announcement as the NT$29,500 monthly minimum). The schema currently passes any `salary_base` value when `pay_basis = "hourly"`.

**Why it matters:** An admin can configure an hourly worker at NT$50/hr and Atlas EIP accepts it. Real Taiwanese labor inspections (勞動檢查) check hourly rates against the hourly floor for hourly workers; the schema doesn't.

**Workaround today:** None at the platform level. Customers must self-police hourly rates.

**Closes when:** Schema-factory refactor lands. Adds an injected `basicHourlyWage` value alongside the existing monthly value, branches the superRefine on `pay_basis`. Test exists at `src/lib/admin/__tests__/employeeUpdateSchema.test.ts:156` (KNOWN GAP) and is ready to flip from `expect(true)` to `expect(false)` once enforcement lands.

### G2. Intern subtype not modeled

**What:** Taiwan distinguishes 學習型實習生 (learning-type interns, often outside LSA) from 勞動型實習生 (labor-type interns, LSA-covered and entitled to minimum wage). The schema's `employment_type = "intern"` doesn't distinguish them. All interns currently bypass the wage-floor check.

**Why it matters:** Roughly half of Taiwanese SMB internships are labor-type. For those, paying NT$5,000/月 is illegal. Atlas EIP currently accepts it.

**Workaround today:** None. Admins manually classify and self-police.

**Closes when:** A new `intern_subtype` enum field is added to `profiles`, with values like `learning_type` and `labor_type`. Schema's superRefine then treats `labor_type` as LSA-covered. Test exists at `src/lib/admin/__tests__/employeeUpdateSchema.test.ts:199` (KNOWN GAP).

### G3. Part-time prorated floor not computed

**What:** Part-time monthly-paid employees are entitled to a prorated minimum wage based on contracted hours. Atlas EIP doesn't model `contracted_hours_per_week`, so the prorated floor can't be computed and the schema doesn't enforce.

**Why it matters:** A part-timer contracted for 20 hours/week and paid NT$15,000/月 is legal (above proration). One contracted for 40 hours/week paid NT$15,000/月 is not (below proration). Atlas EIP can't tell the difference.

**Workaround today:** None. The schema permissively accepts part-time monthly pay below the full-time floor without checking proration.

**Closes when:** A `contracted_hours_per_week` numeric field is added to `profiles`. Schema's superRefine then computes the prorated floor for `employment_type = "part_time" + pay_basis = "monthly"` and validates against it.

### G4. Contractor classification trusted as-given

**What:** Taiwan has a known 假承攬，真僱傭 (false-contractor, real-employment) misclassification problem. Companies classify employees as 承攬 (independent contractors) to avoid LSA obligations. Atlas EIP's schema trusts whatever classification the admin enters.

**Why it matters:** This is a real source of labor-law liability when the relationship is challenged in court. The schema can't adjudicate misclassification; that's a higher-order concern.

**Workaround today:** Atlas EIP's Compliance Scanner module is the right place for this check (separate from schema validation). Scope: looks at work patterns (regular hours, exclusive employer, supervised work) and flags likely misclassifications.

**Closes when:** Compliance Scanner adds a misclassification-risk check. Out of scope for the schema-factory refactor; tracked here for completeness.

---

## Model-level gaps (data model is too simple)

These are *not* in any current superRefine comment or test. They were surfaced by competitive research against MayoHR's Apollo product (May 2026) and represent a structural divergence between what Atlas EIP models and what Taiwanese payroll actually requires.

### M1. Salary structure is single-component

**What:** Atlas EIP's `profiles` table represents salary as `salary_base` (a single number) plus `attendance_bonus_monthly` (one separate field). Real Taiwanese payroll typically separates 5+ components, each handled differently for tax and labor insurance:

- **本薪 (base salary)** - what `salary_base` approximates
- **伙食津貼 (meal allowance)** - partially tax-exempt up to NT$3,000/月
- **職務加給 (position allowance)** - fully taxable, factors into wage-floor calculation
- **全勤獎金 (perfect-attendance bonus)** - what `attendance_bonus_monthly` covers
- **交通津貼 (transportation allowance)** - partial tax exemption
- **其他加項/扣項** - other additions/deductions

**Why it matters:** A customer paying an employee NT$50,000/月 with structure (本薪 45,000 + 伙食 3,000 + 全勤 2,000) is taxed differently from one paying straight NT$50,000 as 本薪. Today, Atlas EIP can't distinguish: customers either lump everything into `salary_base` (over-pays tax) or manage allocation outside the system (defeats the platform's purpose).

**Workaround today:** Customers using Atlas EIP for primary payroll calculation must manually reconcile components outside the system. Customers using Atlas EIP only for HR/compliance (the current pilot target) are not blocked by this - `salary_base` as the wage-floor anchor is still correct for them.

**Closes when:** A new `salary_components` table (or JSON column on `profiles`) models per-employee component breakdowns. `applyTaiwanPayrollDefaults` reads components individually for tax/insurance bracket calculations. Multi-week refactor; not Phase 3k scope.

**Reference:** MayoHR Apollo's 薪資科目 (salary categories) model - `基本薪資`, `固定津貼`, `獎金`, `其他加項`, `其他扣項` - observed in their Payroll > 參數設定 > 薪資相關 > 薪資科目 module. Their 5-category scheme is one viable target shape.

### M2. No salary effective-date history

**What:** Atlas EIP's `profiles.salary_base` is a single column. When an admin updates the salary, the previous value is overwritten. There is no history table.

**Why it matters:**
- **Back-pay calculations** are impossible. An admin needing to apply a raise retroactive to April 1 cannot represent "salary was X from Jan 1 to Mar 31, Y from Apr 1 onward."
- **Audit response** is impossible. A labor inspection asking "prove this employee's wage was always above the minimum throughout 2025" cannot be answered without external records.
- **Mid-month changes** (raises, demotions, role changes) lose their semantics.

**Workaround today:** None at the platform level. Customers maintain salary history outside the system.

**Closes when:** A `salary_history` table (or equivalent) is added with `(user_id, effective_date, salary_base, ...)`. The PATCH handler inserts a new history row instead of overwriting. Reads consult the latest row where `effective_date <= today`. Reasonable shape, multi-week work.

**Reference:** MayoHR Apollo uses a 生效日 (effective date) on every salary record (薪資資料 > 新增表單). Each salary change is a new record, not an edit.

### M3. No 破月 (mid-month proration) rules

**What:** When an employee starts mid-month, leaves mid-month, or has a salary change mid-month, payroll for that month must be prorated. Apollo lets admins choose between 日曆日 (calendar-days denominator: e.g., 12/31 for May) and 30日 (fixed-30 denominator: e.g., 12/30). Atlas EIP doesn't model proration at all.

**Why it matters:** A new hire on 5/20 should receive 12/31 (or 12/30, per company convention) of their monthly salary for May. Without 破月 rules, the customer either pays a full month (overpays) or computes proration manually outside the system.

**Workaround today:** None. Customers handle proration in spreadsheets.

**Closes when:** A `payroll_proration_method` setting is added at the organization level (or per-employee), and `applyTaiwanPayrollDefaults` factors in start/end dates within the period. Lower priority than M1 and M2; only applies to customers who use Atlas EIP for primary payroll calculation.

**Reference:** Apollo's 破月計算規則 - admin-configurable choice between 日曆日 and 30日 denominators, applied to actual days worked in the period.

---

## Out-of-scope for this document

The following are real concerns but are tracked elsewhere or belong in different documents:

- **Migration drift** - 43 tables in production, 4 in `supabase/migrations/`. Operational hygiene.
- **RLS audit on profiles** - `rls_enabled = true` with zero policies; locked down by default but worth explicit SELECT policies if client-side queries become needed.
- **`/api/subscription` POST owner-only restriction missing** - security gap, not wage-validation concern.
- **Salary upper-bound sanity check** - typo of extra zero on a contractor retainer would silently store bad value. UX/safety concern.

These are valid and worth fixing in their own time, but they don't belong in the wage-validation gaps narrative.

---

## How this document gets used

When closing a gap:
1. Update the relevant gap entry above. Strike-through the gap or mark `**CLOSED in <commit-hash>**` with a one-line description of how it was closed.
2. If the closure introduces new gaps, add them.
3. Don't delete closed entries - they're history. They show how the validation pipeline matured over time.

When discovering a new gap:
1. Add it to the appropriate section (Schema-level if it's a superRefine concern, Model-level if it's structural).
2. Use the same structure: What, Why it matters, Workaround today, Closes when.
3. If the gap straddles categories, name that explicitly rather than forcing a fit.

The document is a tool for honest engineering, not a marketing artifact. It exists to make sure incomplete validation is named rather than hidden, and to give grant reviewers, partner consultants, and future maintainers an accurate picture of where Atlas EIP is and isn't.
