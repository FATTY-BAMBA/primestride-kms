# Page: Library

**Route:** `/library`
**Screenshots:** `./screenshots/library-*.png` (TBD — to be captured for browse, search, manage, empty states)
**Audited:** 2026-06-04

## What this page is

The knowledge management surface for Atlas EIP. Both admins and regular
employees land here to find, browse, and act on the organisation’s documents.
The page covers four overlapping concerns:

1. **Browse** — folder tree (left-side filtering via URL params) + filtered
   document list as the main surface
2. **Search** — keyword / semantic / hybrid AI search modes with relevance
   scoring, match explanations, snippet previews, and facets
3. **Manage** — folder creation, document-to-folder moves, per-document
   access toggles (admin-only)
4. **Create** — multiple entry points: `QuickCreate` widget on the page, plus
   `/library/new` (upload) and `/library/note/new` (write a note)

The page already uses shadcn/ui primitives (Button, Badge, Input, Dialog).
Per the audit README, `/library` is the baseline for what shadcn defaults
look like in this product’s context — the redesign brief here is less
"build something new" and more "bring `/library` into the Atlas EIP visual
language we just established for the homepage."

## What’s working visually today

(Founder to fill or refine. Initial observations from code inspection:)

- **Doc-type identity is strong.** Each of the 6 doc-source variants
  (note / url / youtube / template / ai-agent / pdf / file) has its own
  icon + colored background. Users can scan a list and immediately know
  what kind of asset each row is.
- **Search relevance is visually communicated.** Score badges with color
  tiers (60%+ violet, 40%+ blue, <40% slate) and the ⚡ / 🧠 emoji
  indicators (hybrid vs semantic) give the AI search real teeth visually.
  Most products hide this; surfacing it is a differentiator.
- **Hover-revealed admin actions** keep the row clean for non-admins and
  for the employee viewing experience, while admins get folder-move +
  access toggle on hover.
- **Empty state has thoughtful branching.** Different messages for "no
  docs in folder" / "no team match" / "no search match" / "no docs at all"
  — admins also get an Upload CTA. This is better than most pages have.

## What’s NOT working visually today

The library currently uses the unmodified shadcn defaults plus several
ad-hoc color choices that pre-date the design system. The result is a
page that feels like a different product from the homepage.

