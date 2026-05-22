# Atlas EIP — Product State (May 2026)

**Status:** Living document. Updated as the product evolves.
**Companion to:** `docs/known-gaps.md` (wage-validation gaps) and `docs/ia-redesign.md` (navigation restructure spec).
**Scope:** Captures what Atlas EIP is, what it does today, and what's incomplete. Honest engineering documentation — not marketing material.

---

## Thesis

Atlas EIP is an AI-powered employee intelligence platform built for Taiwanese SMBs. It serves companies in the 20-100 person range, providing structured HR workflows, document knowledge management, Taiwan Labor Standards Act (LSA) compliance tools, and auto-generated ESG reporting. The platform integrates capabilities that typically require multiple separate systems — HR, document management, compliance, and reporting — into a single AI-native product.

The platform is technically mature in its core modules. Sign-in, document library, attendance workflow, compliance scanning, and ESG report generation all work today against real data. The combination of auto-generated ESG reports and compliance scanning citing the Ministry of Labor's official open data API represents meaningful capability for the target customer segment.

The product is currently in pre-pilot stage. Active development focuses on closing structural gaps surfaced during pre-pilot review: information architecture, role-based navigation, and selective feature work.

---

## Product positioning

### What Atlas EIP is

A unified employee intelligence platform for Taiwanese SMBs, combining:

- **HR/payroll workflows** — leave requests, attendance, payroll calculation, employee management
- **Knowledge management** — document library with AI-generated summaries, semantic search, version history
- **Compliance** — LSA rule database synced from official government sources, scanner that checks company documents against regulations
- **Reporting** — auto-generated ESG social-pillar reports, platform usage metrics, leave/attendance analytics
- **AI assistance** — admin-facing agent (operational analysis, drafting, tagging) and employee-facing search (policy Q&A with citations)

The product is built around a **"One Box, Zero Forms"** philosophy — natural language inputs that AI parses into structured requests, replacing traditional multi-field HR forms.

### Who it's for

**Primary target:** SMB owners and general managers at 20-100 person Taiwanese companies. These customers typically manage HR through informal channels — LINE messages, Excel spreadsheets, paper-based processes. The product introduces structured workflows, compliance tracking, and AI assistance at a scale that fits the segment.

**Secondary target (later):** Companies wanting to replace existing HR/payroll systems with an AI-native alternative. This segment requires deeper payroll capability (multi-component salary structures, effective-dated history, mid-month proration) that is currently deferred — see `docs/known-gaps.md` for specifics.

### Market context

The Taiwan SMB HR landscape has well-established platforms at the enterprise tier (MayoHR Apollo, Femas) and informal practices at the smaller end (LINE messages, Excel spreadsheets, paper forms). Companies in the 20-100 person range often outgrow informal approaches but find enterprise platforms operationally heavy. Atlas EIP positions in this gap as an AI-native option.

Within this segment, Atlas EIP's current scope reflects deliberate choices: deeper investment in compliance auditability, document AI, and ESG reporting; lighter investment (so far) in multi-component payroll modeling and historical salary tracking — capabilities documented as gaps M1, M2, M3 in `docs/known-gaps.md` and deferred until customer demand surfaces from pilots.

### The "One Box, Zero Forms" philosophy

Traditional HR systems expose dozens of field-laden forms — separate forms for sick leave, annual leave, overtime, business travel, each with distinct fields and validation. Atlas EIP exposes a single text input. The user types "我下週一到週三要請特休，因為要回南部探親" (I want to take annual leave next Monday-Wednesday to visit family) and AI parses the type, dates, and reason into a structured request. The traditional form is eliminated.

This philosophy extends across the product: document upload accepts any format with AI tagging applied automatically; the AI agent accepts natural-language directives ("scan this month's overtime risk") rather than configuration screens; compliance scans run against uploaded documents without templates or rule definitions.

---

## Module inventory

For each module: what it does, who uses it, current status. Status values:
- **Production-ready** — built, tested, deployed, in active use
- **Functional** — built and works, may have rough edges or incomplete polish
- **Partial** — exists but missing capability or unpopulated with data
- **Deferred** — built but currently not in primary nav per `docs/ia-redesign.md`

### Authentication & onboarding

