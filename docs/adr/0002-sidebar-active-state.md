# ADR 0002: Sidebar Active State for Composite URLs (Pathname + Query)

**Status:** Implemented
**Date:** 2026-05-24
**Revised:** 2026-05-25 (implementation: Approach C selected over A)
**Sprint:** IA Restructure (Phase D)
**Author:** Atlas EIP team
**Related:** ADR 0001 (URL-routed tab state), `docs/sprint-status.md` issue #2

---

## Revision history

- **v1 (2026-05-24):** Initial draft. Approach A (Suspense wrap at parent layout level) selected; Approach C (force-dynamic) rejected on performance grounds.
- **v2 (2026-05-25):** Implementation phase. During investigation, two findings changed the calculus:
  1. Sidebar's `NavLink` and `SidebarContent` are parent-scope closures (not standalone components), making clean Approach B-style extraction impractical without a 2-3 hour refactor.
  2. Atlas EIP's authed routes were already effectively dynamic (Clerk auth requires headers/cookies), so the "performance cost" of force-dynamic was illusory — there was no real static rendering to lose. Approach C reconsidered and selected. Approach A formally superseded.

Implementation commits: `9029e6e` (layout force-dynamic), `7d3ec17` (sidebar isActive + hrefs).
All 10 acceptance criteria verified on production 2026-05-25.

---

## Context

The Atlas EIP sidebar (`src/components/Sidebar.tsx`, 376 lines) renders navigation items as `<Link>` components and highlights the currently active item with a `bg-violet-50` style. The `isActive` function (lines 121-124) determines which item gets the active style.

After Phase B.2 introduced top-level sidebar items for admin tabs (合規, ESG 報告, 出勤) — which navigate to URLs like `/admin?tab=compliance` — the active-state logic became visibly broken. Clicking 合規 navigates the user to the compliance tab, but the sidebar continues to highlight 概覽 (Overview) instead of 合規.

### The root cause

The current `isActive` function only reads `pathname`, never the query string:

```tsx
const isActive = (href: string) => {
  if (href === "/library") return pathname === "/library" || pathname.startsWith("/library/");
  return pathname === href || pathname.startsWith(href + "/");
};
```

When the URL is `/admin?tab=compliance`:
- `pathname === "/admin"`, query string ignored
- For href `/admin/compliance` (the Phase C.1 redirect target): `pathname === "/admin/compliance"` is false → NOT active
- For href `/admin` (Overview): `pathname === "/admin"` is true → ACTIVE

So Overview always highlights when the user is anywhere in the admin area, regardless of which tab they're actually viewing.

### Why this matters

The IA restructure sprint explicitly promoted 合規, ESG 報告, and 出勤 to top-level sidebar items to make them prominent and accessible. The promotion is functionally broken if clicking them doesn't visibly indicate "you are here." Users lose confidence in the navigation, can't tell where they are, and may double-click or get confused.

The sidebar active state is the primary spatial-awareness mechanism in any SaaS dashboard. Atlas EIP is being prepared for paying-customer pilots — spatial awareness in navigation is table-stakes.

### Why this ADR exists (a session retrospective)

A first attempt at this fix was made on 2026-05-24 and reverted before commit. The implementation:

1. Added `useSearchParams` to `Sidebar.tsx` (alongside existing `usePathname`)
2. Changed three sidebar item hrefs from path form (`/admin/compliance`) to query form (`/admin?tab=compliance`) to eliminate redirect hops
3. Updated `isActive` to handle composite URL matching (pathname + query string)

The code was TypeScript-clean and logically correct. However, `npm run build` failed with 25 instances of:

```
useSearchParams() should be wrapped in a suspense boundary at page "/<route>"
```

The error fired on every page that renders the Sidebar — which is virtually every authenticated page. Because Sidebar is rendered inside a shared layout (not inside a single page), the prerendering bailout cascaded across the entire app.

This ADR exists because the lesson from that attempt is architectural, not just tactical. The fix isn't "add Suspense in one place." The fix requires thinking about where Suspense boundaries live when client-side reactive components are rendered in cross-cutting layout positions.

ADR 0001 already established this lesson for a single page (`/admin/page.tsx` wraps `<AdminDashboard />` in Suspense). ADR 0002 extends the lesson to shared layouts.

---

## Research findings