- **Color drift from ADR 0004.** The library uses `violet-600` / `violet-700`
  as its accent color (CTA buttons, hover borders, score badges, "why
  matched" text). The homepage and ADR 0004 use `purple-600`. Violet is
  visibly cooler and less saturated than purple — next to the homepage
  they look like sibling products, not the same product.
- **Doc-type color palette is not in the token system.** The 6 doc-type
  colors (`bg-emerald-100`, `bg-blue-100`, `bg-red-100`, `bg-pink-100`,
  `bg-violet-100`, `bg-slate-100`) are hardcoded into the file. They
  predate ADR 0004 and were not chosen with the rest of the palette in
  mind. Some of these clash semantically: red (used for YouTube) means
  "danger" in ADR 0004; emerald (used for notes) means "success." Doc
  types should not be using semantic colors.
- **Default icon container is the wrong shade.** Files default to
  `bg-slate-100` which feels heavy next to the white card. The homepage
  uses `bg-purple-50` for the same role (neutral icon container) and
  reads as lighter and more on-brand.
- **The loading state is a bare text string** ("Loading library...").
  The homepage uses Skeleton primitives that match the final layout, so
  the page does not visually jump on load. This page jumps.
- **Search mode UX is dense.** Browse / Keyword / Semantic / Hybrid is
  a powerful set of capabilities but presented in a way that looks
  busy. The mode toggle is shown as four buttons in a row — reasonable
  default but not optimized for scanning. The relevance badges + match
  explanations + section title + snippet preview can stack into a tall
  result card.
- **Card vs row visual decision is unresolved.** Each `DocumentCard` is
  styled as a row-shaped card (`rounded-xl p-4`, flex row layout). It
  is not a card grid and not quite a list — sitting between the two.
  The homepage went with a clean list (DocumentRow). The library could
  consider either fully committing to cards (multi-column grid) or fully
  committing to rows (single-column list with denser layout).
- **Action density when admin + hover.** When an admin hovers a doc, two
  controls appear (DocumentAccessToggle + move button) plus edit /
  delete. The reveal-on-hover pattern means actions are discoverable but
  not always obvious. Consider a single "more" menu instead of multiple
  hover-revealed icons.
- **Typography hierarchy is weak.** Section transitions (folder name,
  "All Documents" heading, search results heading) read at similar
  weights. Headers do not have the same `tracking-tight` confidence
  that the homepage now has.

## Constraints the redesign must respect

- **Four search modes must stay.** Browse / Keyword / Semantic / Hybrid
  are distinct backend modes with different result shapes. The redesign
  may change how they’re presented (dropdown? segmented control? tabs?)
  but cannot reduce them to one mode.
- **All 6 doc-source variants render distinctly.** note / url / youtube /
  template / ai-agent / file (incl. pdf) must each be visually
  identifiable. If the redesign moves to a single token color, each type
  still needs its own icon — the differentiation cannot collapse.
- **Folder hierarchy must work.** `parent_folder_id` is in the schema;
  folders can nest. The redesign must support a folder tree with at
  least one level of nesting (current product may only render flat
  today but the data model assumes nesting).
- **Access toggle is admin-only and persists per document.** The
  `DocumentAccessToggle` component reads/writes `access_level` (e.g.
  `all_members`, `admins_only`). The redesign must preserve where this
  control lives (per-row, admin-revealed).
- **Feedback counts (helped / not_confident / didnt_help) are part of
  the row.** These are real product metrics that show which documents
  the org’s AI is using well. The redesign may relocate them but
  cannot drop them.
- **Bilingual labels.** Like the homepage, all visible text branches on
  the `isZh` flag. Hardcoded English in the current page is technical
  debt to clean up during redesign.
- **Light theme.** Library is light-themed; dark theme is reserved for
  /clock routes only.
- **Modals stay shadcn Dialog primitives.** `CreateFolderModal` and
  `MoveToFolderModal` should use the same Dialog component, not
  custom-built overlays.

## Don’t change this

Functionality and data the redesign should preserve as-is:

- **The actions available.** Every item the current page can do must
  remain doable: open a doc, edit a doc, delete a doc, move a doc
  between folders, toggle doc access, create a folder, navigate via
  folder tree, search across all 4 modes, see facets, see relevance
  scores, see match explanations, see snippet previews.
- **The data shown.** The page consumes documents (with feedback counts,
  access level, doc source, doc type, domain, version, status, tags),
  folders (with color, icon, parent_folder_id, team_id, document
  counts), teams, and search results with facets. The redesigned page
  should consume the same data.
- **Sub-routes.** `/library/[docId]` (view), `/library/[docId]/edit`,
  `/library/new` (upload), `/library/note/new` (write) all stay where
  they are. Don’t move these to different URLs.
- **API endpoints called.** All `/api/documents*` and `/api/doc-*`
  routes should continue to be invoked. If the redesign needs LESS
  data, that’s a separate conversation about which endpoints to
  deprecate, not a quiet removal.
- **Admin vs employee branching.** Admins see DocumentAccessToggle and
  the move-to-folder button on hover; employees do not. Don’t collapse
  these into a single role-less layout.
- **Search relevance signals.** The score percentages, match-tier
  colors, `why_matched` array, `section_title`, and `snippet` are all
  product signals the user has learned to read. Don’t drop them.

## On composing the atlas components

The Atlas EIP component catalog (`./components-catalog.md`) lists five
extracted primitives from the homepage redesign: StatCard, DocumentRow,
ActionRow, AlertBanner, OnboardingCard.

The honest answer for `/library` is that **most of these do not directly
fit this page.** Specifically:

- **DocumentRow does not fit.** The homepage’s DocumentRow is a thin
  list row (icon + title + badge + timestamp + chevron). The library’s
  `DocumentCard` is much richer (doc-source icon variants, hover-
  revealed admin actions, access toggle, folder-move, feedback counts).
  Forcing the homepage primitive on this page would drop information.
- **StatCard could fit IF the redesign adds a top metrics row.** The
  library currently has no top-of-page stats. The redesign could
  optionally add a 3-up or 4-up summary (Total docs, Last updated, AI
  feedback summary, Pending reviews) using StatCard. This is a design
  choice, not a requirement.
- **AlertBanner could fit for system warnings.** E.g. "Your AI index
  is rebuilding — search may be incomplete." The library does not show
  these today; the primitive is ready if the redesign wants them.

The right move for `/library` is:

1. **First pass:** apply ADR 0004 tokens (replace `violet-*` with
   `purple-*`, replace ad-hoc doc-type colors with a documented sub-
   palette, fix the loading state to use Skeleton). This alone will
   pull the page visually closer to the homepage.
2. **Second pass after redesign:** if the `DocumentCard` pattern proves
   it could work on a third page (e.g. `/admin/docs`), extract it as
   `DocumentTile` or similar into `src/components/ui/atlas/`. Until
   then it stays inline.

Do not pre-extract components that have not yet found their second
consumer. Premature extraction was the failure mode that triggered the
Step 0 work; we will not repeat it here.

## Code locations (for handoff)

- **Page entry:** `src/app/library/page.tsx` (1,210 lines)
- **Internal components in that file:**
  - `CreateFolderModal` (line 112)
  - `MoveToFolderModal` (line 245)
  - `DocumentCard` (line 312)
  - `SearchResultCard` (around line 497)
  - `LibraryContent` (line ~563, main rendered surface)
  - `LibraryLoading` (near end)
- **Sub-routes:**
  - `src/app/library/[docId]/page.tsx` (doc view)
  - `src/app/library/[docId]/edit/page.tsx` (doc edit)
  - `src/app/library/new/page.tsx` (upload)
  - `src/app/library/note/new/page.tsx` (write note)
- **Related components:**
  - `src/components/QuickCreate.tsx` (entry point widget)
  - `src/components/DocumentAccessToggle.tsx` (admin per-doc toggle)
- **API routes called:**
  - `src/app/api/documents/` (list)
  - `src/app/api/documents/[docId]/` (single doc)
  - `src/app/api/doc-snap/` (snapshot / search)
  - `src/app/api/doc-open/` (open / signed URL)
  - `src/app/api/doc-version-metrics/` (version stats)
  - `src/app/api/v1/documents/` (v1 surface)
- **Catalog:** `docs/design-audit/components-catalog.md`
- **Design tokens:** `docs/adr/0004-design-system.md`