**What:** Clerk-based SSO with Google and GitHub, plus email/password. Organization-aware (multi-tenant via Clerk organizations). Role assignment supports owner, admin, and member roles. Onboarding flow at `/onboarding` handles new-user setup.

**Who uses it:** All users.

**Status:** Production-ready. Sign-in page is polished and investor-presentable.

### Knowledge Library

**What:** Document repository with AI-generated summaries, version history, helpfulness voting (👍/👎), tag management, and four search modes (Browse, Hybrid, Keyword, Semantic). Documents are tagged with type (guide, policy, reference, report, employee guide) and visibility (org-wide, group-specific). Each document has a detail view showing the AI summary, version history, original uploaded file (downloadable), tags, and feedback statistics.

**Who uses it:** All users for browsing and reading; admins for upload, tagging, version management, and visibility control.

**Status:** Production-ready. One of the strongest pages in the product. The AI Summary feature is a meaningful differentiator against Google Drive or file-share approaches. Minor cosmetic issue: version badge displays "vv1.0" instead of "v1.0" — to be fixed in Phase D polish.

### Atlas Agent (AI 助手)

**What:** Admin-only AI assistant for operational analysis and content tasks. Pre-configured prompt cards include Shadow Audit (scan overtime risk), Subsidy Hunter (find applicable government subsidies), Compliance Polishing, Trend Analysis (3-month leave/overtime trends), Auto-Tag (organize uncategorized documents), and Summary generation. Free-form text input also supported.

**Who uses it:** Admins only. Page clearly states "管理員專用" (Admin Only) with redirection text pointing employees to the search page.

**Status:** Functional. Currently labeled as admin-only in the UI but historically missing the `adminOnly: true` flag in sidebar code — fixed in this sprint as part of the IA restructure.

### Search / Ask Atlas (搜尋)

**What:** Employee-facing AI search across the knowledge library. Returns AI-generated answers with citations to source documents. Distinct from the admin Atlas Agent — this is the read-only Q&A interface for policy questions.

**Who uses it:** All users.

**Status:** Functional. Underused per platform metrics relative to its potential value; could benefit from more prominent surfacing on the home page.

### Request workflows (表單申請)

**What:** Natural-language request submission for leave (請假), overtime (加班), and business travel (出差). AI parses date ranges, reason, type, and other fields from a single text input. Submitted requests appear in a history view with status (pending, approved, rejected, cancelled). Admin approval workflow integrated.

**Who uses it:** All users submit; admins approve.

**Status:** Production-ready. 26 historical records visible in dev/pilot data. The natural-language parsing demonstrates the "One Box, Zero Forms" philosophy concretely. Auto-recognized leave types include 病假 (sick), 出差 (travel), 特休 (annual), 加班 (overtime).

### Attendance — clock-in (我的打卡)

**What:** Employee-facing manual clock-in submission for missed punches. Dark-themed standalone page at `/clock/manual` (distinct visual treatment signals focused task). Constraints clearly stated: 7-day backfill window, at least one of start/end time required. Reason dropdown (forgot, phone dead, system issue, travel, other) with optional explanation. Submission history shown inline.

**Who uses it:** All users.

**Status:** Production-ready. Well-designed page demonstrating thoughtful UX (dark theme for focused mode, structured reason dropdown for admin review consistency, inline history). Cron jobs and 10+ API endpoints support the full attendance flow.

### Attendance — admin approval (出勤審核)

**What:** Admin interface for reviewing pending manual clock-in entries. Approve or reject; approved entries auto-write to attendance records and trigger notification emails. Celebratory empty state ("全部審核完畢！") when queue is clear.

**Who uses it:** Admins.

**Status:** Production-ready. Currently a separate sub-tab of the admin dashboard; per Q1 in `docs/ia-redesign.md`, this consolidates with the attendance wallchart into a unified `出勤` sidebar item with internal tabs.

### Attendance — wallchart (出勤總表)

**What:** Month-grid view of attendance and leave across all employees. Color-coded by leave type (特休, 病假, 事假, 家庭照顧, 婚假, 喪假, 產假, 陪產假, 公假, 加班, 出差, 週末). Navigation by month with quick-jump to current month. Statistics row at the bottom shows daily totals.

**Who uses it:** Admins.

