# Atlas EIP — Information Architecture Redesign

**Status:** Design specification for the IA restructure sprint (Phases A-D).
**Companion to:** `docs/product-state.md` (what Atlas EIP is) and `docs/known-gaps.md` (wage-validation gaps).
**Scope:** Specifies the navigation, sidebar, home page, and new pages to be built during the current sprint. Implementation guide for Phases B, C, and D.

---

## Status & scope

### What this document is

A code-specification document. It captures the IA design decisions made during Phase A (audit phase) and specifies the target state that Phases B, C, and D will implement. The level of detail is intentional: any future Claude session, or any future collaborator, should be able to read this document and implement correctly without needing to reconstruct the design rationale.

### What this document is not

- **Not a product roadmap.** Roadmap-level context lives in `docs/product-state.md` under "Roadmap snapshot."
- **Not a visual design specification.** Visual treatments (specific colors, exact spacing, animation timing) are determined during implementation, drawing on the existing design system (purple primary, slate text, Lucide icons, bilingual labels). This document specifies structure, hierarchy, and content — not pixels.
- **Not a backend specification.** Where new API endpoints are needed, this document names them and describes their shape. Detailed implementation lives in handler files.

### Sprint context

The sprint is structured in four phases. This document is the output of Phase A and the input to Phases B, C, and D.

| Phase | Days | Focus | Primary deliverable |
|---|---|---|---|
| **A** | 2-3 | Audit & design | `docs/product-state.md` + this document + click-test of demo path |
| **B** | 3-5 | Sidebar implementation | New `src/components/Sidebar.tsx` per this spec |
| **C** | 3-5 | Home page reset + 待辦 page | Rebuilt home page + new `/todo` page + fixed broken links |
| **D** | 3-5 | Polish + Layer 4 + minor fixes | Pay basis dropdown, validation surfacing, cosmetic fixes |

Total: 11-18 days across 2-3 weeks. Phase D items may compress if Phase B or C surface complications.

### Discipline carried from Phase 3k

The same patterns that made Phase 3k correct apply here:

- **Read before write.** Examine existing code in detail before specifying changes.
- **Layer by layer.** Each implementation layer verified before the next begins.
- **Design before code.** This document precedes any sidebar code edits.
- **Honest framing.** Name what is deferred or unresolved rather than hiding it.

---

## Design decisions summary

Six design questions were decided during Phase A. Each is recorded here with one-line rationale and a reference to its expanded treatment later in the document.

| Q | Decision | One-line rationale | Expanded in |
|---|---|---|---|
| **Q1** | Merge 出勤審核 + 出勤總表 into one 出勤 page with internal tabs | Mature HR products (Gusto, BambooHR, Apollo) consolidate attendance into a single feature; the cognitive mode split belongs inside the page, not between nav items | Target state — sidebar |
| **Q2** | Hide 知識圖譜 from primary nav; access via document detail | The page was built for technical interest, not a customer job; promoting it without a clear job would mislead users | Target state — sidebar; Out of scope |
| **Q3** | Keep 待辦 page in scope (build new page) | Infrastructure partial; a unified pending-items view materially improves the home/sidebar coherence | Target state — 待辦 page |
| **Q4** | Promote 合規 + ESG 報告 to top-level sidebar items | Hero features currently buried at the right end of an 8-tab admin strip (position of least visual weight) | Target state — sidebar; Migration path |
| **Q5** | 管理 section has 9 items (resolves automatically from Q4) | Acceptable density given they are genuinely related admin items; visual sub-grouping addresses density | Target state — sidebar |
| **Q6** | AI 助手 lives in 管理 section, grouped by who uses it | Group by user (admin) rather than by job-type (knowledge work); keeps role-based section clean | Target state — sidebar |

Additional decisions made during Phase A but not in the original six-question framework:

- **Fix AI 助手 missing `adminOnly: true` flag** — current code bug; employees see admin-only feature in their sidebar. Fixed in Phase B.
- **Add `adminOnly: true` to 學習分析, 指標數據, 知識圖譜** — these are all admin-tier features incorrectly flagged. Fixed in Phase B.
- **Create new Settings section** — API access, audit logs, and branding move out of 管理 into a dedicated Settings group accessible via gear icon.
- **Promote 我的薪資 (referenced from home but not in sidebar) into 我的工作 section** — closes an orphaned reference.
- **Org switcher position** — deferred to Phase B implementation. Current bottom placement may move to top for prominence; decided during implementation based on visual balance.

---

## Current state (as of `2011b36`)

The current navigation and role-based UI architecture, verified by direct code reading during Phase A.

### Architecture summary

The product's authenticated layout is centralized in two files:

- **`src/app/layout.tsx`** (34 lines) — root layout. Wraps children in `ClerkProvider`, `AuthProvider`, and `AppShell`. Minimal, clean, no changes needed.
- **`src/components/AppShell.tsx`** (46 lines) — decides whether to show the sidebar based on the current pathname. Manages dark theme attribute for `/clock` pages. Delegates all sidebar logic to `Sidebar`. No role-based logic of its own.
- **`src/components/Sidebar.tsx`** (352 lines) — the actual sidebar. Centralizes role state via a single `useState` boolean, fed by one API call to `/api/profile`. Link items are typed with an optional `adminOnly?: boolean` flag. The `NavLink` render function applies the filter (`if (link.adminOnly && !isAdmin) return null`).

**Verdict on current architecture:** The code is well-structured. The IA restructure is primarily a content change (which items go in which sections, with what flags) rather than an architectural change. The existing `LinkItem` interface, `NavLink` component, and `SidebarContent` composition all support the new design without restructuring.

### Current sidebar structure

```
[Atlas EIP logo + "Enterprise Intelligence" tagline]

主要功能 (Main):
  /home          首頁              everyone
  /library       文件庫            everyone
  /agent         AI 助手           everyone (BUG: should be admin-only)
  /search        搜尋              everyone

人資 (HR):
  /workflows                表單申請        everyone (with pending-count badge)
  /clock/manual            我的打卡        everyone
  /admin?tab=attendance    出勤審核        admin
  /admin/payroll            薪資計算        admin

分析 (Analytics):
  /learning      學習分析          admin
  /ai-graph      知識圖譜          everyone (incorrect)
  /metrics       指標數據          everyone (incorrect)

管理 (Admin) — admin-only section:
  /admin         管理              admin
  /team          成員              admin
  /teams         群組              admin
  /developer     API               admin
  /audit-logs    操作紀錄          admin
  /branding      品牌設定          admin

[OrgSwitcher]
[UserMenu]
```

