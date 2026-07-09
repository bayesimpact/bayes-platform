# Help Center Rules (Astro — apps/help)

## Scope Confinement: Never Modify Anything Outside `apps/help`

**Rule**: All work on the help center MUST stay inside `apps/help/`. You MUST NOT
create, edit, delete, move, or rename any file outside `apps/help/` — this
includes root config (`biome.json`, `turbo.json`, root `package.json`,
`tsconfig` bases), other apps (`apps/api`, `apps/web`, `apps/web-embed`), and
shared packages (`packages/**`).

- If a task appears to require a change outside `apps/help/` (e.g. a root config
  tweak, wiring `VITE_HELP_CENTER_URL` in `apps/web`, adding a workspace-wide
  dependency), **STOP and ask the user first**. Do not make the change yourself.
- Explain what the outside change would be and why, then let the user decide
  whether to do it themselves or explicitly authorize you for that one change.
- This applies to every tool that mutates files (Write, Edit, mv/rm via shell,
  formatters run with `--write`, etc.). Read-only inspection of files outside
  `apps/help/` is fine.
- Running commands is fine as long as they do not write outside `apps/help/`.
  Prefer scoping commands to this app (e.g. run Biome as
  `npx biome check --write apps/help`, not on the repo root).

**Rationale**: the help center is a self-contained static Astro app. Keeping all
changes within its folder makes the work reviewable in isolation and avoids
unintended side effects on the rest of the monorepo.

---

# Guide Authoring Playbook

Every feature guide is **two paired artifacts** that must stay identical in
**form** (only the content differs — see "Consistency" below):

1. A bilingual MDX doc: `src/content/docs/en/<slug>.mdx` + `src/content/docs/fr/<slug>.mdx`
2. A paired animated walkthrough component: `src/components/<Feature>Walkthrough.astro`

References to copy from (most complete first): `DocumentsWalkthrough.astro`,
`WebSourcesWalkthrough.astro`, `ResourceLibrariesWalkthrough.astro`.

## One-shot recipe

**A source doc is NOT required.** Given only the feature name, one-shot the guide
by reconstructing the flow from the codebase — you already know how the site looks
and how to cut a tutorial into steps. Only ask the user if the feature is
genuinely ambiguous (multiple candidate features share the name). If a doc *is*
provided, follow it exactly; otherwise infer and proceed without asking.

1. **Read the real UI** in `apps/web` (read-only) and reconstruct the flow:
   the feature's route(s), page component(s), dialogs/sheets, table columns, row
   `⋮` actions, bulk actions, empty state, and locales
   `apps/web/src/**/locales/*.{en,fr}.json`. Never guess a label — take exact
   EN + FR strings and the exact icons from the code.
2. **Get exact icons.** For any Lucide icon you're unsure of, fetch it verbatim
   from `https://unpkg.com/lucide-static@0.576.0/icons/<name>.svg` (lucide-react
   is pinned to `^0.576.0`). Never simplify or redraw an icon.
3. **Copy `DocumentsWalkthrough.astro`** → new `<Feature>Walkthrough.astro`.
   Rename the root class prefix everywhere (e.g. `dsw` → `xxw`), swap `STRINGS`,
   the page markup, and the `steps` array. Keep every structural/CSS value.
4. **Write both MDX files** on the skeleton below (EN + FR). Pick the guide
   **sub-category** that matches the feature (see "Guide categories" below) as
   `category`, set `order` = next free integer *within that sub-category*, and
   `updated` = today (ISO).
5. **Build & verify** (see "Validate"). Confirm the `##` skeleton and the
   component's `DUR`/`grid-template-columns` match the sibling guides.

## Deriving the flow & cutting the steps (no doc)

Reconstruct the ordered actions from the code and cut **one animation step per
discrete action or screen** — fine-grained, like the existing guides
(resource-libraries = 10, web-sources = 13, documents = 8 steps). The recurring
shape to look for and reuse:

1. Open **Sources** in the sidebar (backdrop = workspace overview, spot Sources).
2. Select the feature's sub-item (spot it).
3. Primary action on the (empty) page — the top-right button (spot it).
4. The create/upload **dialog**: fill fields / add tag, then confirm (spot confirm,
   observe the fields).
5. The **result** row in the table — wait for `Embedding Status` = Ready where
   relevant (observe the status).
6. Per-row **`⋮` menu** (View / Edit / Recrawl / Download / Delete as applicable)
   — spot the dots.
