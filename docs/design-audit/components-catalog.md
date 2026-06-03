# Atlas EIP — Components Catalog

**Audited:** 2026-06-04
**Location:** `src/components/ui/atlas/`
**Related:** ADR 0004 (visual design system), `docs/design-audit/home.md`

---

## What this is

A reference document for the reusable components that make up the Atlas EIP
visual system. These are the primitives composed by every redesigned page,
starting with `/home`. When a new page is handed off to the designer, this
catalog goes with it — the brief is "compose these primitives, do not reinvent
them."

These components were extracted from `src/app/home/DashboardPage.tsx` as part
of the Step 0 work that follows ADR 0004 Known Debt. They are byte-perfect
copies of the inline JSX they replaced — no visual changes were introduced
during extraction. The homepage in production renders identically to before
the refactor.

## Why this exists

Two reasons:

1. **For the designer.** Before redesigning `/library`, `/admin`, or any
   other page, the designer needs to know what already exists. Without this
   catalog, the designer would propose new patterns when an existing one would
   work — causing visual drift between pages and rework on every iteration.

2. **For the codebase.** Without extracted components, the same JSX gets
   re-implemented inline on each page. When the design changes (rounded
   corners, hover state, color), every page has to change. With these
   primitives, one edit propagates.

## Components

Each component is documented with file path, props, what it looks like, where
it is used today, and a usage example. Screenshots will be added once they
are captured from production at `primestrideatlas.com/home`.

---

### StatCard

**File:** `src/components/ui/atlas/StatCard.tsx`
**Type:** Client component (uses `useRouter` when clickable)

A single hero metric card. Used in 2-up or 4-up grids to surface key numbers
at the top of a page (pending forms, total documents, member count, etc.).

**Props:**

| Prop | Type | Required | Notes |
|------|------|----------|-------|
| `label` | `string` | yes | Caption below the value |
| `value` | `number \| string` | yes | The metric itself; shows `—` if nullish |
| `icon` | `React.ComponentType` | yes | Lucide icon component (pass without `<>`) |
| `color` | `"purple" \| "danger" \| "blue" \| "success"` | yes | Drives icon container styling |
| `href` | `string` | no | If passed, card becomes clickable and routes |
| `pulse` | `boolean` | no | Adds a red pulsing dot (urgent attention) |
| `trend` | `string` | no | Tiny tertiary text below the label |

**Visual treatment:**
- White card, `slate-200` border, `slate-300` border + shadow on hover
- Icon container: 32x32 rounded square, color-tinted bg + matching icon color
- Value: `text-2xl font-bold` with tabular numerals (so digits align)
- Label: `text-xs font-medium text-slate-500`, sits directly below value
- Trend: `text-[10px] text-slate-400`, sits below label (very subtle)
- Pulse: 10x10 red dot with ping animation, top-right of card

**Where used today:**
- Homepage `/home` — 4-up grid of org stats (pending forms, documents,
  members, learning completion)

**Screenshot:** `./screenshots/components-statcard.png` (TBD)

**Usage:**

```tsx
import StatCard, { type StatColor } from "@/components/ui/atlas/StatCard";
import { FileText } from "lucide-react";

<StatCard
  label="Pending Reviews"
  value={8}
  icon={FileText}
  color="danger"
  href="/workflows"
  pulse={true}
/>
```

---

### DocumentRow

**File:** `src/components/ui/atlas/DocumentRow.tsx`
**Type:** Server-component-compatible (uses Next.js `Link`, no client hooks)

A single document row used in document lists. Pairs a file icon, title,
type badge, and a relative timestamp into a clickable row that routes to
`/library/{docId}`.

**Props:**

| Prop | Type | Required | Notes |
|------|------|----------|-------|
| `docId` | `string` | yes | Used to build the `/library/{docId}` href |
| `title` | `string` | yes | The document name; truncates on overflow |
| `docType` | `string \| null` | yes | Shown in badge; falls back to "document" |
| `timeAgoLabel` | `string` | no | Already-formatted relative time (e.g. "2 hours ago") |

**Visual treatment:**
- Hover: `slate-50` background, title shifts to `purple-700`, chevron slides right
- Icon container: 32x32 rounded, `purple-50` bg + `purple-600` FileText icon
- Title: `text-sm font-medium text-slate-900`, truncates with ellipsis
- Badge: 16px tall, `secondary` variant, shows doc type
- Timestamp: `text-xs text-slate-400`, sits next to badge
- Chevron right: `slate-300`, animates 2px right on hover

**Note on i18n:** This component does no date formatting. The caller passes
the formatted string. This keeps the component a pure presentation primitive
that can be used in any language context.

**Where used today:**
- Homepage `/home` — Recent Documents card