**Status:** Functional. Structurally complete with 12 leave type categories matching Taiwan LSA. UX concern: defaults to current month which may be empty for newer pilots, risking "looks broken" impression. Should auto-navigate to the most recent month with data. Consolidates into `出勤` per Phase B work.

### Payroll calculation (薪資計算)

**What:** Monthly payroll preview and history. Year/month selectors with Preview action that computes leave deductions, attendance bonuses, and salary based on stored profiles. Confirm & Save persists the run for audit trail.

**Who uses it:** Admins.

**Status:** Partial. Page works structurally; history is empty pending real pilot payroll runs. The Phase 3k commits (`ae180b0`, `65884ae`, `967f142`) implemented wage-floor validation correctness. Multi-component salary modeling (M1 in `docs/known-gaps.md`) remains deferred.

### Employee management (員工)

**What:** Admin dashboard tab listing all employees with leave balance summaries (annual, sick, personal, family care). Click into any employee opens the edit modal with comprehensive Taiwan-aware fields: base salary, NHI insured wage, labor insured wage, monthly attendance bonus, pension contribution wage, plus standard HR fields (name, employee ID, job title, department, dates, gender, employment type, national ID, phone, banking, emergency contact, address, notes). The form already distinguishes the various insured wage caps that Taiwan payroll requires.

**Who uses it:** Admins.

**Status:** Production-ready. The form's structure already reflects Taiwan payroll's multi-cap reality (健保投保金額, 勞保投保薪資, 退休金提繳工資 are separate fields with distinct values). Phase D adds a `pay_basis` dropdown (Layer 4) and improves validation surfacing.

### Compliance (合規)

**What:** Live database of Taiwan Labor Standards Act rules synced from the Ministry of Labor's open data API (`apiservice.mol.gov.tw`). 16 LSA rules currently loaded, including 2026 minimum wage updates (NT$29,500 monthly / NT$196 hourly), overtime rate multipliers (LSA Art. 24), working hour caps (LSA Art. 30/32), annual leave progression (LSA Art. 38), maternity leave (LSA Art. 50), and 2026 family care leave updates. Each rule is color-coded by category with view-full-text affordance. Manual sync button with recommended weekly cadence. Companion scanner runs uploaded documents against the rules database.

**Who uses it:** Admins.

**Status:** Production-ready. Hero feature. The combination of government-API-sourced rules + automated company-document scanning is a defensible differentiator against both LINE+Excel and competing HR platforms. Currently the #1 used feature per platform metrics (52% of platform events). Promoted from buried admin tab to top-level sidebar item per Q4 of `docs/ia-redesign.md`.

### ESG Report (ESG 報告)

**What:** Auto-generated ESG social-pillar (S-pillar) report drawn from real-time workflow and compliance records. Covers workforce overview (total employees, approved requests, overtime hours, cap violators), overtime compliance rate (with LSA Art. 32 citation), leave approval rates by category (sick, annual, personal, family care), and exportable annual report. Subtitle explicitly states: "資料來源：Atlas EIP 即時工作流程與合規記錄·自動彙整，無需人工填報" (Data source: Atlas EIP real-time workflow and compliance records, auto-compiled, no manual filing required).

**Who uses it:** Admins, with output suitable for ESG consultants, grant applications, and FSC ESG disclosure requirements.

**Status:** Production-ready. The single strongest argument for Atlas EIP. Real ESG reporting is a growing pain point for Taiwanese SMBs; this module auto-generates from data the system already collects. Promoted from buried admin tab to top-level sidebar item per Q4 of `docs/ia-redesign.md`.

### Document feedback analytics (學習分析)

**What:** Dashboard showing per-document helpfulness feedback aggregated from user 👍/👎 votes. Documents ranked by negative-feedback-first sorting to surface content needing improvement. Shows total documents published, total feedback received, helpfulness distribution.

**Who uses it:** Admins.

**Status:** Functional. Name is slightly misleading ("Learning Analytics" implies LMS/training, but the page is actually document feedback). Optional Phase D item: rename for clarity (e.g., 文件回饋 / Document Feedback). Underlying functionality is sound.

### Platform metrics (指標數據)

**What:** Platform usage analytics — total events, active days, team members, top feature, daily activity trend, feature usage breakdown. Annotated as "可作為政府補助流量佐證" (can serve as government subsidy traffic evidence). Time-window toggle (7/30/90 days).

