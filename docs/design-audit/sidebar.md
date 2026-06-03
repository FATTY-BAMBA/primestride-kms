# Page: Sidebar (App Navigation Chrome)

**Route:** Renders on all authed pages via AppShell (not its own route)
**Screenshots:** `./screenshots/sidebar-*.png` (TBD — to be captured)
**Audited:** 2026-06-03

## What this page is

The persistent left-side navigation that appears on every authenticated page
of Atlas EIP, except public/auth pages (`/login`, `/sign-up`, etc.) and the
/clock kiosk routes. It is the primary navigation chrome of the product —
users see it constantly throughout their workday. It contains the Atlas EIP
brand mark at the top, a vertically-grouped list of navigation links in
sections (MY WORK, KNOWLEDGE, MANAGE, ANALYTICS, SETTINGS), an organization
switcher near the bottom, and a user menu at the very bottom. The sidebar
has expanded (220px wide) and collapsed (60px wide, icons only) states,
plus a mobile drawer variant that slides over the content.

Because the sidebar appears on most pages of the product, its visual
language sets the perceived quality of the whole product. If the sidebar
looks cheap, the product looks cheap. If the sidebar looks confident,
the product looks confident.

## What's working visually today

(Founder to fill in. Reserved for things that are working — even if just
"the section grouping (MY WORK / KNOWLEDGE / MANAGE / ANALYTICS / SETTINGS)
is logical and helps users find features" or "admin-only items being
conditionally rendered is correct.")

## What's NOT working visually today

(Founder to fill in. The earlier feedback rounds identified these issues
— rephrase in your own voice or confirm:)

- The sidebar is too wide and light-purple-tinted, making the layout
  feel left-heavy. 220px feels excessive for the content density.
- The active state on the current page is too subtle — the highlighted
  item should feel more anchored. A left-edge accent bar or stronger
  background would help.
- The "ENTERPRISE INTELLIGENCE" tagline below "Atlas EIP" feels
  template-y and consumes visible space without earning it.
- The Atlas EIP logo gradient (purple to lavender) feels more startup
  than enterprise. Consider a flatter, more confident mark.
- Section headers (MY WORK, KNOWLEDGE, etc.) are styled as small gray
  uppercase text which is right in principle, but the spacing around
  them feels arbitrary.
- The collapse/expand chevron mechanism (small circular button on the
  edge) is functional but visually fussy.
- OrgSwitcher and UserMenu at the bottom inherit no consistent visual
  language from the sidebar above — they read as a separate UI region
  rather than a cohesive bottom panel.

## Constraints the redesign must respect

- **Bilingual labels.** Every nav item has both Chinese (`label`) and
  English (`labelEn`) text in the link arrays. Display switches based
  on the user's `language` profile preference. The redesign must
  preserve the bilingual pattern.
- **Brand color.** Purple `#7C3AED` is the primary action color across
  Atlas EIP. Dynamic per-org branding may override via
  `branding.primary_color` and `branding.accent_color` — the current
  logo uses a gradient between these.
- **Section grouping.** MY WORK / KNOWLEDGE / MANAGE / ANALYTICS /
  SETTINGS is a deliberate information architecture. Do NOT reorganize
  sections or move items between sections. Visual redesign only.
- **Admin gating.** Many items have `adminOnly: true` and only render
  for admin users. Preserve this conditional rendering.
- **Pending badge.** The Requests link shows a red number badge when
  `pendingCount > 0` (admin only). Preserve this badge mechanism, the
  badge can be restyled.
- **Collapse/expand mechanic.** The sidebar can toggle between 220px
  expanded and 60px collapsed states. When collapsed, only icons show
  and section headers hide. Preserve this behavior — the toggle button
  itself can be restyled.
- **Mobile drawer.** On viewports < 1024px, the sidebar becomes a
  slide-over drawer triggered by a hamburger menu in a top header bar.
  Preserve this responsive behavior.
- **Embedded components.** `OrgSwitcher` and `UserMenu` are imported
  and rendered at the bottom of the sidebar. They are also in scope
  for redesign — they should visually cohere with the new sidebar.
- **Design system tokens.** Conform to ADR 0004 visual design system:
  purple primary, slate text scales, semantic color usage. The sidebar
  must look like it belongs to the same product as the redesigned
  homepage.

## Don't change this

Functionality and architecture the redesign must preserve as-is:

- **Section information architecture.** Don't move items between
  sections. Don't add or remove sections. Don't rename sections.
  Visual styling of section headers can change; the structure cannot.
- **Link items + hrefs.** Every link in the nav arrays must remain
  with its current `href`. No new routes, no removed routes, no
  reordered items within sections.
- **Active state detection logic.** The `isActive(href)` function
  handles complex path matching (e.g. `/admin?tab=employees` should
  be active when on that admin tab). Restyle the active state
  appearance but do not change which item gets marked active.
- **API endpoints called.** Sidebar fetches `/api/profile`,
  `/api/branding`, `/api/workflows?view=all&status=pending`. Don't
  add or remove these.
- **Admin gating logic.** The `adminOnly` flag on link items must
  continue to gate visibility.
- **AppShell routing logic.** `noSidebarPaths` (where sidebar is
  hidden) and `darkThemePaths` (where /clock dark theme activates)
  are architectural decisions. AppShell.tsx is included in the
  handoff as REFERENCE ONLY — do not redesign it. The
  `data-theme="clock-dark"` mechanism will be migrated to shadcn's
  `.dark` class in a separate ADR 0003 phase.
- **OrgSwitcher dropdown behavior.** OrgSwitcher's organization
  selection logic, API calls, and switch-on-click flow must work
  exactly as today. Visual redesign only.
- **UserMenu dropdown behavior.** Sign-out, profile access, settings
  link must remain. Visual redesign only.
- **Bilingual label structure.** Don't merge `label` and `labelEn`
  into a single field. The two-field pattern is used across the
  product, not just this component.

## Code locations (for handoff)

- **Main component:** `src/components/Sidebar.tsx` (393 lines — sidebar
  shell, link arrays, section grouping, collapse/expand, mobile drawer)
- **Embedded components (in scope for redesign):**
  - `src/components/OrgSwitcher.tsx` (324 lines — organization picker
    dropdown that appears in the sidebar's bottom panel)
  - `src/components/UserMenu.tsx` (191 lines — user avatar + dropdown
    with sign-out, profile, settings; appears at sidebar bottom)
- **Reference only — DO NOT redesign:**
  - `src/components/AppShell.tsx` (46 lines — routing logic for which
    pages get a sidebar; dark theme attribute toggling for /clock)
- **Where AppShell is used:**
  - `src/app/layout.tsx` (root layout — wraps the entire app)
- **API routes called by Sidebar:**
  - `GET /api/profile` — user profile (name, language, role)
  - `GET /api/branding` — org branding (primary_color, accent_color, name)
  - `GET /api/workflows?view=all&status=pending` — pending count for badge
- **Related ADRs:**
  - `docs/adr/0002-sidebar-active-state.md` — active state detection logic
    (preserve this behavior, restyle appearance only)
  - `docs/adr/0003-shadcn-ui-migration.md` — design system migration; the
    `data-theme="clock-dark"` mechanism in AppShell is scheduled for
    migration to `.dark` class in Phase 5 (separate work)
  - `docs/adr/0004-design-system.md` — visual design system spec; the
    sidebar redesign must conform to these tokens (purple primary, slate
    text scales, etc.)