### Known issues in current state

The following issues were identified during Phase A and are addressed by this redesign. Each is noted with its target resolution.

**Navigation bugs:**

1. **AI 助手 visible to employees despite being admin-only.** The page itself says "管理員專用" and tells employees to use 搜尋 instead. The `adminOnly: true` flag is missing in `mainLinks`. **Resolution:** add the flag in Phase B (also moves to `管理` section per Q6).
2. **知識圖譜 visible to employees.** No clear job for employees; visible only because the `adminOnly` flag isn't set. **Resolution:** remove from primary nav entirely per Q2 (access via document detail).
3. **指標數據 visible to employees.** Annotated as "可作為政府補助流量佐證" — clearly an admin/owner concern. **Resolution:** add `adminOnly: true` and move to `分析` (admin-only) per Q5.
4. **At least one 今日重點 home page card links to the wrong destination.** Specifically: one card lands on `/admin?tab=attendance` (the Wallchart) instead of its labeled destination. **Resolution:** click-test in Phase A identifies all broken links; Phase C rebuilds the home page with verified destinations.
5. **我的薪資單 referenced from home page but not in sidebar.** Orphaned reference. **Resolution:** Phase B adds `我的薪資` to the new `我的工作` section.

**Structural issues:**

6. **人資 section mixes audiences.** Two employee-facing items (`/workflows`, `/clock/manual`) and two admin-facing items (`/admin?tab=attendance`, `/admin/payroll`) in the same section. **Resolution:** split into `我的工作` (employee) and `管理` (admin) sections.
7. **Hero features buried as admin dashboard tabs.** `合規` and `ESG 報告` are positioned as the rightmost tabs in the `/admin` 8-tab strip — the position of least visual weight. **Resolution:** promote to top-level sidebar items in `管理` per Q4.
8. **Section/item name collision.** The `管理` section contains an item also named `管理` (`/admin`). **Resolution:** rename the item to `概覽` (Overview) in the new structure.
9. **`/team` vs. `/teams` naming collision.** Singular = members, plural = groups. Easy to confuse. **Resolution:** new sidebar uses clearer labels (`成員` / `群組`) and groups them adjacent in the `管理` section.
10. **API as a top-level nav item.** Used once during integration, not regularly. **Resolution:** moves to new Settings section.
11. **OrgSwitcher buried at bottom.** Multi-tenant context matters more as the founder's 股份有限公司 conversion progresses. **Resolution:** placement decided during Phase B implementation; candidate positions are top of sidebar (more prominent) or current bottom (current convention).

## Target state — sidebar

The complete specification for the new sidebar. Phase B implements this by editing `src/components/Sidebar.tsx`. The existing `LinkItem` interface, `NavLink` component, and `SidebarContent` composition are preserved; only the link array contents, section grouping, and a few small renders change.

### New sidebar structure

```
[Atlas EIP logo + "Enterprise Intelligence" tagline]
[OrgSwitcher — position TBD during Phase B implementation]

(no section header — minimal top group)
  首頁              Home              everyone

我的工作 (My Work) — everyone
  表單申請          Requests          everyone (with pending-count badge)
  我的打卡          My Clock-in       everyone
  我的薪資          My Pay            everyone (NEW — surfaces /我的薪資單)
  待辦              To-Do             everyone (NEW — page built in Phase C)

知識 (Knowledge) — everyone
  文件庫            Library           everyone
  搜尋              Ask Atlas         everyone

管理 (Manage) — admin-only section
  概覽              Overview          admin (renamed from 管理)
  員工              Employees         admin
  出勤              Attendance        admin (consolidates 出勤審核 + 出勤總表)
  薪資              Payroll           admin
  合規              Compliance        admin (PROMOTED from buried tab)
  ESG 報告          ESG Report        admin (PROMOTED from buried tab)
  AI 助手           Atlas Agent       admin (MOVED from 主要功能)
  群組              Groups            admin
  成員              Members           admin

分析 (Analytics) — admin-only section
  學習分析          Learning Insights admin
  指標數據          Platform Metrics  admin

設定 (Settings) — admin-only section, gear icon affordance
  API               Developer API     admin
  操作紀錄          Audit Logs        admin
  品牌設定          Branding          admin

[UserMenu — bottom of sidebar]
```

### Section-by-section rationale

#### 首頁 alone, no section header

The top of the sidebar is just `首頁` with no preceding section header. This is the smallest, simplest possible top — the user lands at the dashboard, which itself surfaces what needs attention.

The alternative considered was a "今日 / Today" section containing 首頁 + 待辦. Rejected for two reasons: (1) 待辦 belongs with other "my work" items conceptually, not separated from them; (2) a single-item section header adds visual noise for no information gain.

#### 我的工作 (My Work) — everyone

Groups all employee-self-service items. Each user — employee or admin — uses this section for *their own* work, not for managing others.

Contents:
- `表單申請` — submit requests (leave, OT, travel). Already in current sidebar; unchanged. Carries the existing pending-count badge for admins (number of requests awaiting their approval).
- `我的打卡` — manual clock-in. Already in current sidebar; unchanged.
- `我的薪資` — view my own payroll (NEW link). Closes the orphaned reference from the home page's 今日重點 panel. The destination page needs verification during Phase C — if `我的薪資單` exists as a route, link there; if not, scoped as a small Phase C task to build a basic "view my last payroll" page.
- `待辦` — unified pending-items view (NEW). Specified in detail under "Target state — 待辦 page" below.

