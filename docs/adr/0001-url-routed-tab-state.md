# ADR 0001: URL-Routed Tab State in Admin Dashboard

**Status:** Proposed
**Date:** 2026-05-23
**Revised:** 2026-05-24 (research-informed)
**Sprint:** IA Restructure (Phase D)
**Author:** Atlas EIP team
**Related issues:** `docs/sprint-status.md` issue #1 (localStorage tab override), issue #2 (sidebar active state)

---

## Revision history

- **v1 (2026-05-23):** Initial draft. Approach B selected.
- **v2 (2026-05-24):** Added Suspense boundary requirement (Next.js production build requirement, missed in v1). Added `scroll: false` to `router.replace` specification. Added "production build succeeds" as acceptance criterion. Softened unverified claims about how Linear/Notion/Stripe/GitHub internally implement tab state — replaced with verifiable claims from Next.js documentation.

---

## Context

The Admin Dashboard (`src/components/AdminDashboard.tsx`, 6,874 lines) is a single-page component that renders 8 internal tabs:

| Tab value | Content |
|---|---|
| `overview` | 總覽 — admin overview with stats |
| `pending` | 待審核 — workflow approval queue |
| `employees` | 員工 — employee list |
| `leave` | 申請總覽 — leave/request history |
| `wallchart` | 出勤總表 — attendance Wallchart |
| `compliance` | 合規 — LSA compliance rules |
| `esg` | ESG 報告 — ESG S-pillar report |
| `attendance` | 出勤審核 — manual entry approval queue |

The current implementation uses a custom `useLocalStorage` hook (defined inline at line 243 of `AdminDashboard.tsx`) to persist the user's last-visited tab across browser sessions. The hook initializes React state with a default value (`overview`), then reads from `localStorage` via `useEffect` and overrides the state if a stored value exists.

### The problem this ADR addresses

The IA restructure sprint (Phase B.2, commit `39ab2f8`) promoted three admin-dashboard tabs to top-level sidebar items:
- `/admin/compliance` → redirects to `/admin?tab=compliance`
- `/admin/esg` → redirects to `/admin?tab=esg`
- `/admin/attendance` → redirects to `/admin?tab=wallchart`

These redirects ship in Phase C.1 (commit `7b3cd42`). On production we verified that the redirects execute correctly (URL updates), but the displayed tab does NOT match the URL. The component still renders whatever tab was last in localStorage.

**Root cause:** `AdminDashboard.tsx` has no URL-reading logic for tabs. The `?tab=` query parameter is never consulted. localStorage is the sole source of truth for the active tab.

**User impact:** Sidebar items promoted in B.2 don't reliably show their intended content. A user clicking 合規 in the sidebar may see ESG content, or compliance, or any other tab they previously visited. The promotion is functionally broken from a user-experience standpoint, even though the technical implementation (sidebar items, redirects, tab values) is correct.

### Why this matters beyond the immediate bug

Atlas EIP is being prepared for paying-customer pilots. URL-based navigation is table-stakes for SaaS products:
- **Bookmarkability:** users expect to bookmark `/admin?tab=compliance` and return to that view
- **Shareability:** an admin sending a colleague a link expects them to land on the same view
- **Back/forward navigation:** browser navigation should work intuitively
- **Deep-linking:** error messages, emails, or external systems should be able to link directly to specific tabs

A localStorage-only approach silently breaks all four. The Next.js official documentation endorses URL-routed state for client-side parameters: "if you want to read the params from the client, use the useSearchParams() hook." Multiple production SaaS products (e.g., Stripe Dashboard) document URL-based deep linking as a first-class feature.

This ADR is therefore not just a bug fix. It establishes the architectural pattern for tab state across the platform: **URL is the source of truth; localStorage is a convenience fallback only.**

---

## Considered approaches

Three approaches were evaluated before this ADR was written.

### Approach A: Patch — URL param overrides localStorage on mount only

Read the URL `?tab=` parameter once during `useEffect` on mount. If present and valid, call `setTab` to override the localStorage-loaded value. Do not update the URL when the user clicks in-page tabs.

**Pros:**
- Minimal diff (~10 lines)
- No risk of breaking existing tab interaction
- Fixes the immediate redirect-doesn't-land-on-correct-tab bug

**Cons (these are why this approach was rejected):**
- URL becomes stale after first interaction (e.g., user navigates to `/admin?tab=esg`, then clicks 員工 in the in-page strip — URL still says `?tab=esg` but content is employees)
- Bookmarkability is broken in a confusing way
- Sharing URLs doesn't share the current view
- Back/forward navigation does not work for in-page tabs
- Creates two sources of truth (URL on entry, localStorage afterward) that disagree

