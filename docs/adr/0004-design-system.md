# ADR 0004: Visual Design System

**Status:** Accepted
**Date:** 2026-06-03
**Author:** Abdoulie Fatty (with external designer + Claude as collaborators)
**Related:** ADR 0003 (shadcn/ui migration), `docs/design-audit/home.md`

---

## Context

The homepage redesign at `/home` established a visual language for Atlas EIP. Before redesigning additional pages, we document the design tokens so every page uses the same system. This ADR is the source of truth for visual design.

Where ADR 0003 settles which design SYSTEM the code uses (shadcn/ui), this ADR settles what the system should LOOK like when applied. ADR 0003's Phase 2+ migration of remaining pages must conform to these tokens.

---

## Design Tokens

### 1. Color System

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `primary` | `#7C3AED` | `purple-600` | Primary buttons, active states, brand accents |
| `primary-light` | `#F5F3FF` | `purple-50` | Hover backgrounds, icon containers |
| `primary-hover` | `#6D28D9` | `purple-700` | Button hover states |
| `success` | `#059669` | `emerald-600` | Positive metrics, completed states |
| `success-light` | `#F0FDF4` | `emerald-50` | Success icon backgrounds |
| `warning` | `#D97706` | `amber-600` | Actual warnings, trial expiry |
| `warning-light` | `#FFFBEB` | `amber-50` | Warning icon backgrounds |
| `danger` | `#DC2626` | `red-600` | Urgent actions, errors, pending reviews |
| `danger-light` | `#FEF2F2` | `red-50` | Danger icon backgrounds |
| `surface` | `#FFFFFF` | `white` | Card backgrounds |
| `page-bg` | `#F8FAFC` | `slate-50` | Page background |
| `text-primary` | `#0F172A` | `slate-900` | Headings, primary text |
| `text-secondary` | `#64748B` | `slate-500` | Body text, labels |
| `text-tertiary` | `#94A3B8` | `slate-400` | Metadata, timestamps |
| `border` | `#E2E8F0` | `slate-200` | Card borders, dividers |
| `border-hover` | `#CBD5E1` | `slate-300` | Hover state borders |

**Rules:**
- Semantic colors (success/warning/danger) are reserved for their meanings. Do not use green for neutral data.
- Purple is the only brand accent. Do not introduce new accent colors per page.
- All borders use `slate-200` unless a semantic state requires otherwise.

**Custom hex exceptions:**
- `#E8E3FF` (light purple tint) is permitted for subtle onboarding card borders when `border-purple-200` is too saturated. Document any additional custom hexes here.

### 2. Typography Scale

| Token | Size | Weight | Tracking | Line Height | Tailwind Class |
|-------|------|--------|----------|-------------|----------------|
| `display` | 30px | 700 | -0.02em | 1.2 | `text-3xl font-bold tracking-tight` |
| `heading` | 24px | 700 | -0.02em | 1.2 | `text-2xl font-bold tracking-tight` |
| `title` | 18px | 600 | 0 | 1.3 | `text-lg font-semibold` |
| `subtitle` | 14px | 600 | 0 | 1.4 | `text-sm font-semibold` |
| `body` | 14px | 400 | 0 | 1.5 | `text-sm` |
| `body-small` | 13px | 400 | 0 | 1.5 | `text-[13px]` |
| `label` | 12px | 500 | 0 | 1.4 | `text-xs font-medium` |
| `caption` | 11px | 500 | 0 | 1.4 | `text-[11px] font-medium` |
| `micro` | 10px | 600 | 0.05em | 1.2 | `text-[10px] font-semibold uppercase tracking-wider` |

**Rules:**
- Numbers use `tabular-nums` to prevent jitter in stat cards.
- Headings use `tracking-tight` for density.
- Section headers in English use `uppercase tracking-wider`.

### 3. Spacing Scale

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `space-1` | 4px | `space-1` | Tight inline gaps |
| `space-2` | 8px | `space-2` | Icon-to-text gaps |
| `space-3` | 12px | `space-3` | Card internal padding |
| `space-4` | 16px | `space-4` | Section gaps |
| `space-5` | 20px | `space-5` | Card padding |
| `space-6` | 24px | `space-6` | Major section dividers |
| `space-8` | 32px | `space-8` | Page-level padding |

**Rules:**
- Card padding is `p-4` (16px) or `p-5` (20px) for emphasis cards.
- Gap between cards in a grid is `gap-3` (12px).
- Page max-width is `max-w-5xl` (1024px).

