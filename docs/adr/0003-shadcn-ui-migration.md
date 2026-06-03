# ADR 0003: Complete the shadcn/ui migration; deprecate legacy custom design tokens

**Status:** Proposed
**Date:** 2026-06-01
**Author:** Abdoulie Fatty (with Claude as collaborator)
**Related:** ADR 0001 (URL-routed tab state), ADR 0002 (sidebar active state)

---

## Context

Atlas EIP currently runs two competing design systems in parallel. This is the root cause of visible UI drift across the product — most recently seen as `/team` and `/teams` rendering with dark cards while every other authed page renders with light cards.

### Timeline of the drift

- **Early March 2026** — Atlas EIP started with a hand-rolled CSS design system. Custom hex color tokens (`--bg-card`, `--text-primary`, `--accent-blue`, etc.) defined in a dark professional aesthetic. Layout primitives provided as utility classes (`.btn`, `.btn-primary`, `.btn-danger`, `.card`). This document refers to this as **System B**.

- **March 3, 2026** — shadcn/ui (new-york style, slate base color) installed properly: `components.json`, `src/components/ui/` directory, `cn()` utility at `src/lib/utils.ts`, semantic oklch color tokens added to `globals.css`. Tailwind v4 inline `@theme` configuration. This document refers to this as **System A**.

- **March 3 – present** — Migration started but not completed. `/library/page.tsx` migrated to use `Button`, `Badge`, `Input`, and `Dialog` from `@/components/ui/`. Other pages (admin, team, teams, clock, my-pay, todo, workflows, etc.) continue using legacy classes from System B.

### Current state — measured

- **91 instances** of `className="btn"` (and variants like `btn-primary`, `btn-danger`) across `src/`
- **37 instances** of `className="card"` across `src/`
- **119 inline references** to System B CSS variables (`var(--bg-card)`, `var(--text-primary)`, etc.) across 6 files: `admin/docs/[docId]/page.tsx`, `teams/[teamId]/page.tsx`, `update-password/page.tsx`, `reset-password/page.tsx`, `globals.css` itself, and `components/AtlasMockPanels.tsx`
- Two `:root` blocks in `globals.css` — the second (System B) overrides the relevant tokens from the first (System A) for `.btn` and `.card` consumers
- One non-standard theme mechanism: `data-theme="clock-dark"` attribute on `<body>` used to scope dark-mode picker icons for `/clock`. This is independent of shadcn's standard `.dark` class convention.

### What "drift" looks like in practice

A page using `<div className="card">` gets `background: var(--bg-card)` which resolves to `#161618` (nearly black). Adjacent inline children using `<div style={{ background: "white" }}>` render light. The visual result is a near-black card with a near-white panel inside it — clearly unintentional, observably broken on `/team` and `/teams` per screenshots taken 2026-05-26.

Other pages avoided this drift by inlining `style={{ background: "white" }}` on top of `className="card"`. This works visually but compounds the architectural problem: the override pattern is informally distributed across the codebase, with no single source of truth.

---

## Decision