**Verdict:** Rejected. This is a patch that masks rather than solves the underlying inconsistency. The platform is being prepared for customer pilots — patch-shaped solutions accumulate as technical debt.

### Approach B: Comprehensive — URL is source of truth, two-way sync

URL `?tab=` parameter is the authoritative state. Reading state means reading the URL via `useSearchParams()`. Writing state means updating the URL via `router.replace()`. localStorage is used only when the URL has no `?tab=` parameter (initial visit, returning user without explicit URL).

**Pros:**
- Single source of truth (URL)
- Bookmarkability, shareability, back/forward all work correctly
- Pattern explicitly endorsed by Next.js official documentation
- Hydration works naturally (URL is available during server render via `searchParams` prop in the page; `useSearchParams` hook returns the same values on client)
- Removes the localStorage vs URL conflict entirely

**Cons:**
- Larger diff (~40-60 lines, multiple call sites)
- Higher risk in a 6,874-line file
- Must update every `setTab(...)` call site to also update the URL
- **Requires Suspense boundary in parent component** (see Implementation Plan; this is a Next.js 14 production-build requirement that the v1 ADR missed)
- Possible interaction with Next.js prefetch/routing behavior to verify

**Verdict:** Selected. The cons are addressed by careful investigation and phased implementation (see Implementation Plan below).

### Approach C: Migrate from internal tabs to separate route segments

Refactor each tab into its own Next.js page (`/admin/overview`, `/admin/employees`, `/admin/compliance`, etc.). Eliminate the tab strip; navigation happens via routing.

**Pros:**
- Most architecturally clean
- Each tab becomes independently code-split
- Existing IA-redesign spec already mentions Approach B vs Approach A for compliance/ESG promotion (Phase C.4)
- This is what GitHub Settings does (`/settings/profile`, `/settings/notifications`, etc.)

**Cons:**
- Massive refactor of `AdminDashboard.tsx` (6,874 lines)
- Would require extracting tab-specific state from the shared component
- Out of scope for the current sprint
- Risks regression in working hero features (合規, ESG 報告)

**Verdict:** Deferred. May be revisited as part of `AdminDashboard.tsx` refactor in a future sprint. Approach B is compatible with eventual migration to Approach C.

---

## Decision

**Adopt Approach B: URL is source of truth, two-way sync.**

### Specification

**Source of truth:** the `?tab=` query parameter in the URL.

**Reading state:** the component reads the tab from `useSearchParams()`. The current tab is derived from URL on every render. No separate React state for the tab value.

**Writing state:** every `setTab(newTab)` call site is replaced with a function that calls `router.replace()` with the new tab as a query param, using the `scroll: false` option to prevent jumping to the top of the page on tab change. This updates the URL, which triggers a re-render with the new derived state.

**Fallback hierarchy:**
1. If URL has `?tab=<value>` and `<value>` is a valid tab → use that
2. Else if localStorage has a previously-stored tab → use that
3. Else → use `"overview"` (the existing default)

**Persistence:** when the tab changes, write the new value to localStorage. This preserves the existing "remember my last visited tab" behavior for users entering via `/admin` with no query param.

**No URL changes when arriving via fallback (2) or (3):** if a user lands on `/admin` (no `?tab=`) and we resolve their tab via localStorage, we do NOT push a URL update. The URL stays `/admin`. This preserves the existing UX where bookmarking `/admin` returns the user to whatever tab they were on.

**Router method:** `router.replace()` is used (not `router.push()`) for in-page tab clicks. This avoids polluting browser history with every tab switch. Back button should not cycle through every tab the user clicked — it should return to the previous *page*, not the previous tab. Tab-level navigation is intra-page.

**`scroll: false` option:** `router.replace(url, { scroll: false })` prevents Next.js from scrolling to the top of the page when the URL changes. Without this, switching tabs would cause an annoying scroll-jump, especially for users who have scrolled into the tab content.

**Suspense boundary requirement:** the page that hosts `<AdminDashboard />` (i.e., `/admin/page.tsx`) MUST wrap it in a `<Suspense>` boundary. This is a hard requirement from Next.js 14: production builds (`next build`) will fail with a "Missing Suspense boundary with useSearchParams" error if `useSearchParams()` is called from a Client Component on a statically-generated page without a Suspense wrap. This requirement is not visible in `next dev` (development builds tolerate it).

### Why these specific choices

