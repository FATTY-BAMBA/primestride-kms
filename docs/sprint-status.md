# Atlas EIP IA Restructure Sprint — Status

**Last updated:** 2026-05-23, end of Day 1
**Current HEAD:** `7b3cd42` — Phase C.1 route stubs and redirects
**Branch:** main, in sync with origin

This document tracks the state of the IA restructure sprint and serves as the entry point for future sessions. It's updated at the end of each working session.

---

## What's done

### Phase A — Audit & design (complete)
- `docs/product-state.md` (421 lines) — product snapshot, 16 modules inventoried, GTM context
- `docs/ia-redesign.md` (924 lines) — full implementation specification with code-ready link arrays
- Click-test of all 15 sidebar items + 8 admin tabs + selected interactive elements

### Phase B Step B.1 — adminOnly flag fixes (complete)
**Commit:** `ac72154` — `fix(sidebar): add adminOnly flags to admin-only sidebar items`
- Three sidebar items got `adminOnly: true` flags: AI 助手, 知識圖譜, 指標數據
- adminOnly count: 3 → 6 after this commit
- Isolated correctness commit, no IA structure changes

### Phase B Step B.2 — sidebar IA restructure (complete, deployed)
**Commit:** `39ab2f8` — `feat(sidebar): IA restructure - 6 sections per Phase B spec`
- Replaced 4-section sidebar (主要功能/人資/分析/管理) with 6 sections
- New structure: 首頁 (alone) | 我的工作 | 知識 | 管理 (admin) | 分析 (admin) | 設定 (admin)
- Hero features promoted: 合規, ESG 報告 now top-level sidebar items in 管理
- AI 助手 moved to 管理 section (admin-only)
- 知識圖譜 removed from sidebar entirely (route still works)
- Icons added: Scale (合規), Leaf (ESG); removed unused: FolderKanban, Share2
- adminOnly count: 6 → 14 after this commit
- Diff: +53 / -29 in src/components/Sidebar.tsx

### Phase C Step C.1 — route stubs + redirects (complete, deployed)
**Commit:** `7b3cd42` — `feat(routes): Phase C.1 - route stubs and redirects for new sidebar items`
- 6 new files: 1 shared component + 5 page stubs
- `/my-pay` and `/todo` — ComingSoonPage stubs (bilingual coming-soon card)
- `/admin/attendance` → redirects to `/admin?tab=wallchart`
- `/admin/compliance` → redirects to `/admin?tab=compliance`
- `/admin/esg` → redirects to `/admin?tab=esg`
- New shared component: `src/components/ComingSoonPage.tsx`
- Tab values verified against AdminDashboard tab union type

---

## Known issues from production verification

Tested live at primestrideatlas.com end of session. Numbered by priority for Phase D triage.

### HIGH priority (blocks promised UX)

**1. localStorage tab override on admin sub-routes**
- File: `src/components/AdminDashboard.tsx:2009` uses `useLocalStorage` for tab state
- Bug: URL `?tab=` parameter gets overridden by stored localStorage value on hydration
- Affects all three redirects (`/admin/attendance`, `/admin/compliance`, `/admin/esg`)
- Concrete example: user clicks 合規 → URL becomes `?tab=compliance` → page shows whatever tab was last visited
- Pre-existing bug, affected old sidebar too but wasn't visible because old sidebar didn't promote these items
- Fix approach: read `useSearchParams` first, fall back to localStorage second

**2. Sidebar active state on admin sub-routes**
- File: `src/components/Sidebar.tsx` `isActive` function around line 115-118
- Bug: clicking 合規 / ESG / 出勤 in sidebar lands on `/admin?tab=...` → sidebar highlights 概覽 instead of the clicked item
- `isActive` logic doesn't consider query string
- Fix: update `isActive` to match query params for admin sub-items

### MEDIUM priority (cosmetic / polish)

**3. OrgSwitcher "Loading..." race condition**
- Org switcher at sidebar bottom occasionally shows "Loading..." instead of "PrimeStride AI"
- `/api/branding` response handling needs proper loading state

**4. /team and /teams use dark theme**
- Inconsistent with light-themed rest of product
- Check `AppShell.tsx` theme logic or page-level overrides

**5. /clock/manual default date is yesterday**
- Should default to today

**6. /metrics default 30-day window shows 0s**
- Change default to 90 days OR implement smart-default (smallest window with non-zero data)

**7. /teams page has cramped header layout**
- "← 返回文件庫" and "+ 新增群組" buttons rendered as cramped vertical text
- Narrow container issue

### LOW priority (typos / data hygiene)

**8. Typo: "Company Adminstration"** in Admin group description
- Should be "Administration"

**9. Duplicate employee records**
- "abdoulie fatty" (afatty13@gmail.com) and "Abdoulie Fatty" (primestrideai@gmail.com) — same person, two records
- Data cleanup item, not navigation

