# Atlas EIP — Design Audit

Per-page briefs that document the current state of each page so a designer can
propose visual redesigns grounded in product reality.

## How a designer handoff works

When a page is ready to be redesigned:

1. The audit document for that page is read by the designer
2. The current page TSX + its component dependencies are fetched fresh from the repo
3. Screenshots from `./screenshots/<page-name>-*.png` are attached
4. All three are sent to the designer together

The audit is the brief. The code is the canvas. The screenshots are the visual reference.

## What an audit contains

Each page gets a markdown file with:

- A short paragraph on what the page does and who uses it
- A list of what's working visually
- A list of what's NOT working visually, with reasoning
- Constraints the redesign must respect (functionality, data flow, language support)
- An explicit "don't change this" list (things the redesigner should preserve)
- Code locations (so engineers can pull the right files at handoff time)

## Audit tiers

Not every page needs to be audited up-front. Capture enough to extract design
principles, then apply those principles to remaining pages during the
ADR 0003 migration.

### Tier 1 — foundational (audit first)
- `/home` — homepage, sets first impressions, most user feedback to date
- `/library` — already migrated to shadcn; baseline for what shadcn defaults look like in this product's context

### Tier 2 — complexity stress test (audit second)
- `/admin` — 8 tabs, most structurally complex page
- `/clock` — intentionally dark, kiosk context, tests dual-mode design

### Tier 3 — pages flagged for redesign (audit third)
- `/team` — page that triggered the design system conversation
- `/teams` + `/teams/[teamId]` — same
- `/metrics` — charts and time-series, different content type
- `/my-pay` — employee self-service, different audience

### Tier 4 — light pass, lower priority
`/clock/manual`, `/clock/display`, `/audit-logs`, `/branding`, `/developer`,
`/search`, `/workflows`, `/todo`. Full audits only if Tier 1-3 don't yield
enough information, OR they get audited as part of their ADR 0003 Phase 2+
migration session.

## Template

Each page: `docs/design-audit/<page-name>.md`

```markdown
# Page: <Name>

**Route:** `/path`
**Screenshots:** `./screenshots/<page-name>-*.png`
**Audited:** YYYY-MM-DD

## What this page is

One short paragraph: what's the page for, who uses it, what they do here.

## What's working visually today

Specific. Not "looks ok" but "the document list rows have good information density,
title + metadata + chevron is the right amount of detail per row."

## What's NOT working visually today

Specific with reasoning. Not "looks bad" but "the 4 stat cards each have ~80px of
vertical whitespace around 14pt numbers — the proportions feel empty and weak."

## Constraints the redesign must respect

Things the designer must honor:
- (list per-page — e.g., bilingual labels render as `中文 English` pairs, brand
  purple #7C3AED for primary actions, dark theme only on /clock and sub-routes,
  must work at narrow viewports, etc.)

## Don't change this

Functionality and data the redesign should preserve as-is:
- The actions available (what each button does)
- The data shown (don't drop fields or add new data sources)
- The route structure (don't move things to new URLs)
- The API endpoints called

## Code locations (for handoff)

- Page entry: `src/app/<route>/page.tsx`
- Main component: `src/components/<Component>.tsx`
- Sub-components used: list
- API routes called: list
```

## Screenshots

`docs/design-audit/screenshots/<page-name>-<state>.png`

Capture: populated state minimum. Empty state and mobile if relevant.

## Why this is separate from ADR 0003

ADR 0003 settles which design SYSTEM the code uses (shadcn/ui). These audits feed
visual decisions: what the system should LOOK like when applied. ADR 0004
codifies those visual decisions. The audits are the empirical
input to ADR 0004.