**Atlas EIP standardizes on shadcn/ui (System A) as its canonical design system.** System B is deprecated. All legacy classes (`.btn`, `.btn-primary`, `.btn-success`, `.btn-warning`, `.btn-danger`, `.card`) and legacy variables (`--bg-primary`, `--bg-secondary`, `--bg-card`, `--bg-card-hover`, `--border-color`, `--border-hover`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-blue`, `--accent-green`, `--accent-yellow`, `--accent-red`, and the `-soft` variants) are removed from `globals.css` after migration completes.

### Rules for future development

1. **Components.** New UI uses shadcn imports from `@/components/ui/*` (Button, Card, Badge, Input, Dialog, etc.) or inline Tailwind classes referencing semantic tokens (`bg-card`, `text-foreground`, `border-border`, etc.).

2. **Color values.** Colors come from semantic tokens (`--card`, `--primary`, `--secondary`, `--destructive`, etc.), not direct hex codes, not System B variables. The semantic tokens may resolve to different concrete colors in light vs dark mode — and that is the point.

3. **Theming.** Pages default to light theme. Dark theme is opt-in via shadcn's standard `.dark` class on a parent element (typically `<body>`), and is reserved for legitimate context-specific uses: kiosk displays, projection screens, accessibility profiles.

4. **/clock special case.** `/clock` is the only authed route that intentionally renders dark (rationale: tablet/wall-mount kiosk visibility). After migration, `/clock` opts in via `.dark` class on `<body>` rather than the bespoke `data-theme="clock-dark"` attribute. The `.dark` class causes all shadcn semantic tokens to automatically flip to their dark equivalents, eliminating the need for any custom CSS overrides on a per-page basis.

5. **No new legacy.** Adding new `className="btn"` or `className="card"` is forbidden. The classes will be removed from `globals.css` as part of migration; PRs that introduce new usages should fail review.

---

## Token mapping (System B to System A)

This table is the single source of truth during migration. When migrating a file, find each System B reference and replace with the listed System A equivalent.

### Background colors

| System B variable | Resolved hex | System A semantic token | System A Tailwind class |
|---|---|---|---|
| `--bg-primary` | `#0a0a0b` | `--background` (in dark mode: near-black) | `bg-background` |
| `--bg-secondary` | `#111113` | `--secondary` (dark mode) or `--muted` | `bg-secondary` or `bg-muted` |
| `--bg-card` | `#161618` | `--card` | `bg-card` |
| `--bg-card-hover` | `#1c1c1f` | `--accent` (subtle hover surface) | `hover:bg-accent` |

### Border colors

| System B variable | Resolved hex | System A semantic token | System A Tailwind class |
|---|---|---|---|
| `--border-color` | `#2a2a2d` | `--border` | `border-border` or just `border` |
| `--border-hover` | `#3a3a3f` | `--border` at higher opacity or `--ring` | `hover:border-ring` |

### Text colors

| System B variable | Resolved hex | System A semantic token | System A Tailwind class |
|---|---|---|---|
| `--text-primary` | `#fafafa` | `--foreground` | `text-foreground` |
| `--text-secondary` | `#a0a0a5` | `--muted-foreground` | `text-muted-foreground` |
| `--text-muted` | `#6a6a70` | `--muted-foreground` (or dimmer variant) | `text-muted-foreground/70` |

### Accent / status colors

| System B variable | Resolved hex | System A semantic token | System A Tailwind class |
|---|---|---|---|
| `--accent-blue` | `#3b82f6` | `--primary` (acts as primary action) | `bg-primary text-primary-foreground` |
| `--accent-blue-soft` | `rgba(59,130,246,0.15)` | `--primary/15` (Tailwind opacity modifier) | `bg-primary/15 text-primary` |
| `--accent-green` | `#22c55e` | No direct semantic — use Tailwind palette directly | `text-green-600 bg-green-50` |
| `--accent-green-soft` | `rgba(34,197,94,0.15)` | Same — Tailwind palette | `bg-green-500/15 text-green-700` |
| `--accent-yellow` | `#eab308` | Same — Tailwind palette | `text-yellow-600 bg-yellow-50` |
| `--accent-yellow-soft` | `rgba(234,179,8,0.15)` | Same — Tailwind palette | `bg-yellow-500/15 text-yellow-700` |
| `--accent-red` | `#ef4444` | `--destructive` | `bg-destructive text-destructive-foreground` |
| `--accent-red-soft` | `rgba(239,68,68,0.15)` | `--destructive/15` | `bg-destructive/15 text-destructive` |

### Component class mapping

| Legacy class | shadcn replacement |
|---|---|
| `<button className="btn">` | `<Button variant="outline">` |
| `<button className="btn btn-primary">` | `<Button>` (default variant) |
| `<button className="btn btn-success">` | `<Button variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">` |
| `<button className="btn btn-warning">` | `<Button variant="outline" className="border-yellow-500 text-yellow-600 hover:bg-yellow-50">` |
| `<button className="btn btn-danger">` | `<Button variant="destructive">` |
| `<a className="btn">` link | `<Button variant="outline" asChild><Link>...</Link></Button>` |
| `<div className="card">` | `<Card>` (after installing `npx shadcn add card`) |

### Border radius

| System B | System A |
|---|---|
| `var(--radius-md)` (size unknown — verify) | `rounded-md` |
| `var(--radius-lg)` (size unknown — verify) | `rounded-lg` |
| `var(--radius)` (shadcn) = 0.625rem | `rounded-md` (Tailwind default) |

---

## Migration plan (sequenced)

The migration runs in six phases. Each phase is a discrete unit of work with verification before moving to the next phase. Phases ship as separate commits.

### Phase 1: Install missing shadcn components

Add components needed for migration that aren't yet installed:

- `npx shadcn@latest add card`
- `npx shadcn@latest add label`
- `npx shadcn@latest add select`
- `npx shadcn@latest add dropdown-menu`
- `npx shadcn@latest add sheet`
- `npx shadcn@latest add sonner` (toast replacement)
- `npx shadcn@latest add form`
- `npx shadcn@latest add alert`
- `npx shadcn@latest add separator`
- `npx shadcn@latest add tabs`

These are inferred from what current pages need (forms, modals, dropdowns, tab switching). If a Phase 2+ migration uncovers a missing component, add it then.

**Acceptance:** `ls src/components/ui/` shows all required components present. No code changes in this phase — just additive installations.

### Phase 2: Migrate `.btn` consumers (91 instances)

Migrate page by page, smallest to largest. Per file:

1. Identify all `<button className="btn ...">` and `<Link className="btn ...">` usages
2. Replace with `<Button variant="...">` per the mapping table
3. Run TypeScript check
4. Verify visually in dev
5. Commit per file (or per logical group)

Acceptance per file: `grep 'className="btn' <file>` returns zero matches.
Acceptance for phase: `grep -rn 'className="btn' src/` returns zero matches.

### Phase 3: Migrate `.card` consumers (37 instances)

Migrate page by page. Per file:

1. Identify all `<div className="card">` (and variants with inline style overrides)
2. Replace with `<Card>` from `@/components/ui/card`
3. If the legacy version had inline `style={{ background: "white" }}`, remove that — Card already provides the right background
4. Run TypeScript check
5. Verify visually in dev
6. Commit per file or per logical group

Acceptance: `grep -rn 'className="card' src/` returns zero matches.

### Phase 4: Replace inline System B variable references (119 instances across 6 files)

Per file, replace inline `style={{ color: "var(--text-primary)" }}` etc. with Tailwind class equivalents per the mapping table.

Heavy files: `admin/docs/[docId]/page.tsx`, `teams/[teamId]/page.tsx`. Plan extra verification time for these.

Acceptance: `grep -rn 'var(--bg-card\|var(--text-primary' src/` returns only matches inside `globals.css` itself (which will be removed in Phase 6).

### Phase 5: Migrate `/clock` from `data-theme` to `.dark` class

Current `/clock` mechanism in `AppShell.tsx`:

```javascript
const darkThemePaths = ["/clock"];
const isDarkTheme = darkThemePaths.some(p => pathname === p || pathname.startsWith(p + "/"));

useEffect(() => {
  if (isDarkTheme) {
    document.body.setAttribute("data-theme", "clock-dark");
  } else {
    document.body.removeAttribute("data-theme");
  }
}, [isDarkTheme]);
```

Replace with `.dark` class:

```javascript
useEffect(() => {
  if (isDarkTheme) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}, [isDarkTheme]);
```

shadcn's `.dark` class is wired to flip all semantic tokens. The page-level CSS for `/clock` should no longer need any explicit color overrides — Card, Button, etc. will automatically render dark.

Remove the `body[data-theme="clock-dark"] input[type="date"]...` rule from `globals.css` if shadcn's standard dark-mode handling of input pickers is sufficient. If not, replace it with `body.dark input[type="date"]...`.

Acceptance: `/clock` renders dark in production. `/clock/manual` (which we modified for issue #5) renders dark. Date/time picker icons are visible against the dark background.

### Phase 6: Remove System B from globals.css

After Phases 2-5 complete and verify:

1. Delete the second `:root` block from `globals.css` (the "Dark professional theme" block defining System B variables)
2. Delete `.btn`, `.btn-primary`, `.btn-success`, `.btn-warning`, `.btn-danger`, `.btn:hover`, `.card`, `.card:hover` rules from `globals.css`
3. Delete any other rules referencing System B variables
4. Run TypeScript check
5. Visual verification across all pages

Acceptance: `grep -E "^.btn|^.card|--bg-card|--text-primary|--accent-blue" src/app/globals.css` returns zero matches.

---

## Acceptance criteria (entire migration)

The migration is COMPLETE when:

1. `grep -rn 'className="btn' src/` returns zero matches
2. `grep -rn 'className="card' src/` returns zero matches
3. `grep -rn 'var(--bg-\|var(--text-primary\|var(--accent-blue\|var(--text-secondary\|var(--text-muted\|var(--border-color' src/` returns zero matches outside `globals.css` (and `globals.css` itself no longer defines these)
4. All authed pages visually verified on production after deploy (checklist of pages below)
5. `/clock` continues to render dark via `.dark` class
6. New pages can be built using only shadcn imports + Tailwind classes — no need to opt-out of legacy theming
7. `tsc --noEmit` clean
8. Atlas EIP test suite passing (current count: ~650 tests)

### Pages requiring visual verification on production

In rough order of complexity:

- `/library` (already shadcn — should be unaffected, but verify regression-free)
- `/admin` (overview, employees, pending, leave, wallchart, compliance, esg, attendance tabs)
- `/admin/payroll`
- `/admin/docs/[docId]`
- `/team`
- `/teams` + `/teams/[teamId]`
- `/metrics`
- `/agent`
- `/learning`
- `/clock` + `/clock/manual` + `/clock/display`
- `/my-pay`
- `/todo`
- `/workflows`
- `/branding`
- `/developer`
- `/audit-logs`
- `/search`
- Modals across the app (Create Group, Invite Member, etc.)

---

## What this ADR does NOT cover

- **Color palette redesign.** This ADR migrates tokens, not concepts. The base color stays slate. The primary action stays the current shade. Any rebrand work is separate.
- **Typography.** Font stack (DM Sans, JetBrains Mono) is unchanged.
- **Layout grid / spacing scale.** Existing spacing usage stays as-is.
- **Component-level redesigns.** A button that was an `outline` style stays `outline`. We're not relitigating which variants pages should use — just translating from legacy classes to shadcn variants.
- **i18n / RTL.** Out of scope.
- **Accessibility audit.** Worthwhile work but separate.

---

## Alternatives considered

### A. Patch System B (flip hex values to light)

**Rejected.** Quickest path (one commit) but doesn't address the architectural drift. We'd still have two competing systems, two `:root` blocks, two ways to write a button. The cause of the drift (uncoordinated growth) persists.

### B. Run both systems indefinitely

**Rejected.** This is the current state, and it produced exactly the visible drift this ADR is responding to. Without consolidation, the drift accelerates as the product grows.

### C. Build a third hybrid

**Rejected.** Adding a third design system to two existing ones is the opposite of consolidation. Tech debt compounded.

### D. Standardize on System B (custom tokens) with corrections

**Rejected.** System B was hand-rolled, bespoke, and has already drifted once. Standing on industry-standard shadcn (battle-tested by thousands of products, with an active ecosystem of compatible components) is the more solid choice for a product Atlas EIP intends to ship to customers. Also: System A is already installed and partially in use. Reversing course on /library would be wasteful.

---

## Risks

### R1: Long migration (9-10 sessions)

**Mitigation:** Per-file commits with verification between files. The codebase remains shippable at every commit boundary. If a migration session hits unexpected complexity, we pause that file and pick it up next session — no half-migrated state persists in main.

### R2: Visual regressions on pages we don't verify

**Mitigation:** The pages-requiring-verification checklist above is exhaustive. Production deploy after Phase 6 triggers a full visual audit before declaring migration complete.

### R3: `/clock` dark mode breaks during Phase 5

**Mitigation:** Phase 5 is its own commit. If it breaks, revert. The `data-theme` mechanism can stay alongside `.dark` until verified.

### R4: New shadcn component installation pulls in unexpected dependencies

**Mitigation:** Phase 1 is purely additive. Run `npm install` afterward, verify no version conflicts, verify `next build` clean. If a component pulls in something problematic, defer that specific component and find an alternative (e.g., use existing Dialog instead of Sheet).

### R5: Inline overrides removed too aggressively expose other bugs

**Mitigation:** Phase 4 is the riskiest phase. Per-file commits allow rollback. The files with the most inline System B references (`admin/docs/[docId]/page.tsx`, `teams/[teamId]/page.tsx`) get extra verification time.

### R6: Migration uncovers Tailwind v4-specific issues

**Mitigation:** Atlas EIP is on Tailwind v4 (4.2.1). The `@theme inline` directive at line 81 of `globals.css` is the v4 way of defining tokens. Any migration issue specific to v4 should be documented and either fixed in-ADR or flagged as a v4-upgrade issue separate from this work.

---

## Revision history

- **v1 (2026-06-01)** — Initial draft. Proposed status. Scope: shadcn/ui canonical, System B deprecated, 9-10 session migration.