**10. Document detail page has "vv1.0" typo**
- Should be "v1.0"

---

## Next session — recommended order

### Option 1 (recommended): Phase D quick wins first

Fix issues 1 and 2 because they undermine the value of B.2 + C.1. Estimated 30-60 minutes total.

**Step D.1: Fix localStorage tab override**
- Read `AdminDashboard.tsx` lines 2000-2050 (tab state initialization)
- Modify the `useLocalStorage` hook OR add a `useSearchParams` check before it
- Verify: clicking 合規 / ESG / 出勤 in sidebar lands on the correct tab consistently

**Step D.2: Fix sidebar active state for admin sub-routes**
- Read `Sidebar.tsx` `isActive` function
- Add logic to check `useSearchParams` query string for items with `?tab=` in their href
- Verify: clicking 合規 highlights 合規 in sidebar, not 概覽

After D.1 and D.2, the 3 redirects work correctly end-to-end (URL → correct tab → correct sidebar highlight). This completes the promised UX of B.2 + C.1.

### Option 2: Phase C proper (real builds)

Skip Phase D fixes, build new features per `ia-redesign.md`.

**Step C.2: Build 待辦 page** (~3 days per spec)
- Replace the ComingSoonPage stub at `/todo`
- Build `TodoSection` + `TodoItemRow` components
- Compose `/api/workflows?status=pending` + `/api/clock/manual/pending` endpoints
- Admin variant + employee variant per spec

**Step C.3: Rebuild home page** (~3 days)
- Edit `src/app/home/DashboardPage.tsx`
- Admin variant: greeting + attention banner + stats + activity feed
- Employee variant: greeting + my pending + leave balances + quick actions
- Remove broken 今日重點 panel
- Per spec in `ia-redesign.md`

### Option 3: Pause sprint, focus on customers / pilots / grant

Natural rest point. The new IA is shipped, the 404 gap is closed, and Phase D fixes can wait until pilot users report specific issues. If priorities shift, this is a clean place to step away from code.

---

## Recommendation

**Start with Step D.1 (localStorage fix). Then re-evaluate.**

The localStorage bug undermines the value of B.2 + C.1. We promoted 合規 and ESG 報告 to top-level items specifically to make them prominent and accessible — but the override means clicking them doesn't reliably show the right content. That single fix completes the promised UX of the sprint so far.

After D.1, decide between:
- Continuing Phase D polish (D.2 onward)
- Switching to Phase C.2 (real 待辦 build)
- Stepping away from the sprint

---

## Files / paths reference

| Path | Purpose |
|---|---|
| `~/primestride-kms` | Repo root |
| `src/components/Sidebar.tsx` | Main sidebar (376 lines after B.2) |
| `src/components/AdminDashboard.tsx` | Admin dashboard (6,874 lines; has localStorage bug) |
| `src/components/AppShell.tsx` | Sidebar gate, dark theme handling for /clock |
| `src/components/ComingSoonPage.tsx` | Stub component (Phase C.1) |
| `src/app/my-pay/page.tsx` | Stub page (Phase C.1) |
| `src/app/todo/page.tsx` | Stub page (Phase C.1) |
| `src/app/admin/attendance/page.tsx` | Redirect page (Phase C.1) |
| `src/app/admin/compliance/page.tsx` | Redirect page (Phase C.1) |
| `src/app/admin/esg/page.tsx` | Redirect page (Phase C.1) |
| `docs/product-state.md` | Product snapshot |
| `docs/ia-redesign.md` | IA implementation spec |
| `docs/known-gaps.md` | Phase 3k wage validation gaps |
| `docs/sprint-status.md` | This file |

## Commit history (relevant range)

```
7b3cd42 feat(routes): Phase C.1 - route stubs and redirects for new sidebar items
39ab2f8 feat(sidebar): IA restructure - 6 sections per Phase B spec
ac72154 fix(sidebar): add adminOnly flags to admin-only sidebar items
9cd95cc docs: Phase A deliverables - product state + IA redesign spec
2011b36 docs: known-gaps document for Phase 3k wage validation
967f142 feat(api): Phase 3k - handler fetch-and-merge for partial PATCHes
65884ae feat(schema): Phase 3k - pay_basis-aware wage validation in EmployeeUpdateSchema
ae180b0 feat(db): Phase 3k.1 - pay_basis column + statutory_minimums table
```

---

## Document maintenance

Update this file at:
1. End of each working session — what got done, what's deferred
2. When a known issue is fixed — move it from "Known issues" to a "Resolved" subsection or remove
3. When phases complete — update the "What's done" section
4. When the recommended next steps change due to priority shifts

Future sessions should read this file first to orient on current sprint state.