7. Secondary flows the feature actually has: expand a row, **tag** it (Edit → Add
   tag → Update), **bulk-select** + toolbar (Add tag / Remove tag / Delete),
   **select-all** via the header checkbox, manage **Tags** (Create tag …), attach
   to an agent, etc. Include only what exists in the code; add a numbered step per
   real action.

Keep the backdrop for steps 1–2 = the workspace overview (reuse the `overview`
page markup from `DocumentsWalkthrough.astro`). Mirror the sidebar exactly and set
the active sub-item to the current feature.

## MDX skeleton (identical order, both languages)

```
---
title: <Feature>
description: <one line>
category: <guide sub-category id — see "Guide categories">
order: <next integer within that sub-category>
updated: <YYYY-MM-DD>
---

import <Feature>Walkthrough from "@/components/<Feature>Walkthrough.astro"

<Intro para 1 — what it is>
<Intro para 2 — where it lives: "under Sources…", "belongs to the workspace">

## <Concept>            ← how it works / how agents use it — BEFORE the animation
<one short paragraph>

## The full flow at a glance
The walkthrough below replays every step in the real interface. Use **Prev / Next**
to move at your own pace; each step highlights the button to click and the area to
watch.

<<Feature>Walkthrough lang="en" />   (lang="fr" in the FR file)

## Step by step
### 1. <action>   ← one numbered subsection per animation step, exact button labels
…

## Tips
## Troubleshooting
```

FR headings are fixed translations: `## Le parcours complet en un coup d'œil`,
`## Étape par étape`, `## Conseils`, `## Dépannage`. The concept heading is
feature-specific (e.g. `## Comment les agents utilisent les documents`).

## Guide categories (a `guides` parent with nested sub-categories)

Categories form a **two-level tree** (`src/i18n/categories.ts`): a top-level
category has no `parent`; a sub-category sets `parent`. The **`guides`** parent
holds no docs itself — every guide is filed under one of its sub-categories, which
mirror the Studio left-nav groups and render as indented sub-headers under
**Guides** in the sidebar and home page. Pick the `category` id that matches the
feature:

- **`guides-agents`** — Agents (creating/configuring agents). *Registered, no guide
  yet.*
- **`guides-sources`** — Sources & knowledge (Documents, Web sources, Resource
  libraries, tags).
- **`guides-team`** — Team & access (members, invitations, roles, Admin settings).
- **`guides-eval`** — Evaluation & insights (Evaluations, Review campaigns,
  Analytics). *Registered, no guide yet.*

`order` on a sub-category sorts it within Guides; `order` in a doc's frontmatter
sorts it within its sub-category. Only categories that ultimately contain a doc are
shown (`groupByCategory` builds the tree from the docs present), so the parent and
any still-empty sub-category never produce an empty section. To open a **new**
sub-category, add its entry to `categories.ts` (`parent: "guides"`, bilingual label
+ description, an `icon` from `Icon.astro` — add the Lucide glyph there if missing)
in the same commit as the guide.

## Writing style

- Detailed **and** clear — the text is read by **end users and by AI agents**
  answering questions. Be exhaustive on exact on-screen labels (**bold**), keep
  prose tight.
- **Terminology: always "workspace" / "espace de travail"**, never "project" /
  "projet".
- **Keep platform-hardcoded English labels as-is** even in FR (e.g. the agent
  editor **Resources** tab, **Add library** / its **Search libraries…** /
  **No libraries found**). Flag these in the text when useful.
- **Neutral sample data** — no vertical inferred (see root CLAUDE.md). Use generic
  names (`handbook.pdf`, `example.com`, "Getting started"), not the doc's own
  domain samples (e.g. medical "Patient 1").
- Cross-link sibling guides where relevant (`/en/web-sources`, `/fr/web-sources`).

## Walkthrough component spec (what MUST be identical across all guides)

- **Isolation**: wrap everything in a unique root class (`.rlw` / `.wsw` / `.dsw`
  / …). All CSS is scoped under it. Declare all design tokens locally on that
  class **and** a `:global(html.dark) .<prefix> { … }` dark override so the widget
  follows the site's light/dark toggle. Do NOT add a theme toggle.
- **Shell** (platform `variant="inset"`): `grid-template-columns: 208px 1fr;
  height: 680px`. Left sidebar (see below) + inset card (`.inset`) with a top bar
  (`panel-left` toggle) + dotted `.canvas` + a coral `.fab`.