**Who uses it:** Admins, particularly for grant reporting.

**Status:** Functional. Real data populates; current default window of 30 days may not capture sparse-usage periods, making the page appear empty. Phase D: change default to 90 days or implement smart-default logic to land on the smallest window with nonzero data.

### Knowledge graph (知識圖譜) — DEFERRED FROM PRIMARY NAV

**What:** Force-directed graph visualization of document relationships using React Flow. 8 documents, 16 relationships, color-coded by category (policy / product documentation). Zoom, fullscreen, and re-layout controls.

**Who uses it:** No clear customer-driven use case identified.

**Status:** Deferred from primary navigation per Q2 of `docs/ia-redesign.md`. The page was built for technical exploration rather than to serve a specific customer job. Code remains in the repository; the route `/ai-graph` continues to work. Future feature work (topic clustering or document similarity scoring) could justify re-promoting this to nav with a real job articulated. Tracked as deferred — to be revisited when customer demand surfaces a concrete use case.

### Audit logs (操作紀錄)

**What:** Admin-accessible audit trail of operations.

**Who uses it:** Admins.

**Status:** Functional; not yet surveyed in detail during the May 2026 pre-pilot walkthrough. Listed in sidebar code but not surfaced in screenshots. Per `docs/ia-redesign.md`, moves into the new Settings section.

### Branding (品牌設定)

**What:** Per-organization branding customization — org name, logo emoji, primary/accent colors, tagline. Sidebar already reads from `/api/branding` and renders custom branding.

**Who uses it:** Owners.

**Status:** Functional. Like audit logs, not surveyed in detail during the walkthrough but present in code. Moves into Settings section per `docs/ia-redesign.md`.

### API access / Developer (API)

**What:** API key management for external integrations.

**Who uses it:** Technical admins / developers integrating Atlas EIP with other systems.

**Status:** Functional. Currently a top-level sidebar item under "管理"; per `docs/ia-redesign.md`, moves into the new Settings section where it more naturally belongs.

---

## What's strong

The following capabilities are the product's strongest demonstrable features — the ones that earn customer attention, justify the platform's existence, and warrant prominent surfacing in any walkthrough.

### ESG report auto-generation

The S-pillar ESG report (`/admin` → ESG 報告 tab) is the product's single strongest argument. It auto-compiles a complete social-pillar ESG report from data Atlas EIP collects during normal use — workforce metrics, overtime compliance against LSA Art. 32, leave approval rates by category, cap violation counts. The subtitle states the value directly: "資料來源：Atlas EIP 即時工作流程與合規記錄·自動彙整，無需人工填報" (no manual reporting required).

For Taiwanese SMBs facing growing ESG disclosure expectations from the Financial Supervisory Commission and from supply chain partners, this addresses a real, paid pain point. ESG consultants currently charge meaningful fees to compile reports manually from data scattered across systems. Atlas EIP produces the report as a byproduct of normal HR operations.

Promoted to top-level sidebar visibility in this sprint per `docs/ia-redesign.md`.

### Compliance scanner with government data source