### 4. Component Patterns

#### Stat Card
- Icon container: `h-8 w-8 rounded-lg` with semantic color background
- Number: `text-2xl font-bold tabular-nums tracking-tight`
- Label: `text-xs font-medium text-slate-500`
- Trend text (optional): `text-[10px] text-slate-400`
- Hover: `hover:border-slate-300 hover:shadow-md`

#### Action Row (Smart Actions)
- Icon container: `h-9 w-9 rounded-lg border` with priority-based color
- Priority urgent: `border-red-200 bg-red-50 text-red-600`
- Priority high: `border-amber-200 bg-amber-50 text-amber-600`
- Priority normal: `border-slate-200 bg-slate-50 text-slate-600`
- Title: `text-sm font-semibold text-slate-900`
- Subtitle: `text-xs text-slate-500`
- Hover: `hover:bg-slate-50`, chevron `group-hover:translate-x-0.5`

#### Document Row
- Icon container: `h-8 w-8 rounded-md bg-purple-50`
- Title: `text-sm font-medium`, hover `text-purple-700`
- Badge: `h-4 px-1.5 text-[10px] font-medium`
- Timestamp: `text-xs text-slate-400`

#### Alert Banner
- Compact card style, not full-width strip
- Semantic background + border color
- Icon in rounded container
- Action button inside card

### 5. Border Radius

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `radius-sm` | 6px | `rounded-md` | Small elements, badges |
| `radius-md` | 8px | `rounded-lg` | Buttons, icon containers |
| `radius-lg` | 10px | `rounded-xl` | Cards |
| `radius-xl` | 14px | `rounded-2xl` | Emphasis cards, alerts |

### 6. Shadows

| Token | Tailwind | Usage |
|-------|----------|-------|
| `shadow-none` | `shadow-none` | Default state |
| `shadow-sm` | `shadow-sm` | Card hover |
| `shadow-md` | `shadow-md` | Elevated hover |
| `shadow-lg` | `shadow-lg` | Modals, drawers |

### 7. Transitions

| Token | Duration | Tailwind | Usage |
|-------|----------|----------|-------|
| `transition-fast` | 150ms | `duration-150` | Icon color, border |
| `transition-base` | 200ms | `duration-200` | Card hover, shadow |
| `transition-slow` | 300ms | `duration-300` | Page transitions |

---

## shadcn/ui Coexistence

shadcn/ui components use CSS variables (oklch) internally — defined in the first `:root` block of `src/app/globals.css`. The design tokens documented in this ADR are Tailwind utility classes (e.g. `purple-600`, `slate-200`). These coexist without conflict: shadcn primitives render with their own semantic tokens, and pages built on shadcn primitives are styled additionally via the Tailwind classes in this ADR. No configuration of shadcn's internal tokens is required.

---

## Consequences

- Every new page redesign must reference these tokens.
- No new colors, spacing values, or typography sizes without updating this ADR.
- The sidebar redesign (deferred) must conform to these tokens when audited.
- ADR 0003 Phase 2+ migration of remaining pages must apply these tokens consistently.

---

## Known Debt

- **Branding colors.** The `branding` API returns per-organization `primary_color` and `accent_color`. Current components on the homepage use hardcoded purple Tailwind classes (`bg-purple-50`, `text-purple-600`). If multi-tenant branding becomes a real feature (rather than aspirational), a `useBrandColors()` hook should map API colors to Tailwind classes or CSS variables. Until then, the homepage will not adapt to non-purple branding.
- **Custom hex exception.** `#E8E3FF` is used for onboarding card borders. Not in standard Tailwind palette. Acceptable for subtlety, but consider extending Tailwind config if more custom colors are added.
- **Component extraction not done yet.** The homepage redesign defines visual patterns (StatCard, ActionRow, DocumentRow, AlertBanner, OnboardingCard) inline. These should be extracted to shared components in `src/components/ui/atlas/` before redesigning subsequent pages, otherwise each page becomes a snowflake.

---

## Related

- ADR 0003: shadcn/ui migration (architectural foundation)
- `docs/design-audit/home.md`: empirical input that informed this ADR
- `src/app/home/DashboardPage.tsx`: first implementation applying ADR 0004 tokens
- `src/components/ClockStatusBar.tsx`: second implementation applying ADR 0004 tokens

---

## Revision history

- **v1 (2026-06-03)** — Initial draft. Accepted status. Extracted from homepage redesign produced by external designer; reviewed and approved before commit.