- **Controls**: **Prev / Next** buttons + `Step X / N` counter + clickable dots +
  play/pause + a progress bar. `const DUR = 6000` (the `progress i.run` CSS
  `var(--dur, 6000ms)` default MUST match).
- **Mechanics**: pages are absolutely-stacked `.page` divs cross-faded via
  `data-active`; `.spot-on` = pulsing coral ring on the **button to click**;
  `.observe-on` = dashed coral outline on the **zone to watch**; `.subwrap.open`
  expands the Sources sub-menu; the active sidebar item is toggled per step;
  honor `prefers-reduced-motion`; **always full page, never zoom**.
- **Data flow**: a `lang` prop selects from a `STRINGS = { en, fr }` table
  (server-rendered text). A `steps` array of `{ page, sources, nav, spot,
  observe, text }` (text from `s.steps[i]`) + `labels` are passed to the client
  script via `<script define:vars={{ steps, labels }}>`. Query the DOM scoped to
  the root (`root.querySelector`), not globally.
- **Icons & logo — exact, never simplified**: use the exact Lucide path for the
  icon the real component uses; use the real brand logo copied verbatim from
  `apps/web/src/common/components/themes/Logo.tsx` (coral `#f18c6e` path + black
  `#010101` circles, with `.logo svg { stroke:none }` + explicit `fill`). SVGs
  injected at runtime via `innerHTML` do NOT receive scoped styles (they render
  `fill:black`) — keep every SVG **static in the template**.

## The Studio sidebar (identical in every walkthrough)

- Header: real Logo + org **Bayes Impact Demo** + **Studio** (coral).
- `AGENTS` group (+ `plus`): **Bayes Assistant** (`bot-message-square`),
  **Conversation Agent** (`bot-message-square`), **Extraction Agent**
  (`scan-text`), **Form Agent** (`form`).
- Settings group: workspace name **Demo** + **Settings/Paramètres**; **Evaluations**
  (`list-checks`, chevron) · **Analytics** (`bar-chart-3`) · **Sources**
  (`database-zap`, chevron) ▸ **Documents** (`file`) / **Web sources** (`globe`) /
  **Resource libraries** (`library-big`) · **Members** (`users`) · **Admin**
  (`settings-2`).
- User footer: **Alex Martin** / `alex.martin@example.com` (`chevrons-up-down`).
- Sample identity is fixed: org `Bayes Impact Demo`, workspace `Demo`, user
  `Alex Martin` / `alex.martin@example.com`.

## Icon map (feature → exact Lucide name)

conversation agent `bot-message-square` · extraction `scan-text` · form `form` ·
Documents `file` · Web sources `globe` · Resource libraries `library-big` ·
Sources group `database-zap` · Evaluations `list-checks` · Analytics `bar-chart-3`
· Members `users` · Admin `settings-2` · Review campaigns `megaphone` · new/add
`plus` · close `x` · back `arrow-left` · card arrow / next `arrow-right` · chevrons
`chevron-right` / `chevron-down` · user `chevrons-up-down` · sidebar toggle
`panel-left` · row menu `ellipsis-vertical` · view `info` · edit `pencil` · delete
`trash-2` · recrawl `refresh-cw` · download `file-down` · upload `upload-cloud` ·
tags (button) `tags` · single tag `tag` · external link `external-link` · check
`check`.

## Known hardcoded-English labels in the product (keep them as-is)

- Agent editor tab is literally **Resources** (not "Resource libraries") —
  `apps/web/.../BaseAgentForm.tsx`.
- Resource library picker: **Add library**, **Search libraries…**, **No libraries
  found** — `apps/web/.../ResourceLibraryPicker.tsx`.

## Consistency (hard rule)

All guides share the **exact same form**, only content differs: the MDX `##`
skeleton, the component shell (208px sidebar, 680px height), controls, `DUR = 6000`,
highlight mechanics, theme handling, terminology, and sample identity must be
byte-for-byte consistent with the existing guides. When adding one, diff its
skeleton and its `DUR`/`grid-template-columns` against the siblings.

## Validate (Astro build; `npx` is NOT on PATH)

```
node ../../node_modules/astro/astro.js build   # run from apps/help; node at "C:\Program Files\nodejs"
```

Then confirm: build is 0-error; the new pages exist in `dist/{en,fr}/<slug>/`; the
component root class appears in the built HTML; the `##` skeleton and component
constants match the sibling guides. `astro check` also works for type-checking.