The Compliance module (`/admin` → 合規 tab) loads 16 LSA rules directly from `apiservice.mol.gov.tw` (the Taiwan Ministry of Labor's open data API), with manual sync and recommended weekly cadence. Rules include 2026 minimum wage updates, overtime multipliers, leave entitlement progression, maternity leave, and family care leave. The companion scanner checks uploaded company documents against the rule database.

The combination of official government API + automated document scanning is uncommon in the Taiwan HR market. It builds trust with compliance-cautious SMB owners who currently worry about labor inspections (勞動檢查). Currently the #1 used feature per platform metrics (52% of platform events).

Promoted to top-level sidebar visibility in this sprint.

### Document AI summary

Every document in the Knowledge Library (`/library/[docId]`) renders an AI-generated summary alongside the original uploaded file. A new employee can read the summary in 10 seconds instead of opening a 30-page docx. Tags are auto-applied; helpfulness voting feeds back into document feedback analytics. Version history is tracked.

This is the kind of feature that distinguishes Atlas EIP from a Google Drive folder. The AI summary is genuine value-add that customers couldn't get from a file-share approach.

### Complete attendance workflow

The attendance system covers the full loop: employee submits a manual clock-in correction at `/clock/manual` (dark-themed standalone page); admin reviews in `/admin` → 出勤審核 tab; approval auto-writes to the attendance record and triggers notification email. The wallchart at 出勤總表 visualizes the month across all employees with 12 color-coded leave types matching Taiwan LSA categories.

The end-to-end workflow demonstrates that Atlas EIP is not a thin AI wrapper — there is substantial operational depth in HR functionality.

### Bilingual interface throughout

Every UI label appears in Traditional Chinese first, English second. The interface respects the founder's communication preference (English) while serving the platform's customer base (Chinese-speaking Taiwanese SMBs). Labels switch via the `lang` state in the sidebar; data fields use `name_zh`/`name_en` conventions.

This is invisible when working — which is the point. The interface feels native to Taiwan without alienating non-Chinese-speaking collaborators or evaluators.

---

## What's incomplete or rough

Named honestly. Most items here are being addressed in the current sprint per `docs/ia-redesign.md`; some are tracked as deferred work in `docs/known-gaps.md`.

### Information architecture and navigation (in active work)

The product was built feature-by-feature; the navigation grew incrementally rather than being designed against user roles and jobs. Specific issues being addressed in this sprint:

- **Home page disorganization** — four distinct information regions (attendance banner, greeting, stat cards, action shortcuts) with no clear hierarchy. Mixes admin metrics with employee actions in one page.
- **Sidebar mixing audiences** — the 人資 section groups admin-of-others functions with employee-self-service functions.
- **Hero features buried** — 合規 and ESG 報告, the strongest features, are positioned as the rightmost tabs in an 8-tab admin dashboard strip (the position of least visual weight).
- **Role-based UI inconsistencies** — AI 助手 was missing the `adminOnly` flag in sidebar code despite the page being explicitly admin-only.
- **Broken navigation links** — at least one home page "今日重點" card links to the wrong destination (Wallchart instead of expected target).
- **Orphaned references** — 我的薪資單 referenced from the home page but not surfaced in primary navigation.

Sprint deliverables (Phase A through Phase D) address each. See `docs/ia-redesign.md` for the full spec.

### 知識圖譜 lacks a clear customer job

The Knowledge Graph page (`/ai-graph`) renders a force-directed visualization of document relationships using React Flow. It works technically — 8 documents, 16 relationships, color-coded by category. But it was built for technical interest, not to serve an identified customer job. Deferred from primary navigation per Q2 of `docs/ia-redesign.md`. Code remains in the repository; promotion to navigation requires future feature work (e.g., topic clustering for policy gap detection, or similarity scoring for duplicate document detection) driven by actual customer demand.

### Payroll precision deferred

The current `profiles` table represents salary as `salary_base` plus a single `attendance_bonus_monthly` field. Real Taiwanese payroll typically separates 5+ components (本薪, 伙食津貼, 職務加給, 全勤獎金, 交通津貼) each with distinct tax treatment. The current shape works for the pilot target segment (HR/compliance use case) but not for customers wanting Atlas EIP as their primary payroll engine.

This is documented as gap **M1** in `docs/known-gaps.md`, alongside related gaps **M2** (no salary effective-date history) and **M3** (no mid-month proration rules). All three are multi-week features. None blocks the current pilot segment.

### Empty-data UX issues

Several pages have correct structure but UX problems with empty or sparse data:

- **指標數據 default time window** — defaults to 30 days; with sparse early-pilot usage, this window shows zeros while a 90-day view shows real data. Easy fix in Phase D: change default or implement smart-default logic.
- **出勤總表 default month** — defaults to the current month; for new pilots with no current-month data, the wallchart appears empty. Should auto-navigate to the most recent month with data.
- **薪資計算 empty history** — structurally complete page; history is empty until pilots run actual payroll cycles. Not a fix item — resolves naturally with usage.

### Cosmetic and minor issues

- **"vv1.0" typo** on document detail page (should be "v1.0"). One-line fix in Phase D.
- **/team vs. /teams naming collision** — singular and plural routes serve different purposes (members vs. groups). Confusing. Per `docs/ia-redesign.md`, relabeled in the new sidebar.
- **Inconsistent button visual weight** on document detail page (Edit / Delete / Export have different visual grammars). Polish item.
- **AdminDashboard.tsx is ~6,874 lines** — works, but a maintenance concern. Not Phase B/C/D scope; tracked for future refactor consideration.

---

## Customer segment & go-to-market

### Current target segment

**Profile:** Taiwanese SMBs in the 20-100 person range, currently running HR via informal channels. Decision-maker is usually the owner, general manager, or operations lead — not dedicated HR staff (companies this size often lack a full-time HR function).

**Pain points the current product addresses:**
- Risk of LSA non-compliance during labor inspections (勞動檢查)
- Difficulty producing ESG reports as supply chain partners request them
- Knowledge fragmentation (policies in PDFs, emails, chat threads)
- Manual leave/overtime tracking via Excel or LINE messages
- Onboarding ramp-up time for new employees

**Pain points the current product does not yet address:**
- Multi-component salary precision (M1)
- Historical salary tracking for audit purposes (M2)
- Mid-month proration for new hires or salary changes (M3)
- Time clock hardware integration
- Multi-location attendance with location-specific policies

The first set drives current demand. The second set will matter for the secondary target segment but does not block initial pilots.

### Path to first paying customers

The identified highest-leverage paths to first paying customers, in order of expected effectiveness:

1. **Warm network introductions** — direct outreach to SMB owners and general managers in the founder's personal network. Bypasses cold sales overhead and starts conversations with decision-makers.
2. **勞資顧問 (labor consultant) partnerships** — Taiwan labor consultants advise SMBs on LSA compliance. They have direct relationships with the target customer segment and earn trust through expertise. A partnership where consultants recommend Atlas EIP to their clients (or use it themselves) provides credibility and distribution.
3. **Grant-funded pilots** — the 商業發展署 grant track provides validation and funding for early-stage product development with named pilot companies.

The product is not yet at the stage of paid customer acquisition through performance marketing or sales team buildup. Those channels are appropriate after pilot validation.

### Why this segment, why now

The 20-100 person SMB segment in Taiwan has historically been underserved by HR technology. Larger companies use established platforms; smaller companies make do with informal processes. The segment in between has growing compliance pressure (LSA enforcement, ESG disclosure expectations) without matching tools.

AI-native architecture changes the cost structure. A platform that auto-parses requests, auto-summarizes documents, and auto-generates compliance reports can deliver enterprise-tier capability at SMB-tier operational cost. The current generation of LLM capability makes this feasible in 2026 in ways it was not feasible in 2020.

---

## Technical stack & architecture

Brief reference. Not a deep dive — see code directly for implementation details.

### Stack

- **Application framework:** Next.js 14 (App Router)
- **Authentication:** Clerk (SSO, organization management, role assignment)
- **Database:** Supabase Pro, Tokyo region (`ap-northeast-1`), production URL `nquvkqhgufbfmalmixek.supabase.co`
- **Hosting:** Vercel
- **AI:** OpenAI (GPT-4o for complex tasks, GPT-4o-mini for lightweight tasks)
- **Validation:** Zod 3.22+
- **Testing:** Vitest
- **Email:** Resend (`hello@primestrideatlas.com`)
- **Frontend libraries:** React, TailwindCSS, Lucide icons, React Flow (knowledge graph)
- **Planned payment integration:** ECPay (綠界) — supports Taiwan-specific payment methods, recurring billing, ATM, LINE Pay, and e-invoice compliance.

### Architectural conventions

- **Service-role Supabase client on all server routes** — Clerk is the identity source of truth; `auth.uid()` does not populate RLS policies from Clerk sessions, so service-role access with explicit authorization checks is the pattern.
- **CJK characters avoided in source code comments** — encoding corruption has occurred historically. CJK is acceptable in markdown documentation files (this document uses CJK throughout) and in user-facing UI strings.
- **Variable-version migrations** — migration files in `supabase/migrations/` use date-time-sequence naming (e.g., `20260501000001_pay_basis_and_statutory_minimums.sql`). Migration filenames are referenced in error messages and tests as breadcrumbs.
- **Reference-table-driven business logic** — date-versioned reference tables like `statutory_minimums` are read at validation time rather than hardcoded as CHECK constraints. This allows regulatory updates without schema migrations.

### Repository

- **Path:** `~/primestride-kms`
- **Main branch:** `main`
- **Production URL:** `primestrideatlas.com`
- **Last commit at this document's writing:** `2011b36` (docs: known-gaps document for Phase 3k wage validation)

---

## Roadmap snapshot

Where the product is in its trajectory. Not a comprehensive roadmap — a snapshot of recent and immediate-future work.

### Recently completed (April-May 2026)

- **Phase 3i** — Attendance/clock-in infrastructure (10+ API endpoints, 3 pages, 2 cron jobs). Production-deployed.
- **Phase 3j** — Payroll hardening: Zod schema validation, bracket-aware smart defaults, comprehensive tests.
- **Phase 3k** — Wage-floor validation correctness across three layers (DB migration `ae180b0`, Zod schema `65884ae`, handler logic `967f142`). Known-gaps document committed (`2011b36`).

### Current sprint (May-June 2026)

**Information architecture restructure** — four phases:

- **Phase A** — Audit and design: this document plus `docs/ia-redesign.md`, plus codebase architecture verification and click-test of the demo path.
- **Phase B** — Sidebar implementation: restructure `src/components/Sidebar.tsx` per `docs/ia-redesign.md`, including new section groupings, role-based filtering corrections (AI 助手 admin-only, 知識圖譜 deferred from nav), and surfacing of 合規 + ESG 報告 + 我的薪資 as top-level items.
- **Phase C** — Home page rebuild and 待辦 page: full home page redesign per role, new 待辦 page aggregating pending items, fix of broken 今日重點 → Wallchart link.
- **Phase D** — Polish + Layer 4 + minor fixes: Layer 4 (pay_basis dropdown + validation surfacing in employee edit form), "vv1.0" typo fix, 指標數據 default-window adjustment, 學習分析 rename consideration, 出勤總表 default-month behavior.

### Subsequent work (after this sprint)

Driven primarily by pilot customer feedback. Possible tracks:

- **Phase 3h-equivalent** — Overtime rate calculator implementing LSA Article 24 multipliers (1.34x / 1.67x / 2.0x / rest-day differentials).
- **Pay slip export** — basic PDF/CSV export per employee per pay period.
- **Compliance Scanner extension** — extend scanning to flag payroll data violations in addition to document violations.
- **Payment flow integration** — ECPay/綠界 setup for paid pilot conversion.
- **Schema-factory refactor** — closes gap G1 from `known-gaps.md` (hourly floor enforcement), eliminates `BASIC_MONTHLY_WAGE_DUPLICATED_FROM_DB` dual-source problem.
- **Model-level gap closures** — M1 (multi-component salary), M2 (effective-date history), M3 (mid-month proration). Multi-week each. Deferred until customer demand surfaces.

### Operational hygiene (tracked, not scheduled)

- **Migration drift** — 43 tables in production, 4 in `supabase/migrations/`. Working state is correct but the migration files do not represent the full schema history. Track for future remediation.
- **RLS audit on profiles** — `rls_enabled = true` with zero policies; effectively locked down by default. Explicit SELECT policies needed if client-side queries become necessary.
- **`/api/subscription` POST owner-only restriction** — currently missing. Security gap unrelated to wage-validation; tracked separately.

---

## Cross-references

- **`docs/known-gaps.md`** — Wage-validation gaps surfaced during Phase 3k. Schema-level gaps (G1-G4) and model-level gaps (M1-M3). Convention for closing and discovering gaps.
- **`docs/ia-redesign.md`** — Information architecture redesign spec. Sidebar restructure, home page rebuild plan, 待辦 page specification. The implementation guide for Phase B, C, and D of the current sprint.

---

## Document maintenance

This document should be updated when:

1. A new module ships or an existing module's status changes materially
2. The target customer segment shifts (e.g., expanding to a new size range)
3. A roadmap item completes (move from "current sprint" to "recently completed")
4. New cross-reference documents are created

The document is intended to remain accurate as a snapshot of product state. It is not a marketing document and should not be edited to make the product appear more complete than it is. The same honesty discipline as `known-gaps.md` applies.

When in doubt, name what is incomplete rather than hide it. Future readers — including future versions of the founder — are better served by accurate snapshots than by aspirational ones.