**Screenshot:** `./screenshots/components-documentrow.png` (TBD)

**Usage:**

```tsx
import DocumentRow from "@/components/ui/atlas/DocumentRow";
import { timeAgo } from "@/lib/timeAgo";

<DocumentRow
  docId={doc.doc_id}
  title={doc.title}
  docType={doc.doc_type}
  timeAgoLabel={timeAgo(doc.updated_at, isZh)}
/>
```

---

### ActionRow

**File:** `src/components/ui/atlas/ActionRow.tsx`
**Type:** Client component (uses `useRouter`)

A priority-ordered actionable row. Composes an icon, a title, a sublabel,
an optional numeric badge, and a chevron into a button-style row. Used for
"Today's Focus" or "Smart Actions" lists where each item is a thing the user
should do.

**Priority drives color:**

| Priority | Border | Bg | Text | Row bg |
|----------|--------|----|----|--------|
| `urgent` | red-200 | red-50 | red-600 | `red-50/50` (whole row) |
| `high` | amber-200 | amber-50 | amber-600 | none |
| `normal` | slate-200 | slate-50 | slate-600 | none |

The whole row gets a subtle red wash when `priority === "urgent"`. High and
normal priorities only tint the icon container.

**Props:**

| Prop | Type | Required | Notes |
|------|------|----------|-------|
| `priority` | `"urgent" \| "high" \| "normal"` | yes | Drives color treatment |
| `icon` | `React.ComponentType` | yes | Lucide icon (pass without `<>`) |
| `label` | `string` | yes | Title (truncates) |
| `sublabel` | `string` | yes | Subtitle (truncates) |
| `href` | `string` | yes | Clicked routes here |
| `badge` | `number` | no | Red circle with count, top-right of icon |

**Visual treatment:**
- Hover: `slate-50` row bg (urgent stays red-tinted but slightly deeper)
- Icon container: 36x36 rounded, priority-colored border + bg + icon
- Optional badge: 16x16 red circle, top-right corner of icon, `9px` text
- Title: `text-sm font-semibold text-slate-900`, truncates
- Sublabel: `text-xs text-slate-500`, truncates
- Chevron right: animates 2px right + shifts to `purple-400` on hover

**Where used today:**
- Homepage `/home` — Today's Focus list (3-5 items, sorted by priority)

**Screenshot:** `./screenshots/components-actionrow.png` (TBD)

**Usage:**

```tsx
import ActionRow, { type Priority } from "@/components/ui/atlas/ActionRow";
import { Bell } from "lucide-react";

<ActionRow
  priority="urgent"
  icon={Bell}
  label="Approve leave requests"
  sublabel="3 awaiting your decision"
  href="/workflows"
  badge={3}
/>
```

---

### AlertBanner

**File:** `src/components/ui/atlas/AlertBanner.tsx`
**Type:** Server-component-compatible (no client hooks)

A horizontal banner for inline alerts: trial expiry, subscription warnings,
system notices. One component, two variants — identical structure, different
color palette.

**Variants:**

| Variant | Border | Bg | Title | Subtitle | Button |
|---------|--------|----|----|----------|--------|
| `warning` | blue-200 | blue-50 | blue-900 | blue-700 | blue-600 / blue-700 hover |
| `danger`  | red-200  | red-50  | red-900  | red-700  | red-600 / red-700 hover |

Use `warning` for situations that need attention soon (trial ending in N days).
Use `danger` for situations requiring action now (trial expired, account
suspended).

**Props:**

| Prop | Type | Required | Notes |
|------|------|----------|-------|
| `variant` | `"warning" \| "danger"` | yes | Drives all color choices |
| `icon` | `React.ComponentType` | yes | Lucide icon (Clock for warning, AlertCircle for danger) |
| `title` | `string` | yes | Bold headline |
| `subtitle` | `string` | yes | Smaller supporting text |
| `ctaLabel` | `string` | yes | Button text |
| `ctaHref` | `string` | yes | Used as `<a href>` — supports mailto: and external URLs |

**Visual treatment:**
- Padding: `px-4 py-3`, `rounded-lg`, top margin `mt-6`
- Icon: 20x20, color-matched to variant
- Title + subtitle stack on the left
- Button: 32px tall, small text, on the right
- Layout: `justify-between` flex; icon+text left, button right

**Note on content:** The caller is responsible for i18n. This component does
not branch on language. Both the title and CTA label are passed in as already-
resolved strings.

**Where used today:**
- Homepage `/home` — trial-ending banner (`warning` variant, 7-30 days)
- Homepage `/home` — trial-expired banner (`danger` variant, 0 days expired)

**Screenshot:** `./screenshots/components-alertbanner.png` (TBD)

**Usage:**