**Why URL as source of truth (not localStorage):**
Single source of truth eliminates the entire class of bugs we're fixing. The URL is universally accessible (server, client, deep links, shares, history) while localStorage is client-only and per-browser.

**Why router.replace, not push:**
Tab navigation within a single page should not pollute browser history. A user clicking 合規 → ESG → 員工 should not have to press Back four times to leave the page. They press Back once and return to where they came from. This matches user expectations for in-page tab navigation.

**Why `scroll: false`:**
Without it, Next.js scrolls to the top of the page on every URL change. This would regress UX when users switch tabs while reading content. The behavior is opt-in via the `scroll: false` option.

**Why preserve localStorage as fallback:**
Existing users have an established habit: visiting `/admin` returns them to their last-viewed tab. Removing this behavior would regress UX. localStorage serves as the "remember my preference" mechanism for the URL-less entry point.

**Why no URL update when resolving via localStorage:**
If we updated the URL on localStorage fallback, the URL would become `/admin?tab=<saved>` immediately after navigating to `/admin`. This creates two URLs for the same intent ("take me to admin"), confuses bookmarking, and could cause history-stack issues. The cleaner behavior is to let `/admin` remain `/admin` even when internally resolved to a specific tab.

**Why Suspense boundary in the parent (not inside AdminDashboard):**
Per Next.js documentation, the recommended pattern is to wrap the smallest subtree that calls `useSearchParams()` in Suspense. Wrapping `<AdminDashboard />` itself at the page level keeps `AdminDashboard` simpler (no internal Suspense). The fallback can be a loading skeleton or the page header — the choice is a UX detail to decide during implementation.

---

## Consequences

### Positive

- Bug fix: sidebar items 合規, ESG 報告, 出勤 now reliably show correct content
- URL becomes shareable, bookmarkable, deep-linkable for all tabs
- Browser back/forward works correctly for tab-level navigation
- Pattern established for future tab-routed components in the platform
- Compatible with eventual migration to Approach C (separate routes) — URL-based state is a step toward route-based architecture
- No flash of wrong tab during hydration (URL is available during server render)

### Negative / Trade-offs

- Implementation requires changes at multiple `setTab` call sites — risk of missing one
- Adds dependency on `next/navigation` hooks (already implicitly used elsewhere in app)
- Reading `useSearchParams` during render means the component re-renders on URL change (already how Next.js works, but worth naming)
- Requires modifying `/admin/page.tsx` to add a Suspense boundary (small change but a new touchpoint)
- Pre-existing tests (if any exist for AdminDashboard) may need updates
- localStorage now serves a smaller, more specific role — clearer but less central

### Neutral / Worth knowing

- The `useLocalStorage` hook (line 243) is preserved but `setTab` no longer uses it directly. Other state in the file that uses `useLocalStorage` (none currently identified, but possible) is unaffected.
- The localStorage key `"admin_last_tab"` is preserved. Existing users won't lose their stored preference.
- Keyboard shortcuts (Cmd+1 through Cmd+6 cycle tabs, line 2189) will be updated to use the new setter so URL updates correctly on keyboard navigation.
- The Suspense fallback shown during initial render is brief in production (URL is read synchronously after hydration). A simple skeleton or the page header is sufficient.

---

## Implementation plan

This ADR is implemented in phases with verification between each.

**Phase 1: Investigation (no code changes)**

Map every location in `AdminDashboard.tsx` where:
- `setTab(...)` is called (every call site must be updated)
- The `tab` state variable is read (verify reads work after refactor)
- Any indirect URL handling that might interact

Also inspect `/admin/page.tsx` (or `/app/admin/page.tsx`) to check:
- Whether `AdminDashboard` is already wrapped in Suspense for any other reason
- Whether the page is a Server Component or Client Component
- What the parent rendering structure looks like

Output: a list of line numbers and contexts to be modified, plus the parent-page wrapper plan.

**Phase 2: Add URL hooks and derive tab from URL**

- Import `useRouter` and `useSearchParams` from `next/navigation`
- Add a helper function that resolves the active tab from URL → localStorage → default
- Replace the `useLocalStorage<...>(tab, ...)` call with the new resolution logic
- Component still uses `tab` and `setTab` variables — interface preserved

**Phase 3: Update setTab to push URL with scroll: false**

- Modify the `setTab` function to call `router.replace(url, { scroll: false })` with the new tab
- localStorage write continues for future-session fallback
- All existing `setTab(...)` call sites work unchanged (only the implementation behind the variable changes)

**Phase 4: Add Suspense boundary to parent page**