**Why employees see this section even though admins have more pending items there:** Admins are users too. An admin filing their own leave request uses `表單申請` the same way an employee does. Mixing admin-of-others into this section (the current sidebar's mistake) confuses the user about what role they're operating in.

#### 知識 (Knowledge) — everyone

Groups the document and search tools. AI 助手 is NOT in this section (per Q6 — it's admin-only and lives in `管理`).

Contents:
- `文件庫` — knowledge library. Already in current sidebar; unchanged.
- `搜尋` — Ask Atlas (employee-facing AI search). Already in current sidebar; unchanged.

This is a small section (2 items), which is fine. Sections do not need to be balanced in size.

#### 管理 (Manage) — admin-only

The largest section at 9 items. Density justified because items are genuinely related admin work.

Visual treatment to address density (decided during Phase B implementation, not specified here): possible options include a subtle visual divider between item groups (e.g., people-focused items vs. compliance-focused items), or a one-character indent on the secondary items. Decided in code, not in this spec.

Contents in proposed display order:
- `概覽` (Overview) — `/admin` overview tab. Renamed from current `管理` to eliminate section/item name collision.
- `員工` (Employees) — `/admin?tab=employees`. Currently labeled `管理` in code (where the item label and section label both read `管理`); the rename is part of the IA cleanup.
- `出勤` (Attendance) — consolidates current `出勤審核` and `出勤總表` per Q1. New route `/admin/attendance` (Phase B creates), defaulting to `待審核` sub-tab if pending items exist, otherwise to `月曆` sub-tab. Internal tabs handle the cognitive mode distinction.
- `薪資` (Payroll) — `/admin/payroll`. Already in current sidebar; relocated from `人資` section.
- `合規` (Compliance) — promoted from `/admin?tab=compliance` to its own sidebar item. Phase B creates a route `/admin/compliance` (or directly links to the existing tab). The underlying component in `AdminDashboard.tsx` is not refactored; routing changes only.
- `ESG 報告` (ESG Report) — promoted from `/admin?tab=esg` similarly.
- `AI 助手` (Atlas Agent) — `/agent`. Moved from `主要功能` per Q6. The page already correctly identifies as admin-only; the sidebar listing now matches.
- `群組` (Groups) — `/teams`.
- `成員` (Members) — `/team`.

**On the `/team` vs `/teams` collision:** Labels are clear (`群組` for groups, `成員` for members), but the routes remain `/team` and `/teams` to avoid breaking changes. If route renaming is judged worth the risk during Phase B, document the migration. Otherwise, accept the route legacy.

#### 分析 (Analytics) — admin-only

Two items, both with proper `adminOnly: true` flags (fixing current code where these are incorrectly visible to employees).

Contents:
- `學習分析` (Learning Insights) — `/learning`. Note: the underlying page is document feedback analytics, not LMS/training analytics. Label reads acceptably in Chinese context; English `Learning Insights` slightly softens the LMS implication. Optional Phase D item: rename to `文件回饋` if a customer or pilot user reports confusion. For now, accept as-is.
- `指標數據` (Platform Metrics) — `/metrics`. Phase D fixes the default-window UX issue (currently defaults to 30 days, showing zeros for sparse early-pilot usage; change to 90 days or implement smart-default logic).

**知識圖譜 NOT in this section** (per Q2). The page is deferred from primary nav; access via document detail page only. Code remains in repository, route `/ai-graph` continues to work for anyone with the URL.

#### 設定 (Settings) — admin-only

New section. Currently these items live in scattered top-level sidebar positions; consolidating into a Settings group reflects their actual usage pattern (configured once, rarely revisited).

Contents:
- `API` (Developer API) — `/developer`. Moved from current `管理` section.
- `操作紀錄` (Audit Logs) — `/audit-logs`. Moved from current `管理` section.
- `品牌設定` (Branding) — `/branding`. Moved from current `管理` section.

**Visual treatment for Settings:** Considered using a gear icon affordance instead of a regular section. Decision deferred to Phase B implementation. If implemented as a collapsible / iconified section, it should still be visible in the default sidebar — not hidden behind a click. The collapsibility is for visual hierarchy, not for hiding items.

### Implementation reference — new link arrays

The actual TypeScript edits to `src/components/Sidebar.tsx`. Replace the existing arrays (`mainLinks`, `hrLinks`, `analyticsLinks`, `adminLinks`) with the following. Naming convention: section variable names match the new section labels.

```typescript
const topLinks: LinkItem[] = [
  { href: "/home", icon: Home, label: "首頁", labelEn: "Home" },
];

const myWorkLinks: LinkItem[] = [
  { href: "/workflows", icon: FileText, label: "表單申請", labelEn: "Requests", badge: true },
  { href: "/clock/manual", icon: ClipboardList, label: "我的打卡", labelEn: "My Clock-in" },
  { href: "/my-pay", icon: Wallet, label: "我的薪資", labelEn: "My Pay" },  // NEW route, verify or build in Phase C
  { href: "/todo", icon: ClipboardCheck, label: "待辦", labelEn: "To-Do" },  // NEW page built in Phase C
];

const knowledgeLinks: LinkItem[] = [
  { href: "/library", icon: Library, label: "文件庫", labelEn: "Library" },
  { href: "/search", icon: Search, label: "搜尋", labelEn: "Ask Atlas" },
];

const manageLinks: LinkItem[] = [
  { href: "/admin", icon: Settings, label: "概覽", labelEn: "Overview", adminOnly: true },
  { href: "/admin?tab=employees", icon: Users, label: "員工", labelEn: "Employees", adminOnly: true },
  { href: "/admin/attendance", icon: ClipboardCheck, label: "出勤", labelEn: "Attendance", adminOnly: true },
  { href: "/admin/payroll", icon: Wallet, label: "薪資", labelEn: "Payroll", adminOnly: true },
  { href: "/admin/compliance", icon: /* TBD - existing icon or new */, label: "合規", labelEn: "Compliance", adminOnly: true },
  { href: "/admin/esg", icon: /* TBD */, label: "ESG 報告", labelEn: "ESG Report", adminOnly: true },
  { href: "/agent", icon: Bot, label: "AI 助手", labelEn: "Atlas Agent", adminOnly: true },
  { href: "/teams", icon: UserCircle, label: "群組", labelEn: "Groups", adminOnly: true },
  { href: "/team", icon: Users, label: "成員", labelEn: "Members", adminOnly: true },
];

const analyticsLinks: LinkItem[] = [
  { href: "/learning", icon: BarChart3, label: "學習分析", labelEn: "Learning Insights", adminOnly: true },
  { href: "/metrics", icon: BarChart3, label: "指標數據", labelEn: "Platform Metrics", adminOnly: true },
];

const settingsLinks: LinkItem[] = [
  { href: "/developer", icon: Key, label: "API", labelEn: "Developer", adminOnly: true },
  { href: "/audit-logs", icon: Clock, label: "操作紀錄", labelEn: "Audit Logs", adminOnly: true },
  { href: "/branding", icon: Tag, label: "品牌設定", labelEn: "Branding", adminOnly: true },
];
```

**Notes for implementation:**

- Icon choices for `合規` and `ESG 報告` are TBD during Phase B; suggested candidates from Lucide are `Scale` (for compliance — scales of justice) and `Leaf` (for ESG — sustainability).
- The two `Users` icon assignments (used for both `員工` and `成員`) are noted; consider differentiating during Phase B.
- The duplicate `BarChart3` icon for `學習分析` and `指標數據` is current state; replace one with a more specific icon during Phase B if a clearer Lucide option exists.
- The `Share2` icon (currently used for `知識圖譜`) is freed since that item is removed from sidebar — available for reuse if a section needs it.

### Section render structure

The `SidebarContent` component renders sections. The new render order:

```tsx
<SidebarContent>
  {/* No section header for the top group */}
  {topLinks.map(link => <NavLink ... />)}

  <SectionHeader title={lang === "zh" ? "我的工作" : "MY WORK"} />
  {myWorkLinks.map(link => <NavLink ... />)}

  <SectionHeader title={lang === "zh" ? "知識" : "KNOWLEDGE"} />
  {knowledgeLinks.map(link => <NavLink ... />)}

  {isAdmin && (
    <>
      <SectionHeader title={lang === "zh" ? "管理" : "MANAGE"} />
      {manageLinks.map(link => <NavLink ... />)}

      <SectionHeader title={lang === "zh" ? "分析" : "ANALYTICS"} />
      {analyticsLinks.map(link => <NavLink ... />)}

      <SectionHeader title={lang === "zh" ? "設定" : "SETTINGS"} />
      {settingsLinks.map(link => <NavLink ... />)}
    </>
  )}
</SidebarContent>
```

## Target state — home page

The home page (`/home`) is rebuilt in Phase C. The current page mixes admin metrics with employee actions in a single layout, has no clear hierarchy, and contains at least one broken navigation link. The rebuild establishes a role-aware home page that serves each user's primary need at sign-in.

### Goals

The home page answers the user's first question when they sign in: **"What do I need to attend to today?"** Everything else (deep dives, settings, references) is reached via the sidebar.

A single home page renders content conditional on role. Implementation uses the same `isAdmin` state already fetched by the sidebar (via `/api/profile`), passed down or fetched independently in `DashboardPage.tsx`.

### Admin home page

When an admin signs in, the home page shows operational state and what needs admin attention.

**Section 1: Greeting + status header**

```
[Time-appropriate greeting], [Admin Name] 👋
[One-line org status — e.g., "PrimeStride AI · 4 employees · 100% LSA compliant this month"]
```

The greeting is dynamic by time-of-day (early morning, morning, afternoon, evening, late night). Already present in current home page — preserved.

The status line is new. Pulls from existing data:
- Employee count from `/api/team/members` or equivalent
- Compliance rate from the existing compliance scan results (if Phase D extension lands) or a static "compliance status: monitored" if not yet ready
- Org name from branding

**Section 2: Today's attention banner**

A single prominent banner that summarizes what the admin needs to act on. Composed from existing data sources:

```
今日需處理 · Items Needing Attention
  N 件待審核請假申請 · N pending leave requests
  N 件出勤補登審核 · N attendance entries pending review
  [Optional: N 件合規警示 · N compliance alerts — if applicable]

  [→ 查看待辦 button — links to /todo]
```

When all counts are zero: collapse to a single line "✅ 今日無待處理事項 · All caught up today" with no CTA.

This replaces the current "今日 4 人應到·0 在崗·0 遲到·4 未到" attendance banner, which is too narrow (attendance-only) and not actionable enough.

**Section 3: Quick stats — workforce snapshot**

Four stat cards in a row, similar to current home page but with sharper purpose:

```
[Total Employees]     [This Month Requests]   [OT Hours This Month]    [Compliance Status]
   4 人                    23 件                   15 小時                  100% LSA
```

Difference from current home page:
- Removes 文件數 stat (knowledge library count) — not first-priority admin metric
- Removes 待審核 stat — redundant with Section 2 banner
- Adds OT Hours and Compliance Status — both feed into ESG reporting and matter operationally
- Stat cards should be **less visually heavy** than current (smaller, denser) so they don't dominate the page

Each card is clickable. Clicking 員工 count opens `/admin?tab=employees`. Clicking compliance opens `/admin/compliance`. The home page becomes a navigation hub for the things admins check daily.

**Section 4: Recent activity feed**

A vertically-scrolling feed showing recent operational events:

```
最近活動 · Recent Activity
  · [2 mins ago] Abdoulie Fatty submitted overtime request — 2 hours · pending
  · [1 hour ago] Manual clock-in approved for Heng Chang — 09:30-18:00
  · [3 hours ago] Document uploaded: 加班管理辦法 v3.0
  · [yesterday] Compliance scan completed — 0 violations
  · [yesterday] ESG report exported for April 2026
  [→ 查看完整活動紀錄]
```

This replaces the current home page's "最近文件" panel. Activity feed is more useful than recent files because it surfaces *operational events*, not just static content.

Data sources for the activity feed:
- Workflow submissions (existing `/api/workflows` endpoint)
- Manual clock-in approvals (existing `/api/clock/manual/[id]/approve` history)
- Document uploads (from library)
- Compliance scan completions (from compliance module)
- ESG report exports (from ESG module)

The feed is a roll-up; clicking an item opens the relevant detail page. If the activity feed proves complex to assemble, an acceptable Phase C compromise is to start with workflow submissions only and expand later.

**Section 5: Quick links — what NOT to include**

The current 今日重點 panel has 4 navigation cards (用一句話提交申請, 詢問 Atlas 關於公司政策, 瀏覽知識庫, 上傳或匯入文件) and at least one of them links to the wrong destination.

The new home page **does not include this panel**. Reasoning:
- The sidebar already provides navigation to every feature
- "Quick links" panels duplicate sidebar function without adding value
- The broken-link bug was possible *because* this panel duplicates navigation in an under-tested location
- An admin's home page should be operational, not a navigation menu

### Employee home page

When an employee (non-admin) signs in, the home page shows their personal status and what needs their attention.

**Section 1: Greeting + personal status**

```
[Time-appropriate greeting], [Employee Name] 👋
[One-line personal status — e.g., "本月已申請 2 件 · 特休餘額 5 天" / "2 requests this month · 5 annual leave days remaining"]
```

**Section 2: My pending items**

```
我的待辦 · My To-Do
  N 件申請等待審核中 · N requests pending approval
  [N 件出勤補登等待審核中 · N clock-in submissions pending] (if any)

  [→ 查看待辦 button — links to /todo]
```

When all counts are zero: "✅ 沒有待處理的申請 · No pending submissions" without CTA.

**Section 3: My leave balances**

A compact table of leave types and remaining balance:

```
我的假期餘額 · My Leave Balances
  特休 Annual:        5 days remaining of 7
  病假 Sick:          14 days remaining of 30
  事假 Personal:      11 days remaining of 14
  家庭照顧 Family:    7 days remaining of 7
```

Data sources already exist (visible in the admin's 申請總覽 view of all employees). For the employee, filter to their own record.

**Section 4: Quick actions**

Three buttons for the most common employee actions:

```
[+ 提交申請 — Submit Request]    [+ 補登打卡 — Manual Clock-in]    [搜尋政策 — Search Policies]
```

Each links to the relevant page. This *is* a navigation panel for employees (unlike the admin version which deliberately omits one) because the employee's surface is small and direct shortcuts genuinely help them.

**Section 5: Recent personal activity**

```
我的最近活動 · My Recent Activity
  · [2 days ago] 特休 3 天 申請通過 · Annual leave 3 days approved
  · [5 days ago] 提交補登打卡 4/22 09:00-17:00 · Manual clock-in submitted
  · [1 week ago] 病假 1 天 申請通過 · Sick leave 1 day approved
```

Personal scope only — employee sees their own activity, not other employees' or org-wide events.

### Implementation reference

The home page is currently at `src/app/home/DashboardPage.tsx` (637 lines). Phase C rewrites or substantially edits this file. Key implementation notes:

- Use the existing `isAdmin` check (already fetched on the current home page at lines 91-92 via `/api/profile`).
- The existing `pendingCount` fetch (`/api/workflows?view=all&status=pending`) is reused for the admin attention banner.
- The activity feed needs a new aggregation endpoint or composition of existing endpoints — left to Phase C implementation to decide based on the simplest viable approach.
- Phase D considers further refinements (e.g., customizable widgets in the BambooHR style) but does not implement them.

## Target state — 待辦 page (NEW, Phase C)

A new page at `/todo` providing a unified view of pending items for the current user. Built in Phase C. The page is the click-through destination from the home page's "Today's attention" banner / "My To-Do" panel.

### Purpose

Atlas EIP currently scatters pending items across multiple pages: workflows have their own status filter, attendance approvals are in the admin dashboard, manual clock-in approvals are a separate tab. A user wanting to see "everything I need to attend to" must click between 3-5 different pages.

The 待辦 page aggregates these into a single view, scoped to the current user's role. It is a roll-up navigation hub — clicking an item opens its source page for the actual decision/action.

### Role-aware content

The page renders different content for admins vs. employees, but shares the same URL `/todo` and the same layout shell.

#### Admin view

An admin needs to see what's waiting for their approval or attention across all employees.

```
待辦 · To-Do
[Refresh button] [Last updated: 2 minutes ago]

待審核請假申請 · Pending Leave Requests (N)
  · [Abdoulie Fatty] 特休 3 天 · 5/20-5/22 · 探親 · submitted 2h ago     [Review →]
  · [Heng Chang] 病假 1 天 · 5/19 · 身體不舒服 · submitted 1d ago        [Review →]
  ... (or "✅ No pending leave requests")

待審核出勤補登 · Pending Attendance Entries (N)
  · [B M] 5/18 09:30-18:00 · 忘記打卡 · submitted 3h ago                  [Review →]
  ... (or "✅ No pending attendance entries")

待審核加班申請 · Pending Overtime Requests (N)
  · [Employee Name] 加班 2 小時 · 5/19 · 緊急修復 · submitted 1d ago    [Review →]
  ... (or "✅ No pending overtime requests")

待審核出差申請 · Pending Travel Requests (N)
  · [Employee Name] 出差 3 天 · 5/22-24 · 高雄拜訪客戶 · submitted 2d ago  [Review →]
  ... (or "✅ No pending travel requests")
```

If all sections show "no pending," the page collapses to a celebratory all-clear state:

```
🎉 全部審核完畢！
All caught up!
目前沒有需要您審核的項目。
[查看歷史紀錄 → · View History →]
```

This empty state mirrors the pattern from current `/admin?tab=approve-attendance` (visited during Phase A walkthrough) and `/admin?tab=approve-pending` — celebratory framing makes "nothing to do" feel like good news rather than a broken page.

#### Employee view

An employee needs to see what *they have submitted* that is still pending decision.

```
待辦 · To-Do
[Refresh button] [Last updated: 2 minutes ago]

我的待審核申請 · My Pending Requests (N)
  · 特休 3 天 · 5/20-5/22 · 探親 · submitted 2h ago · waiting for approval
  · 加班 2 小時 · 5/19 · 緊急修復 · submitted 1d ago · waiting for approval
  ... (or "✅ No pending requests")

我的待審核補登 · My Pending Clock-in Entries (N)
  · 5/18 09:30-18:00 · 忘記打卡 · submitted 3h ago · waiting for approval
  ... (or "✅ No pending clock-in entries")
```

If all sections show "no pending":

```
🎉 沒有待處理的申請
No pending submissions
[+ 提交新申請 → · Submit New Request →]
[+ 補登打卡 → · Manual Clock-in →]
```

The employee's empty state includes CTAs because it's productive empty (nothing waiting, ready to submit new things). The admin's empty state is restful empty (nothing to review, take a moment).

### API design

The 待辦 page composes existing endpoints rather than introducing a single aggregation endpoint. Existing endpoints already verified:

- **`GET /api/workflows?status=pending`** — pending workflow submissions (leave/OT/travel). Already used by sidebar for badge count and by current home page.
- **`GET /api/clock/manual/pending`** — pending manual clock-in entries. Already used by `/admin?tab=approve-attendance`.

These endpoints return role-aware data already. An admin's call returns submissions across all employees; an employee's call returns only their own. The 待辦 page makes these calls in parallel and renders the union.

**Optional: new aggregation endpoint.** If Phase C implementation finds that the parallel-fetch pattern produces noticeable lag or layout-shift, an aggregation endpoint `GET /api/todo` can be introduced. Initial implementation should attempt the parallel-fetch pattern first; aggregate only if needed.

**Optional: WebSocket / SSE for live updates.** Not required for initial implementation. The page can use the "Last updated: 2 minutes ago" indicator with manual refresh button. Real-time updates are a future enhancement if pilot users request it.

### UI layout structure

The page is one column, full width of the main content area, scrolling vertically. No sidebar within the page itself.

Section ordering:
- Admin view: sections ordered by typical operational urgency (leave > attendance > OT > travel). Each section header includes the count badge.
- Employee view: requests first, then clock-in entries.

Each item row contains:
- Identifier (employee name for admin view; request type for employee view)
- Brief context (type, dates, reason)
- Submission timestamp (relative — "2h ago", "1d ago", "3d ago")
- Action button (admin: "Review →" linking to source page; employee: status only, no action)

Item rows are clickable in entirety on mobile (full-row tap target) and have the explicit action button on desktop.

### Loading and empty states

**Loading state:** Show section headers immediately with skeleton placeholders for item rows. Progressive load — render each section as its API call returns. Total time-to-interactive should be under 1 second for typical pending counts.

**Empty section state:** If a single section has no pending items, show "✅ No pending [type]" in muted text rather than hiding the section. This makes it clear that the section was checked (not missing).

**All-empty state:** If all sections are empty, replace the entire page body with the celebratory all-clear state (admin) or the no-pending CTA state (employee) described above. Don't render empty sections.

**Error state:** If any API call fails, show that section with an error message and a retry button: "Could not load [section name]. Retry?". Don't fail the entire page if one section fails.

### Navigation behavior

Clicking the "Review →" button on an admin item opens the source page for that item type:
- Leave/OT/Travel requests → `/admin?tab=requests` (or wherever workflow approval lives) with the specific item highlighted/scrolled-to
- Attendance entries → `/admin/attendance` (the new consolidated page) on the 待審核 tab

The deep-link behavior (highlighting a specific item) is desired but not required for initial implementation. Phase C can ship with simple navigation to the section, with deep-linking as a follow-up if user feedback warrants.

### Component structure

The page does not require refactoring of `ApprovalQueueCard.tsx` (which is specific to manual clock-in approvals). Phase C creates new lightweight item-row components for the 待辦 page:

- `TodoSection` — section header + list + empty/error states
- `TodoItemRow` — individual item with context + action

These are simpler than `ApprovalQueueCard` because the 待辦 page is roll-up navigation (no in-page approval action), not the source-of-truth approval page (which has approve/reject buttons, modal flows, etc.). The action button on 待辦 navigates away; approval happens on the source page.

This decision avoids the risk of refactoring `ApprovalQueueCard` to be generic (which could break `出勤審核`). The cost is small duplication; the benefit is isolated change with low risk.

---

## Target state — settings section

The Settings section in the new sidebar consolidates items that share a "configure once, rarely revisit" usage pattern. Most of its specification is already in the sidebar section above. This section captures additional context for implementers.

### Contents

| Item | Route | Purpose |
|---|---|---|
| API | `/developer` | API key management for external integrations |
| 操作紀錄 | `/audit-logs` | Audit trail of operations |
| 品牌設定 | `/branding` | Per-org branding (name, logo emoji, colors, tagline) |

All three are admin-only. The pages themselves already exist and do not require rebuilding for the IA restructure.

### Visual treatment options

Two implementation options for Phase B to choose between:

**Option 1: Regular section header (recommended for initial implementation)**

The Settings section renders the same way as 我的工作, 知識, 管理, 分析 — a `SectionHeader` followed by the list of `NavLink` items. Visually consistent with other sections. Simpler implementation.

**Option 2: Collapsible section with gear icon**

The Settings section starts collapsed, with just a gear icon and "設定 Settings" label. Clicking expands to show the three items. Saves vertical space but adds an interaction step.

Recommendation: Option 1 for Phase B. Option 2 is a possible Phase D refinement if the sidebar feels too dense in practice.

### Future expansion

The Settings section is structured to absorb future settings items as they emerge:
- Notification preferences (when employee request workflows are extended)
- Integration settings (for any future Slack/email/calendar integrations)
- Org-level configuration (for org-wide payroll defaults, working day calendars, etc.)

## Migration path

The order of implementation, and how to manage risk during the transition. Phase B before Phase C before Phase D, with verification between each.

### Phase B order — sidebar implementation

The sidebar restructure is mostly content changes to `Sidebar.tsx`. Recommended order to keep the working tree green at each step:

**Step B.1: Fix bugs first, separately from the IA restructure**

Before any restructuring, fix the three current code bugs in isolation. These are correctness fixes, not IA changes:

- Add `adminOnly: true` to AI 助手 in current `mainLinks`
- Add `adminOnly: true` to 知識圖譜 in current `analyticsLinks`
- Add `adminOnly: true` to 指標數據 in current `analyticsLinks`

These three flags can be added in a single edit. Commit as `fix(sidebar): add adminOnly flags to admin-only items`. This isolates the correctness fix from the IA work, making each commit easier to review.

**Step B.2: Replace link arrays**

Replace the existing arrays (`mainLinks`, `hrLinks`, `analyticsLinks`, `adminLinks`) with the six new arrays (`topLinks`, `myWorkLinks`, `knowledgeLinks`, `manageLinks`, `analyticsLinks`, `settingsLinks`). The interface (`LinkItem`) does not change. New routes (`/my-pay`, `/todo`, `/admin/attendance`, `/admin/compliance`, `/admin/esg`) are added even though Phase C creates the destinations — the routes will 404 until Phase C completes, which is acceptable since the broken state is temporary.

**Step B.3: Update section render**

Replace the existing section render block in `SidebarContent` with the six-section render specified in this document. Apply the `isAdmin` gate at the section level for the three admin-only sections.

**Step B.4: Verify**

Manual check: sign in as admin, verify all sections render. Sign in as employee (or temporarily set `isAdmin` false), verify only 首頁, 我的工作, 知識 render.

Targeted vitest: existing tests should still pass since the component interface and behavior contracts are unchanged. If snapshot tests exist, update them once verified.

### Phase C order — home page reset + 待辦 + route stubs

Phase C is the biggest phase. Suggested order:

**Step C.1: Create route stubs for new pages**

Create minimal placeholder pages at the new routes that Phase B references:
- `/my-pay` — basic "View My Payroll" page (verify if a richer version exists; if so, link there from sidebar instead)
- `/todo` — placeholder
- `/admin/attendance` — placeholder (or redirect to existing `/admin?tab=approve-attendance` initially)
- `/admin/compliance` — placeholder (or redirect to `/admin?tab=compliance`)
- `/admin/esg` — placeholder (or redirect to `/admin?tab=esg`)

Each placeholder shows the sidebar correctly (page is logged in, within AppShell) but has minimal content. This clears the 404 state from Phase B.

**Step C.2: Build the 待辦 page**

Per the specification above. Compose existing endpoints. Build `TodoSection` and `TodoItemRow` as new lightweight components. Verify with both admin and employee roles.

**Step C.3: Rebuild the home page**

Per the specification above. Role-aware rendering. Removes the broken 今日重點 panel. Verify every clickable element lands on the correct destination.

**Step C.4: Promote 合規 and ESG 報告 routes**

Decide between two implementation approaches:

- **Approach A (simpler):** the sidebar items `/admin/compliance` and `/admin/esg` redirect to the existing admin dashboard with the appropriate tab pre-selected. URL stays `/admin?tab=compliance` but is reachable from sidebar. Lowest risk. AdminDashboard.tsx unchanged.
- **Approach B (cleaner long-term):** extract the compliance and ESG components from AdminDashboard.tsx into their own page files at `/admin/compliance/page.tsx` and `/admin/esg/page.tsx`. Removes them from the 8-tab strip on the admin dashboard. Cleaner but riskier given AdminDashboard.tsx's 6,874 lines.

Recommendation: Approach A for Phase C. Approach B is a candidate for a future refactor.

### Phase D order — polish + Layer 4 + fixes

Phase D handles the remaining items. Suggested order:

**Step D.1: Layer 4 — pay_basis dropdown in employee edit modal**

Add the `pay_basis` field to the employee edit form per the Phase 3k schema work (commits `ae180b0`, `65884ae`, `967f142`). Surface the structured error codes from the schema in user-friendly validation messages on the form. Position the dropdown adjacent to 僱用類型 since the two are conceptually paired.

**Step D.2: Cosmetic fixes**

- "vv1.0" → "v1.0" on document detail page
- 指標數據 default time window: change from 30 days to 90 days OR implement smart-default logic (pick smallest window with non-zero data)
- 出勤總表 default month: auto-navigate to most recent month with data instead of current month

**Step D.3: Optional 學習分析 rename**

If pilot users have expressed confusion about the "Learning" label, rename the page to 文件回饋 / Document Feedback. Update the link in `analyticsLinks`. If no confusion has been reported, defer.

**Step D.4: Final click-test of all navigation**

Repeat the Phase A click-test on the now-restructured product. Verify every sidebar item, every home page card, every admin dashboard tab lands on its labeled destination. Capture any remaining issues.

### Risk management

Three risks to manage during implementation:

**Risk 1: AdminDashboard.tsx is large and any change risks regression.**

Mitigation: Phase B does not touch this file. Phase C touches it only if Approach B is chosen for compliance/ESG promotion. Recommendation: Approach A keeps this file unchanged during the IA restructure.

**Risk 2: The route stub period (between Phase B and Phase C) creates a temporarily broken state.**

Mitigation: Phases B and C should ship close together, ideally same week. The sidebar may reference `/todo` before the page exists; users clicking that link see a 404 (or a "coming soon" stub). Acceptable for a 1-2 day window; not acceptable for longer.

**Risk 3: `ApprovalQueueCard.tsx` might be tempting to refactor as generic during 待辦 implementation.**

Mitigation: explicit decision (specified above) to build new lightweight components for 待辦 rather than refactor `ApprovalQueueCard`. The cost of small duplication is lower than the risk of breaking the working `出勤審核` page.

---

## Out of scope

What this sprint does NOT do. Named explicitly so scope creep can be recognized and pushed back on.

### Not in scope for this sprint

- **Visual redesign.** The existing design system (purple primary, slate text, Lucide icons, bilingual labels, card-based layouts) is preserved. We are restructuring information architecture, not rebrowsing visual identity.
- **AdminDashboard.tsx refactor.** The 6,874-line monolith stays as a single file. Approach A for compliance/ESG promotion explicitly keeps it intact.
- **`ApprovalQueueCard.tsx` refactor to generic.** New lightweight components built for 待辦 instead.
- **Knowledge graph feature work.** The page is hidden from primary nav. Topic clustering, similarity scoring, and other potential improvements to 知識圖譜 are deferred until customer demand surfaces. Code remains in repository.
- **Multi-component salary model (M1).** Documented in `docs/known-gaps.md`. Not in this sprint.
- **Salary effective-date history (M2).** Documented in `docs/known-gaps.md`. Not in this sprint.
- **Mid-month proration (M3).** Documented in `docs/known-gaps.md`. Not in this sprint.
- **Schema-factory refactor.** Documented in `docs/known-gaps.md` as the path to close gap G1. Not in this sprint.
- **Overtime rate calculator (LSA Art. 24).** Future Phase 3h-equivalent work. Not in this sprint.
- **Pay slip export.** Future feature work. Not in this sprint.
- **Payment flow integration (ECPay).** Future work, dependent on paid pilot conversion. Not in this sprint.
- **Customizable widget-based home page** (BambooHR-style). Acknowledged as a possible future direction but not implemented.
- **Real-time updates / WebSocket** for the 待辦 page. Initial implementation uses manual refresh.
- **Route renaming** (e.g., `/team` → `/members`, `/teams` → `/groups`). Labels are clearer in the new sidebar; route legacy is preserved.
- **Knowledge graph as a contextual affordance on document detail.** Mentioned as a possible discovery path but not specified for implementation in this sprint. Phase D could add a "View in graph" affordance on document detail if time permits; otherwise deferred.

### Deferred to follow-up sprints

After this sprint completes, the natural next work tracks (driven by pilot customer feedback):

- Overtime rate calculator
- Pay slip export
- Schema-factory refactor (closes G1)
- Compliance Scanner extension to payroll data violations
- Payment flow integration
- Model-level gap closures (M1, M2, M3) as customer segment shifts

---

## Phase deliverables checklist

Concrete tasks per phase. Each box is a discrete unit of work.

### Phase A — Audit & design

- [x] Verify codebase architecture (AppShell, Sidebar.tsx, role logic via /api/profile)
- [x] Walk through every screen and inventory rough spots
- [x] Make 6 IA design decisions with rationale
- [x] Targeted research (industry comparison for attendance UI patterns)
- [x] Write `docs/product-state.md`
- [x] Write `docs/ia-redesign.md` (this document)
- [ ] **Pending: founder click-test of demo path** — note any additional broken links beyond the 今日重點 → Wallchart case
- [ ] Commit both Phase A documents to repo (`docs: Phase A deliverables — IA redesign + product state`)

### Phase B — Sidebar implementation

- [ ] **Step B.1:** Fix `adminOnly` flags on AI 助手, 知識圖譜, 指標數據 (isolated commit)
- [ ] **Step B.2:** Replace link arrays in `Sidebar.tsx` with six new arrays per specification
- [ ] **Step B.3:** Update section render in `SidebarContent` to use new arrays with `isAdmin` gate at section level
- [ ] **Step B.4:** Manual verification with admin and employee roles
- [ ] **Step B.5:** Update tests (snapshot tests, if any) to reflect new structure
- [ ] **Step B.6:** Decide org switcher position (top vs. bottom) and implement
- [ ] **Step B.7:** Decide and implement icons for new items (合規, ESG 報告)
- [ ] Commit (`feat(sidebar): IA restructure — new section groupings`)

### Phase C — Home page reset + 待辦

- [ ] **Step C.1:** Create route stubs for new pages (`/my-pay`, `/todo`, `/admin/attendance`, `/admin/compliance`, `/admin/esg`)
- [ ] **Step C.2:** Build 待辦 page (TodoSection, TodoItemRow components; both admin and employee views; loading, empty, error states; existing endpoint composition)
- [ ] **Step C.3:** Rebuild home page (admin variant: greeting + attention banner + stats + activity feed; employee variant: greeting + my pending + leave balances + quick actions + my recent activity)
- [ ] **Step C.4:** Decide approach for 合規 + ESG 報告 promotion (Approach A: sidebar links to admin dashboard tabs; Approach B: extract to own pages)
- [ ] **Step C.5:** Fix the 今日重點 broken link (specifically the one landing on Wallchart) plus any others identified in Phase A click-test
- [ ] **Step C.6:** Verify every link on the new home page and 待辦 page lands on the correct destination
- [ ] Commit (`feat(home): rebuild home page + add 待辦 page`)

### Phase D — Polish + Layer 4 + minor fixes

- [ ] **Step D.1:** Layer 4 — pay_basis dropdown in employee edit modal (uses Phase 3k schema work)
- [ ] **Step D.2:** Cosmetic fixes (vv1.0 typo; 指標數據 default time window; 出勤總表 default month)
- [ ] **Step D.3:** Optional 學習分析 rename (if user feedback warrants)
- [ ] **Step D.4:** Final click-test of all navigation
- [ ] **Step D.5:** Update `docs/product-state.md` to reflect post-sprint state (move IA restructure from "Current sprint" to "Recently completed")
- [ ] Commit (`feat(forms): Layer 4 pay_basis + polish + bug fixes`)

### Cross-phase verification

After all phases complete:

- [ ] No broken navigation links anywhere in the product
- [ ] Both admin and employee roles see correct sidebar
- [ ] Hero features (合規, ESG 報告) accessible in 2 clicks or fewer from sign-in
- [ ] Home page tells a clear story per role
- [ ] Phase 3k tests still pass; new components have basic test coverage
- [ ] `docs/product-state.md` updated to reflect new state
- [ ] Investor demo dry-run: walk through sign-in → home → ESG report → compliance → document AI summary → request workflow without rough edges

---

## Deferred open questions

Decisions intentionally not made in this document. They are best resolved during implementation when the visual context is concrete.

### Visual / implementation decisions deferred to Phase B

- **Icon for 合規:** Lucide candidates: `Scale`, `ShieldCheck`, `BookCheck`. Recommend `Scale` for the scales-of-justice association with legal compliance.
- **Icon for ESG 報告:** Lucide candidates: `Leaf`, `Globe`, `TrendingUp`. Recommend `Leaf` for the sustainability association.
- **Org switcher position:** top of sidebar (more prominent) vs. bottom (current convention). Decided during Phase B implementation based on visual balance.
- **Settings section visual treatment:** regular section header vs. collapsible gear-icon affordance. Recommend regular section for Phase B; collapsible is a Phase D refinement candidate.
- **Visual sub-grouping within 管理 section:** the 9-item section may benefit from subtle visual dividers between people-focused items (員工, 出勤, 薪資), compliance-focused items (合規, ESG 報告, AI 助手), and access-control items (群組, 成員). Phase B implementation decides whether dividers help.

### Decisions deferred to Phase C

- **Approach A vs. Approach B for compliance/ESG promotion:** Recommend Approach A (sidebar links to existing admin dashboard tabs) for lower risk.
- **Activity feed scope on admin home page:** start with workflow submissions only, expand to additional data sources later. Or commit to full scope (5 data sources) from start.
- **`/my-pay` route:** verify if a richer version exists in the codebase; if not, build a basic version.
- **Deep-linking from 待辦 action buttons:** Phase C can ship with simple navigation to the section, with deep-linking to specific items as a follow-up.

### Decisions deferred to Phase D

- **Optional 學習分析 rename:** trigger on pilot user feedback. If users report confusion about the "Learning" label, rename to 文件回饋.
- **Knowledge graph contextual affordance:** if Phase D has time, add a "View in graph" link from document detail. Otherwise deferred.

### Decisions deferred to future sprints

- **AdminDashboard.tsx refactor:** the 6,874-line file is a maintenance concern but does not block this sprint. Track for future consideration.
- **Customizable home page widgets:** acknowledged direction; not implemented in this sprint.
- **Real-time updates on 待辦:** WebSocket/SSE implementation if pilot feedback warrants.
- **Route renaming (`/team` → `/members`, etc.):** label clarity resolves the immediate confusion; route migration is breaking-change scope.

---

## Document maintenance

This document should be updated when:

1. A phase completes — check off the relevant checklist items and add a "Status: Phase X complete on YYYY-MM-DD" note
2. A decision deferred to implementation gets made — record the decision in this document
3. A new open question surfaces during implementation — add to the deferred section
4. Scope expands or contracts mid-sprint — reflect in "Out of scope" or "Phase deliverables"
5. Sprint completes — final pass updating both this document and `docs/product-state.md`

The document is intended to remain accurate as a record of implementation intent. After the sprint completes, it becomes a historical record (similar to how `docs/known-gaps.md` records gap closures) rather than being deleted. Future sprints can reference it to understand why the IA is structured the way it is.

Same honesty discipline as `docs/known-gaps.md` and `docs/product-state.md`: name what is incomplete rather than hide it. Better to surface a deferred decision than to make it implicitly during implementation.