This section captures what Next.js documentation explicitly says, since assumptions about Suspense boundary placement caused the failed attempt.

### Finding 1: `useSearchParams` triggers a Suspense requirement transitively up the tree

From the official Next.js docs: "If a route is prerendered, calling useSearchParams will cause the Client Component tree up to the closest Suspense boundary to be client-side rendered. This allows a part of the route to be prerendered while the dynamic part that uses useSearchParams is client-side rendered."

This is the mechanism. When a Client Component reads `useSearchParams`, Next.js's static analysis requires that some ancestor (Page, Layout, or any wrapping component) provides a `<Suspense>` boundary. Without one, the build fails because Next.js cannot determine how much of the route to prerender.

The build-time enforcement is documented as a hard rule: "During production builds, a static page that calls useSearchParams from a Client Component must be wrapped in a Suspense boundary, otherwise the build fails with the Missing Suspense boundary with useSearchParams error."

### Finding 2: Next.js documentation directly addresses the layout case

The official `useRouter` API reference (https://nextjs.org/docs/app/api-reference/functions/use-router) shows a canonical pattern for a component that uses `useSearchParams` in a layout:

```tsx
// app/components/navigation-events.tsx ('use client' file)
function NavigationEvents() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // ...
}

// app/layout.tsx
import { Suspense } from 'react'
import { NavigationEvents } from './components/navigation-events'

export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Suspense fallback={null}>
          <NavigationEvents />
        </Suspense>
      </body>
    </html>
  )
}
```

The note that follows is the relevant guidance: "`<NavigationEvents>` is wrapped in a Suspense boundary because `useSearchParams()` causes client-side rendering up to the closest Suspense boundary during prerendering."

This is exactly our situation. Sidebar is the Atlas EIP equivalent of NavigationEvents — a client component that needs to read URL state to render correctly, included in shared layout positions.

### Finding 3: "Smallest subtree" guidance

From the Missing Suspense Boundary docs: "To keep the route statically generated, wrap the smallest subtree that calls useSearchParams() in Suspense."

For our case, the "smallest subtree" is the part of the Sidebar that actually uses search params — which could be the entire Sidebar (simpler) or just the `NavLink` rendering portion (more granular). The simpler choice is to wrap the whole Sidebar; the more granular choice extracts the search-params-consuming logic into a child component.

### Finding 4: Pattern is the standard, not optional

The Next.js community has repeatedly raised this as a confusing developer experience (GitHub issue #74494 has dozens of replies on the topic), and the framework's position has been consistent: Suspense is required, the rule cannot be disabled. Multiple migration guides, blog posts, and StackOverflow answers point to the same fix pattern — wrap the consuming Client Component in Suspense.

This is established Next.js architecture, not an evolving recommendation.

---

## Considered approaches

### Approach A: Wrap `<Sidebar />` in `<Suspense>` at the parent layout level

The shared layout file that currently renders `<Sidebar />` wraps it directly:

```tsx
<Suspense fallback={<SidebarSkeleton />}>
  <Sidebar />
</Suspense>
```

**Pros:**
- Single change in one layout file
- Matches Next.js's documented NavigationEvents pattern exactly
- Sidebar itself remains structurally simple — just add `useSearchParams` and update `isActive`
- Smallest possible code change to the production codebase
- Fallback is brief in production (Suspense suspends only for the initial render)

**Cons:**
- Requires identifying which layout file currently renders Sidebar (we did not investigate this during the failed attempt)
- The fallback `<SidebarSkeleton />` must be designed — empty sidebar would cause layout shift on page load
- If multiple layout files independently render Sidebar, we must update each one

**Verdict (v1):** Selected as primary recommendation.

**Verdict (v2 — 2026-05-25):** Superseded by Approach C during implementation. See revision history. Approach A remains a valid alternative; future engineers may revisit if route-segment migration makes pages staticable.

### Approach B: Extract URL-reading logic into a child Client Component inside Sidebar

Sidebar's outer shell stays a server-renderable Client Component. A new inner component (e.g., `SidebarActiveStateProvider` or `SidebarNavLinks`) is the one that reads `useSearchParams`. The Suspense wrap goes inside Sidebar around this inner component:

```tsx
function Sidebar() {
  return (
    <div>
      <SidebarHeader />
      <Suspense fallback={<NavLinksSkeleton />}>
        <SidebarNavLinks />
      </Suspense>
      <SidebarFooter />
    </div>
  );
}
```

**Pros:**
- The Suspense wrap is colocated with the code that needs it — the relationship is obvious to future readers
- Layout files don't need to be modified
- More granular Suspense boundary means less of the page bails to client-side rendering
- Easier to test in isolation (the inner component has clearer responsibilities)

**Cons:**
- Requires extracting the existing Sidebar logic into multiple components — more code restructuring
- May require lifting state up or passing more props
- Risk of breaking existing Sidebar internal behavior during refactor

**Verdict:** Considered. Not selected as primary, but worth keeping in mind if Approach A's layout investigation reveals complications.

### Approach C: Force the layout to be dynamically rendered with `connection()`

Add `await connection()` to the parent layout's Server Component, opting the entire layout out of static prerendering. This sidesteps the Suspense requirement.

**Pros:**
- Smallest possible code change (one line in a layout file)
- Removes the entire prerendering complexity for the affected routes

**Cons:**
- Loses static-rendering benefits for every page under that layout (potentially the entire authed app)
- Worse performance — every page now requires a server request
- Worse caching characteristics
- Goes against Next.js's recommended pattern of preserving static rendering where possible
- Treats the symptom, not the cause

**Verdict (v1):** Rejected. Performance trade-off assumed too large for the value gained.

**Verdict (v2 — 2026-05-25):** Reconsidered and SELECTED during implementation. The "performance trade-off" was reassessed and found to be illusory for Atlas EIP specifically: authed pages were already dynamic due to Clerk's headers/cookies access, so force-dynamic just makes explicit what was already true. Combined with the discovery that Sidebar's internal components are parent-scope closures (making clean Approach B-style extraction impractical), this became the pragmatic choice. See revision history.

### Approach D: Avoid `useSearchParams` entirely; use `window.location.search` inside a `useEffect`

Sidebar stays as-is. Active-state detection runs on the client after hydration via `window.location.search`. No Suspense required.

**Pros:**
- No build complications
- Sidebar code is locally self-contained

**Cons:**
- Active state is wrong on initial render — sidebar shows the OLD active item until `useEffect` runs
- "Flash of wrong active state" is a regression we already fixed in ADR 0001 for tab state; reintroducing it for sidebar would be inconsistent
- Doesn't compose with Next.js's prefetch / streaming / RSC model
- Anti-pattern per Next.js documentation

**Verdict:** Rejected. Same reasoning that led us to reject "patch" approaches in ADR 0001.

### Approach E: Revert Phase B.2 sidebar items back to a structure that doesn't need query-string detection

Move 合規, ESG 報告, 出勤 back into the admin dashboard's internal tab strip. Remove them from the top-level sidebar. The sidebar would only show coarse-grained routes (`/admin`, `/admin/payroll`, etc.) and active state would work with the existing pathname-only logic.

**Pros:**
- Active state bug becomes moot (no query-string items in sidebar)
- No Suspense complications
- Simplest possible solution

**Cons:**
- Undoes a deliberate IA decision from Phase B.2 (hero features promoted for visibility)
- ESG and 合規 are explicit pilot-target features for Taiwanese SMBs — burying them in a sub-tab regresses product positioning
- The promotion was the entire point of the sprint; reverting it defeats the work of Phases B.2 + C.1 + D.1

**Verdict:** Rejected. Sprint goal is to make these items prominent, not to hide them.

---

## Decision

**Adopt Approach A: Wrap `<Sidebar />` in `<Suspense>` at the parent layout level.**

### Specification

**1. Identify the layout file(s) that render `<Sidebar />`.** Investigation step. Likely candidates: `src/app/layout.tsx` (root), or an `(authed)` route group layout. We did NOT investigate this during the failed attempt; doing so is the first step of implementation.

**2. Wrap `<Sidebar />` in a Suspense boundary** in each layout file that renders it:

```tsx
import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";

// ... in the layout JSX
<Suspense fallback={<SidebarSkeleton />}>
  <Sidebar>{children}</Sidebar>
</Suspense>
```

**3. Design a non-trivial Sidebar fallback skeleton.** Empty fallback would cause layout shift. The fallback should preserve the sidebar's width, color, and rough silhouette so the page layout doesn't jump on load. A simple gray-violet column with a few skeleton bars is sufficient.

**4. Update Sidebar's `isActive` function** to handle three href shapes:
- `/library` → preserved as exact + prefix match (existing behavior)
- `/admin?tab=X` → match when pathname is `/admin` AND `searchParams.get("tab") === X`
- `/admin` (Overview) → match when pathname is `/admin` AND (no tab param OR `tab === "overview"`)
- Everything else → existing pathname-based match

**5. Update three sidebar item hrefs** from path form to query form:
- `/admin/attendance` → `/admin?tab=wallchart`
- `/admin/compliance` → `/admin?tab=compliance`
- `/admin/esg` → `/admin?tab=esg`

This eliminates a redirect hop per click. The Phase C.1 redirect routes (`/admin/attendance`, `/admin/compliance`, `/admin/esg`) remain in place as fallback for any external links that reference the path form.

### Why these specific choices

**Why Approach A over B:**
The layout-level wrap matches Next.js's documented pattern for navigation components (the NavigationEvents example in the official docs). It's a smaller code change. The downside (must edit layout files) is mitigated by the fact that we'll need to investigate the layout structure regardless.

**Why a non-trivial fallback skeleton:**
The Suspense fallback briefly displays during initial page load before `useSearchParams` resolves. An empty `<>` or `null` fallback would cause the sidebar area to be blank, and when it suspends in, all the page content reflows. A sized fallback preserves layout dimensions and prevents shift.

**Why update sidebar hrefs:**
Sidebar items should link to the canonical destination URL, not redirect-through points. The Phase C.1 redirects exist to handle external links (emails, bookmarks); the sidebar doesn't need to use them.

**Why preserve Phase C.1 redirects:**
External links may reference `/admin/compliance`, `/admin/esg`, `/admin/attendance`. Removing the routes would break those links. Keeping them as orphaned-from-sidebar but reachable from external sources is safer.

---

## Consequences

### Positive

- Bug fixed: sidebar items 合規, ESG 報告, 出勤 highlight correctly when user is on those tabs
- Single-click navigation to canonical URLs (no redirect hop from sidebar)
- Pattern established for any future sidebar/navbar components that need URL state
- Compatible with ADR 0001 (URL-routed tab state)
- Sidebar fallback skeleton becomes a small reusable artifact for future loading-state work

### Negative / Trade-offs

- Implementation requires modifying both Sidebar.tsx AND at least one layout file
- Layout files affect every page under them; mistakes have broad blast radius
- Sidebar skeleton design is a new component to maintain
- Brief Suspense fallback may be visible on slow connections (acceptable trade-off, but real)

### Neutral / Worth knowing

- The failed attempt on 2026-05-24 has been reverted; the working tree is at HEAD `d22adaa` (post-D.1, pre-D.2)
- Next session implementing this ADR should start with investigation: find every layout that renders Sidebar
- Production build (`npm run build`) is the definitive test — the same kind of failure that revealed this issue in the first place
- If the layout investigation reveals that Sidebar is rendered in multiple independent layouts, Approach B (Suspense inside Sidebar) becomes more attractive

---

## Implementation plan

This ADR will be implemented in a future session. Phases:

**Phase 1: Investigation (no code changes)**
- Find every layout file in `src/app/` that renders `<Sidebar />`
- Confirm those layouts are Server Components (default) or Client Components
- Identify if any pages render Sidebar directly without going through a layout
- Map the rendering hierarchy to determine optimal Suspense placement

**Phase 2: Design the Sidebar fallback skeleton**
- Sized to match Sidebar dimensions (avoid layout shift)
- Visual style consistent with Atlas EIP design tokens
- Should display briefly without being jarring

**Phase 3: Apply changes**
- Add Sidebar fallback skeleton component
- Wrap `<Sidebar />` in `<Suspense fallback={...}>` in identified layout(s)
- Update Sidebar's `isActive` function (Approach A logic from above)
- Update three sidebar hrefs to query-string form

**Phase 4: Verify**
- TypeScript clean (`npx tsc --noEmit`)
- Production build succeeds (`npm run build`)
- Manual click-test on production: each sidebar item highlights correctly when its URL is active

**Phase 5: Commit + push + update sprint-status**
- Commit references this ADR
- Update `docs/sprint-status.md`: move issue #2 to Resolved
- Update ADR status from Proposed → Implemented

---

## Acceptance criteria

Manual testing required before declaring this ADR implemented:

1. **Production build succeeds:** `npm run build` completes without "Missing Suspense boundary" errors on any route
2. **Direct URL — compliance:** navigating to `/admin?tab=compliance` highlights 合規 in sidebar; Overview is NOT highlighted
3. **Direct URL — ESG:** navigating to `/admin?tab=esg` highlights ESG 報告; nothing else
4. **Direct URL — attendance:** navigating to `/admin?tab=wallchart` highlights 出勤; nothing else
5. **Direct URL — Overview:** navigating to `/admin` (no query) highlights 概覽; nothing else
6. **Direct URL — Overview tab:** navigating to `/admin?tab=overview` also highlights 概覽 (treats as same as no query)
7. **Click navigation:** clicking 合規 in sidebar takes user directly to `/admin?tab=compliance` (no redirect hop visible) and highlights 合規
8. **Cross-section navigation:** while on `/admin?tab=compliance`, clicking 文件庫 (library) navigates to `/library` and highlights 文件庫
9. **Standalone route:** clicking 薪資 navigates to `/admin/payroll` (separate page, not a tab) and highlights 薪資
10. **No layout shift:** during initial page load, the Sidebar area does not visibly jump or reflow

All 10 must pass before declaring this ADR implemented.

---

## Alternatives considered but not chosen for follow-up

**Wrapping `<Suspense>` inside Sidebar around a child component (Approach B):** Kept as fallback if layout investigation reveals complications. Approach A is preferred for simplicity but Approach B remains viable.

**Using `connection()` to force dynamic rendering (Approach C):** Selected during implementation (v2). See revision history. The performance trade-off was reassessed once we recognized the app was already effectively dynamic.

**Using `window.location` in `useEffect` (Approach D):** Rejected for UX reasons (flash of wrong state).

**Reverting B.2 promotion (Approach E):** Rejected — defeats sprint goal.

**Migrating each tab to its own route segment:** Out of scope. Same as ADR 0001's deferred Approach C. May be revisited in a future sprint.

---

## References

### Internal
- `src/components/Sidebar.tsx:121-124` — current `isActive` function
- `src/components/Sidebar.tsx:99-104` — admin sidebar item href definitions
- `docs/adr/0001-url-routed-tab-state.md` — predecessor ADR for tab state
- `docs/sprint-status.md` issue #2 — bug description
- Commit `d22adaa` — last known-good HEAD before failed D.2 attempt

### External (Next.js documentation)
- `useSearchParams` API reference: https://nextjs.org/docs/app/api-reference/functions/use-search-params
- `useRouter` API reference (includes NavigationEvents pattern): https://nextjs.org/docs/app/api-reference/functions/use-router
- Missing Suspense Boundary error doc: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
- Deopted into Client Rendering error doc: https://nextjs.org/docs/messages/deopted-into-client-rendering

### Research notes (2026-05-24)
- Next.js explicitly documents the layout + Suspense pattern for navigation components that use `useSearchParams`
- Suspense requirement is a hard production-build constraint, identical to ADR 0001's finding
- Community discussion (vercel/next.js issue #74494) confirms the rule is permanent, not transitional
- The failed D.2 attempt's mistake was not adding Suspense around Sidebar's parent — same architectural lesson as ADR 0001, but for layouts instead of pages

---

## Document maintenance

This ADR is immutable once accepted. If the decision needs to change, write a new ADR (0003) that supersedes this one.

Status will move to **Implemented** when all 10 acceptance criteria pass on production.

---

## Retrospective notes for future ADRs

The failed D.2 attempt happened because:

1. The ADR 0001 lesson (Suspense boundaries for `useSearchParams`) was already known but was framed as "for a single page." It should have been framed as "for any subtree that uses `useSearchParams`, including subtrees in shared layouts."

2. When proposing D.2 work, the question "do we need an ADR?" was answered "no" too quickly. ADRs aren't only for novel architecture — they're also for non-obvious cross-cutting concerns. A change that affects how a component participates in the prerendering tree IS architecturally significant.

3. Investigation should have asked "where is this component rendered in the tree?" before any edit. We jumped to implementation after identifying only the file to modify.

**Lesson for ADR 0003+:** when modifying a component that's rendered in shared layouts, investigate the rendering tree before designing changes. Layout-level changes are not "small fixes."