- Edit `/app/admin/page.tsx` (or wherever `<AdminDashboard />` is rendered)
- Wrap `<AdminDashboard />` in `<Suspense fallback={...}>`
- Choose a fallback (loading skeleton or minimal page header)
- Verify wrap doesn't break existing rendering in `next dev`

**Phase 5: Verification**

Manual test of all 9 scenarios listed under "Acceptance criteria" below, including the production build check.

**Phase 6: Commit + push + update sprint-status**

Commit with a clear message referencing this ADR. Update `docs/sprint-status.md` to move issue #1 from "Known issues" to "Resolved."

---

## Acceptance criteria

Manual testing required to verify before merge:

1. **Direct URL entry:** Typing `/admin?tab=esg` in browser → page shows ESG content immediately, no flash
2. **Sidebar redirect:** Clicking 合規 in sidebar → URL becomes `/admin?tab=compliance` → page shows compliance content
3. **In-page tab click:** While on `/admin?tab=compliance`, clicking 員工 tab → URL becomes `/admin?tab=employees` → page shows employees → **page does NOT scroll to top** (scroll: false working)
4. **Browser back button:** After (3), pressing Back → URL returns to `/admin?tab=compliance` → page shows compliance
5. **Browser refresh:** After (3), pressing F5 → URL stays `/admin?tab=employees` → page shows employees
6. **Bookmark and return:** Bookmark `/admin?tab=esg`, navigate away, click bookmark → lands on ESG
7. **Cold start (fresh user):** Clear localStorage, visit `/admin` → lands on `overview` (default)
8. **Returning user:** Cold-start, navigate to `/admin?tab=compliance`, navigate away, visit `/admin` with no query → lands on `compliance` (last-visited via localStorage)
9. **Production build succeeds:** Running `npm run build` (or `next build`) completes without "Missing Suspense boundary with useSearchParams" errors. Deploy to Vercel preview → page loads without runtime errors.

All 9 must pass before declaring this ADR implemented.

---

## Alternatives considered but not chosen for follow-up

**Sync URL on every state change including localStorage fallback:** Rejected because it creates duplicate URLs for the same intent ("/admin" vs "/admin?tab=overview").

**Use `router.push` instead of `router.replace`:** Rejected because tab switches should not create history entries.

**Use `router.replace` without `scroll: false`:** Rejected — would regress UX (page jumps to top on every tab change).

**Use `nuqs` library for URL state management:** Rejected because the codebase doesn't use external state libraries, and our use case (a single tab parameter) is small enough that adding a dependency is not justified. May reconsider if URL-state needs grow across the platform.

**Migrate to React Server Components for tab state:** Out of scope — would require larger architectural change.

**Wrap Suspense inside AdminDashboard rather than in parent:** Rejected — Next.js documentation recommends wrapping the smallest subtree that uses `useSearchParams`. Since `AdminDashboard` IS that subtree (it's the component that calls the hook), wrapping it at the parent level is the correct pattern. Internal Suspense would be redundant.

---

## References

### Internal
- `src/components/AdminDashboard.tsx:243` — current `useLocalStorage` hook implementation
- `src/components/AdminDashboard.tsx:2009` — current tab state initialization
- `src/components/AdminDashboard.tsx:2189` — keyboard shortcut tabs array
- `docs/sprint-status.md` — issue #1 (localStorage tab override)
- `docs/ia-redesign.md` — IA restructure spec, Phase C.4 (compliance/ESG promotion approaches)

### External (Next.js 14 documentation)
- `useSearchParams` API reference: https://nextjs.org/docs/app/api-reference/functions/use-search-params
- "Missing Suspense boundary with useSearchParams" error documentation: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
- Next.js App Router search params tutorial: https://nextjs.org/learn/dashboard-app/adding-search-and-pagination

### Research notes (2026-05-24)
- Pattern (`useSearchParams` + `router.replace` with `URLSearchParams`) is the documented Next.js standard for client-side URL state
- Suspense boundary requirement is a hard production-build constraint, not a stylistic choice
- `scroll: false` option is referenced in community tutorials (e.g., Robin Wieruch) as best practice
- `nuqs` library exists as a typed wrapper but adds dependency overhead not justified for single-parameter use cases

---

## Document maintenance

This ADR is immutable once accepted. If the decision needs to change, write a new ADR (0002) that supersedes this one. The status field is updated as the ADR moves through Proposed → Accepted → Implemented → Superseded.

Status will move to **Implemented** when all 9 acceptance criteria pass on production.