```tsx
import AlertBanner from "@/components/ui/atlas/AlertBanner";
import { Clock } from "lucide-react";

<AlertBanner
  variant="warning"
  icon={Clock}
  title="Trial ends in 14 days"
  subtitle="Contact us to keep full access"
  ctaLabel="Contact Us"
  ctaHref="mailto:hello@primestrideatlas.com?subject=Atlas EIP renewal"
/>
```

---

### OnboardingCard

**File:** `src/components/ui/atlas/OnboardingCard.tsx`
**Type:** Server-component-compatible (no client hooks)

A first-time-setup checklist card. Shows a multi-step grid where each step
either renders its icon (incomplete) or a green checkmark (complete). Used
as an empty-state nudge for admins who have not finished initial setup.

**Visibility logic stays in the caller.** This component just renders. The
calling page decides when to show it (e.g., admin AND no documents AND no
members invited).

**Step shape:**

| Field | Type | Notes |
|-------|------|-------|
| `step` | `number` | Used as React key; 1-indexed step number |
| `icon` | `React.ComponentType` | Lucide icon shown when step is not done |
| `title` | `string` | Step name (e.g. "Upload Documents") |
| `desc` | `string` | One-line description |
| `href` | `string` | Step routes here when clicked |
| `done` | `boolean` | True swaps icon for green checkmark |

**Props:**

| Prop | Type | Required | Notes |
|------|------|----------|-------|
| `title` | `string` | yes | Card headline (e.g. "Complete setup to unlock AI features") |
| `subtitle` | `string` | yes | Card sub-headline (e.g. "3 steps, less than 5 minutes") |
| `steps` | `OnboardingStep[]` | yes | The list of steps; renders as 3-column grid on `sm:` and up |

**Visual treatment:**
- Card: `purple-200` border, `bg-gradient-to-br from-purple-50/50 to-blue-50/30`
- Top icon: 36x36 rounded square, solid `purple-600` bg with white `Zap` icon
- Card title: `font-semibold text-slate-900`
- Card subtitle: `text-xs text-purple-600`
- Step cards: 3-column grid (single column on mobile), white bg, border
  switches to `emerald-200` when done
- Step icon: 32x32 rounded square, `purple-50` when pending, `emerald-100`
  when done. Icon swap: step's own icon → green `CheckCircle2` when done
- Step title: `text-sm font-semibold text-slate-900`
- Step desc: `text-xs text-slate-500`
- Hover on step card: `purple-300` border + subtle shadow

**Where used today:**
- Homepage `/home` — shown to admins who have totalDocs == 0 OR memberCount <= 1

**Screenshot:** `./screenshots/components-onboardingcard.png` (TBD)

**Usage:**

```tsx
import OnboardingCard, { type OnboardingStep } from "@/components/ui/atlas/OnboardingCard";

const steps: OnboardingStep[] = [
  { step: 1, icon: Upload, title: "Upload Documents", desc: "Add HR policies", href: "/library/new", done: false },
  { step: 2, icon: Users, title: "Invite Team", desc: "Add coworkers", href: "/team", done: false },
  { step: 3, icon: Zap, title: "Try Atlas AI", desc: "Ask a question", href: "/search", done: false },
];

<OnboardingCard
  title="Complete setup to unlock AI features"
  subtitle="3 steps, less than 5 minutes"
  steps={steps}
/>
```

---

## Design Tokens

Color, typography, spacing, and elevation tokens used by all components live
in `docs/adr/0004-design-system.md`. That ADR is the source of truth.

In short: purple `#7C3AED` is the brand color; semantic colors (success/
warning/danger) are reserved for their meanings; borders are `slate-200`
unless a semantic state requires otherwise.

## Adding new components

When extracting a new pattern:

1. **Confirm the pattern repeats.** Do not extract one-off JSX. A pattern is
   ready for extraction when it appears in two or more places, or is about
   to appear in a second place.

2. **File location:** `src/components/ui/atlas/<ComponentName>.tsx`. The
   `atlas/` directory namespace means "Atlas EIP design primitives." Do not
   mix shadcn primitives or third-party UI here.

3. **One file, default export.** Each component lives in its own file with
   a default export. Named exports for types are fine (e.g.
   `export type Priority` in `ActionRow.tsx`).

4. **Document props with TypeScript.** No `any`. Use discriminated unions
   for variants where appropriate.

5. **Keep i18n in the caller.** Components do not branch on language. The
   caller passes already-resolved strings.

6. **Add an entry here.** Catalog the new component below the existing five
   with the same format (file, type, description, props table, visual
   treatment, where used, usage example).

7. **No visual changes during extraction.** When refactoring an inline JSX
   block into a component, the rendered output must be byte-identical to
   before. Visual changes happen in a separate, intentional commit.
