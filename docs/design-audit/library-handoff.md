# /library — Designer Handoff Bundle

**Bundle date:** 2026-06-04
**Page:** `/library` (knowledge management surface)
**Status:** Tier 1, second page redesign after `/home`

---

## What this is

A second page handoff in the same design system you established on the
homepage. You already know ADR 0004 and the atlas component primitives —
this bundle does not re-introduce them. It does two things:

1. Tells you the specific things `/library` needs from a redesign
2. Points you at the source files, the atlas catalog, and the screenshots
   so you can compose against what already exists

The library is a much larger surface than the homepage (1,210 lines vs 842
before extraction). Search modes, folder hierarchy, doc-type variety, and
per-doc admin actions all need to coexist on one page. The audit is honest
about what fits the existing atlas primitives and what does not.

---

## What’s in this bundle

In the order I would read them:

1. **`docs/design-audit/library.md`** — the page audit. Read this first.
   It covers what the page does, what’s working visually today, what is
   NOT working, the constraints the redesign must respect, and an explicit
   "don’t change this" list.

2. **`docs/design-audit/components-catalog.md`** — the atlas primitives.
   Reference doc. Already extracted from the homepage: StatCard,
   DocumentRow, ActionRow, AlertBanner, OnboardingCard. The audit calls
   out which of these fit /library and which do not; this catalog is the
   detail behind those calls.

3. **`docs/adr/0004-design-system.md`** — design tokens (colors,
   typography, spacing, radii). Already accepted from the homepage cycle.
   The audit references this when calling out color drift in /library
   (the page uses `violet-*` instead of `purple-*`).

4. **`src/app/library/page.tsx`** (1,210 lines) and the page’s file
   dependencies, listed at the bottom of the audit. Fetch fresh from the
   repo before starting — the codebase changes faster than this doc.

5. **`docs/design-audit/screenshots/library-*.png`** — visual reference
   for the four major states (browse, search, manage, empty).

---

## What we’re asking for

Same shape as the homepage handoff. We are looking for:

- **Visual redesign** of `/library` in the established Atlas EIP language
  (purple-600 primary, ADR 0004 typography scale and spacing, etc.). Apply
  the design system that you wrote for the homepage; this page should
  feel like the same product.
- **A documented sub-palette for the 6 doc-source variants** (note, url,
  youtube, template, ai-agent, file). Currently these use ad-hoc colors
  that clash semantically with ADR 0004 (red used for both YouTube and
  "danger"; emerald used for both notes and "success"). The redesign
  needs a deliberate palette so doc-types are scannable without colliding
  with semantic meaning.
- **A treatment for search mode UX.** Browse / Keyword / Semantic / Hybrid
  are four distinct backend modes that must stay. The current presentation
  (four buttons in a row) is functional but looks busy. Open to a dropdown,
  segmented control, tabs, or something else — your call. Recommend with
  reasoning.
- **A loading state** that uses Skeleton primitives matching the final
  layout, not the current bare text. Same pattern as the homepage.
- **A direction on the card-vs-row visual question.** The page is currently
  in-between (row-shaped cards). Pick one and commit — either denser list
  or proper card grid — and tell us why.

---

## What’s NOT in scope for this round

- `/admin` and its 8 tabs (separate later handoff)
- `/admin/payroll` (separate later handoff, Taiwan SMB differentiator)
- Anything outside the `/library` route + the 4 sub-routes listed in the
  audit
- API design or backend data shape — only the visual layer changes
- Route changes — `/library`, `/library/[docId]`, `/library/[docId]/edit`,
  `/library/new`, `/library/note/new` all stay where they are
- Removing features or data the page currently shows — see the "Don’t
  change this" section in the audit

---

## Decisions to flag, not choose silently

Three places where you should propose a direction but pause for our input
before finalizing, because the right answer depends on product context
we have not fully written down:

1. **Whether to add a top stats row.** The library has no metrics row
   today. The audit says StatCard "could fit IF the redesign adds one."
   Whether to add stats and which stats to surface is a product decision
   we have not yet made.
2. **Folder tree presentation.** Folders nest (`parent_folder_id` exists in
   the schema). Current product may only render flat. If your design
   assumes deep nesting, flag it — we may need a separate conversation
   about folder UX before we commit to a deeply-nested tree.
3. **Admin action affordance density.** The current page shows multiple
   hover-revealed icons (DocumentAccessToggle + move + edit + delete). A
   single "more" menu is simpler but discoverable differently. Propose
   what you think is right and we will discuss.

For everything else — typography choices within ADR 0004, layout
proportions, hover states, transitions, empty state styling — use your
judgment from the homepage work. Don’t over-ask.

---

## Code locations (also in the audit)

Reproduced here as a single block for quick scanning. Fetch all of these
fresh from the repo before starting — do not rely on whatever is in this
doc, the codebase changes.
```text
src/app/library/page.tsx               (main page, 1,210 lines)
src/app/library/[docId]/page.tsx       (doc view sub-route)
src/app/library/[docId]/edit/page.tsx  (doc edit sub-route)
src/app/library/new/page.tsx           (upload sub-route)
src/app/library/note/new/page.tsx      (note creation sub-route)
src/components/QuickCreate.tsx         (entry point widget)
src/components/DocumentAccessToggle.tsx (admin per-doc toggle)
src/components/ui/atlas/                (5 atlas primitives from homepage)
src/lib/tokens.ts                      (token implementation)
docs/adr/0004-design-system.md         (visual design system)
docs/design-audit/components-catalog.md (atlas catalog)
docs/design-audit/library.md           (this page’s audit)
```
