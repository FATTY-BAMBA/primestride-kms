# Page: Home (Dashboard)

**Route:** `/home`
**Screenshots:** `./screenshots/home-*.png` (TBD — to be captured)
**Audited:** 2026-06-03

## What this page is

The default landing page for authenticated users. After signing in, both admins
and regular employees land here. The page acts as a personalized dashboard:
greeting the user by name, surfacing today's pending work (alerts, reviews,
attendance), showing high-level stats relevant to the user's role, listing
recent documents, and providing entry points to other parts of the product.
The content adapts based on whether the viewer is an admin (sees org-wide stats
and pending approvals) or a regular employee (sees personal stats and pending
items).

## What's working visually today

(Founder to fill in. Reserved for things that are working — even if just
"the bilingual zh/en label pattern is consistent throughout the page" or
"the stat row at top establishes a clear scannable summary.")

## What's NOT working visually today

(Founder to fill in. The earlier feedback from your designer captured the main
issues — those should land here. For convenience, the key points from that
feedback to consider:)

- The 4 stat cards have too much vertical whitespace for the small content
  they hold — numbers feel disconnected from their labels
- The yellow alert banner at the top creates a wide thin strip that breaks
  page flow; the emoji icon clashes with enterprise seriousness
- Typography hierarchy is weak — section titles like "今日重點" and
  "最近文件" blend into content instead of feeling like headers
- Color palette mixes purple, yellow, green, blue, gray without a clear system
- The "今日重點" list looks like a settings menu (icon -> text -> chevron) rather
  than actionable highlights
- Spacing rhythm is inconsistent between sections
- Sidebar is wide and light-colored, making layout left-heavy; active state on
  "首頁" is too subtle

## Constraints the redesign must respect

- **Bilingual labels.** Every visible text is rendered as either Chinese (zh)
  or English (en) based on a user preference stored on the profile. The
  redesign must preserve the bilingual pattern — text is not hardcoded; it
  comes from `isZh` ternaries throughout the component.
- **Brand color.** Purple `#7C3AED` is the primary action color across Atlas EIP.
- **Admin vs employee branching.** Several sections show different labels and
  data depending on user role. The redesign must continue to differentiate
  these cases.
- **Light theme.** The page is light-themed. Dark theme is reserved for /clock
  routes only.
- **Onboarding state.** First-time users with no documents uploaded see an
  onboarding flow (currently step 1: "Upload Documents"). The redesign must
  preserve a first-run empty state, not just the populated state.
- **Real-time clock bar.** `ClockStatusBar` component appears on this page —
  the redesign should accommodate its presence (currently rendered near the
  top of the page).

## Don't change this

Functionality and data the redesign should preserve as-is:

- **The actions available.** Every clickable item on the current page links
  somewhere — those links must remain (e.g., quick actions to /library, /clock,
  /workflows). Don't redesign features away.
- **The data shown.** The page calls 10 APIs (profile, learning summary,
  workflows pending, org members, branding, organizations, subscription,
  workflows all-views, today's clock). The redesigned page should consume the
  same data and surface it — not drop fields, not add new data sources.
- **Route structure.** `/home` is the route. Don't propose moving the
  dashboard to a different URL.
- **API endpoints called.** All 10 fetch calls listed in code locations below
  should continue to be invoked. If the redesign requires LESS data, that's a
  separate conversation about which APIs to deprecate, not a quiet removal.
- **Role-aware content.** Admin sees admin labels; employee sees employee
  labels. Don't propose a single layout that drops the role distinction.

## Code locations (for handoff)

- **Page entry:** `src/app/home/page.tsx` (3-line stub, renders `<DashboardPage />`)
- **Main component:** `src/app/home/DashboardPage.tsx` (637 lines — single
  large file holding the entire dashboard)
- **Sub-components imported by DashboardPage:**
  - `src/components/ProtectedRoute.tsx` — auth wrapper
  - `src/components/ClockStatusBar.tsx` — real-time clock status row
  - Various lucide-react icons (specific icon set TBD — see imports in DashboardPage.tsx)
- **API routes called (10 in parallel on mount):**
  - `GET /api/profile` — user profile (name, language preference, role)
  - `GET /api/learning-summary` — learning analytics summary
  - `GET /api/workflows?view=all&status=pending` — pending workflows (org-wide for admin)
  - `GET /api/workflows?status=pending` — pending workflows (user-scoped)
  - `GET /api/org-members` — organization member list
  - `GET /api/branding` — org branding (name, color, logo)
  - `GET /api/organizations` — current organization context
  - `GET /api/subscription` — subscription plan info
  - `GET /api/workflows?view=all` — all workflows (any status)
  - `GET /api/clock/today` — today's clock-in/out status for the user
- **Supporting libraries:**
  - `next/link` — internal navigation
  - `next/navigation` — routing (useRouter)
  - `react` — hooks (useState, useEffect)
- **Database tables involved (indirectly via APIs):**
  - profiles, organizations, organization_members, workflows, documents,
    branding, subscriptions, clock_events (specific schema TBD)
- **Related ADRs:**
  - `docs/adr/0003-shadcn-ui-migration.md` — design system migration plan; this
    page is currently on the legacy `.btn` / `.card` system and will be migrated
    in Phase 2/3 of that ADR
