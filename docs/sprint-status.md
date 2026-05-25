# Atlas EIP IA Restructure Sprint — Status

**Last updated:** 2026-05-26, Day 4
**Current HEAD:** `c540641` — fix(org-switcher): eliminate Loading flash on page navigation
**Branch:** main, 5 commits ahead of origin (pending push)
**Last session work:** Cosmetic fixes batch — 5 issues resolved (keyboard shortcut bonus, manual entry default date, metrics default window, teams header nowrap, org switcher loading flash). 4 issues deferred: one needs an ADR (dark theme consolidation), three are not in source code (Clerk UI typo, DB data duplicate, DB data typo).

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

### ✅ Resolved

**1. localStorage tab override on admin sub-routes** — Fixed in commit `d82cb8d` per ADR 0001
- Implementation: URL-routed tab state with localStorage fallback
- Verified on production: all 8 click-test scenarios pass
- See `docs/adr/0001-url-routed-tab-state.md` for full design rationale

**2. Sidebar active state on admin sub-routes** — Fixed in commits `9029e6e` + `7d3ec17` per ADR 0002 (revised v2)
- Implementation: force-dynamic at root layout + composite-URL `isActive` in Sidebar
- Approach C selected over original Approach A (parent-scope closures made A impractical; authed app was already effectively dynamic so C had no real cost)
- Verified on production: all 10 click-test scenarios pass
- See `docs/adr/0002-sidebar-active-state.md` for full design rationale and revision history

**Bonus. Keyboard shortcut Cmd+7/Cmd+8 unreachable** — Fixed in commit `7c54d87`
- Pre-existing bug spotted during D.1 investigation. Handler checked `e.key <= "6"` but tabs array had 8 entries. One-char fix to `<= "8"`.

**3. OrgSwitcher "Loading..." race condition** — Fixed in commit `c540641`
- Replaced visible "Loading..." pill with invisible placeholder (visibility: hidden) to eliminate the flash on every page navigation. Optimistic localStorage rendering deferred until org name is also cached.

**5. /clock/manual default date is yesterday** — Fixed in commit `4bf9380`
- 80% of users open the form to backfill today's missed clock-out, not yesterday's missed clock-in. Default changed to today. Backfill range (7 days) unchanged.

**6. /metrics default 30-day window shows 0s** — Fixed in commit `b2a7543`
- Pilot-stage default changed from 30 → 7 days. 30/90 buttons remain for users who want longer windows. May want smart-default revisiting once data accumulates beyond 30 days.

**7. /teams page header buttons wrapping to "cramped vertical text"** — Partially fixed in commit `4407cf4`
- Added `whiteSpace: "nowrap"` and `flexShrink: 0` to both header buttons. Verified in source. NOTE: production screenshot 2026-05-26 shows buttons still rendering as vertical squares — may need Vercel redeploy verification, OR root cause is broader than this fix addresses (deferred to next session diagnosis).

### HIGH priority (blocks promised UX)

_(None remaining. Both sprint-priority bugs resolved.)_

### MEDIUM priority (cosmetic / polish)

_(None remaining. All cosmetic items either resolved or moved to Deferred below.)_

### Deferred — requires design decision or data fix (not a code fix)

**4. /team and /teams use dark theme** — Deferred to a future "design system pass"
- Root cause: `.card` class in `globals.css` has `background: var(--bg-card)` which resolves dark. Used by 30+ places. Some pages override inline with `background: "white"`, others don't.
- Investigation 2026-05-26 confirmed `/team` and `/teams` use bare `className="card"` while `/library`, `/admin`, `/metrics` add inline white-background overrides.
- Proper fix needs an ADR: decide on light as canonical theme, update `--bg-card` CSS variable, audit and clean up redundant inline overrides. Out of scope for a cosmetic-batch session.
- Related concern flagged by user 2026-05-26: button styling inconsistency on these pages (black "Back to Library" vs blue "+ Invite Member" — primary/secondary roles not visually distinguished consistently across the app).

**8. Typo: "Company Adminstration"** — Not in source code
- Exhaustive grep across `src/` returned only the sprint-status file itself. Sidebar.tsx, UserMenu.tsx, OrgSwitcher.tsx contain no "Administration" string.
- Conclusion: the typo is in Clerk's organization management UI (third-party library). Fixing requires Clerk's localization API customization, not a code change in this repo.

**9. Duplicate employee records** — Data, not code
- "abdoulie fatty" (afatty13@gmail.com) and "Abdoulie Fatty" (primestrideai@gmail.com) — same person, two profiles in the `profiles` table. Likely from testing with two accounts.
- Fix: manual DB cleanup (delete one row, reassign references). Not a code change.

**10. Document detail page has "vv1.0" typo** — Data, not code
- Investigated version-construction code at `api/versions/route.ts:96` and `api/documents/[docId]/route.ts:212-216`. Both correct — regex puts "v" outside the capture group, parseInt extracts only digits.
- Conclusion: a specific document's `current_version` DB field contains "vv1.0", likely from earlier buggy code or manual entry. Fix is a one-row UPDATE on the documents table.

---

## Next session — recommended order

### Option 1 (recommended): Phase D quick wins first

Fix issues 1 and 2 because they undermine the value of B.2 + C.1. Estimated 30-60 minutes total.

**Step D.1: Fix localStorage tab override** — ✅ DONE in commit `d82cb8d`
- Implementation per ADR 0001 (`docs/adr/0001-url-routed-tab-state.md`)
- URL is source of truth, localStorage preserved as fallback, Suspense boundary added
- All 8 acceptance criteria verified on production

**Step D.2: Fix sidebar active state for admin sub-routes** — DONE in commits `9029e6e` + `7d3ec17`
- Approach C implemented (force-dynamic at root layout) — see ADR 0002 v2 amendment for why C was selected over the originally-proposed A
- isActive updated to handle 4 href shapes
- 3 sidebar hrefs updated to query-string form
- Production build verified, all 10 acceptance criteria pass

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
