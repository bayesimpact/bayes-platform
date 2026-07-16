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

# When asked to "make a guide" — the one-shot checklist

This is the authoritative procedure. Follow it end-to-end; the sections below are the
detail. Everything here was learned the hard way — don't skip a step.

1. **Scope.** Only touch `apps/help/`. Anything outside → STOP and ask (§Scope
   Confinement).
2. **Feature & placement.** Map the feature to a `guides-*` sub-category
   (§Guide categories); `order` = next free integer within it; pick EN+FR slugs. Only
   ask the user if the feature name is genuinely ambiguous (several candidates share
   it) — otherwise infer and proceed.
3. **Derive from the CURRENT code — never from memory or an earlier read**
   (§Fidelity method, Phase 0–1). Re-read the real components NOW (the code moves);
   follow imports from the feature's entry component. Write the **render inventory**:
   every screen / dialog / tab / field AND its render condition (feature flag,
   project state). Depict the **fully-provisioned superset** and annotate the
   conditional surfaces — **never silently drop one** (that's how tabs get missed).
4. **Labels & icons verbatim** (§Fidelity Phase 2, §Writing style): copy each label
   from the **EN + FR** locale files; exact Lucide names/paths; keep
   hardcoded-English labels as-is; **neutral** sample data; terminology is always
   **"workspace" / "espace de travail"**, never "project".
5. **Build the walkthrough** = a NEW hand-built `*Walkthrough.astro` with a **unique
   scoped root class**. Copy only the shared **FORM** (208px/680px shell, controls,
   `DUR = 6000`, spot/observe mechanics, the Studio sidebar with the **Settings group
   anchored to the bottom**). Use the **PRODUCT coral palette, pinned locally** —
   never the site's Bayes beige/gold, never global tokens, never real-component
   markup (§Walkthrough animations, §Consistency). **Re-derive the content** (tabs /
   fields / labels / steps) for THIS feature; never copy a sibling guide's content
   without re-verifying it against the code.
6. **Model state consequences** (§Actions have consequences): the animation's state
   must change with the actions — a created agent appears (active) in the sidebar, an
   uploaded document becomes a row, an invite becomes a Pending entry, etc.
7. **Write both MDX** (EN + FR) on the skeleton (§MDX skeleton), importing the
   walkthrough; one `### n` sub-section per animation step. **Exhaustive by rule —
   no step omitted** (§Writing style → Level of detail): from the entry point to the
   final result, every screen/dialog/tab/field/label in bold verbatim, serving end
   users *and* AI agents. If it's not in the guide, the AI cannot answer it.
8. **Verify — the gate** (§Fidelity Phase 5, §Validate): `astro build` **and**
   `astro check` at 0 errors; grep the built HTML for **every** tab/label; **diff the
   tab set (count + order) against the component**; confirm the pages render.
9. **Guard** (§Fidelity Phase 6): header comment in the `.astro` naming the source
   components + the date; re-run the inventory on any later edit.

Golden rule: put nothing in a guide you can't point to in the code (component, locale
key, icon) — and prove it in the Phase-5 check before saying it's done. Conversely,
leave **nothing out**: a guide is complete only when a first-time user could finish
the feature end-to-end from it *and* an AI agent could answer any "where is X / how
do I Y" from its words alone (§Writing style → Level of detail). The **site chrome**
is the Bayes brand DA (§Design System); the **animations** are not — they stay
Studio/coral.

---

# Design System — Bayes brand DA (light-only)

The help center follows the **Bayes Impact brand DA** (bayesimpact.org), NOT a
generic docs/shadcn theme. **Source of truth: `@bayes/ui` `tokens.css` +
`components.css`** (the website's shared files) — values are *mirrored, never
reinvented*. Everything below lives in `src/styles/global.css` unless noted.

## Tokens (values in `global.css`, keep the shadcn `--color-*` names)

- Surface **beige `#F2EFE9`** (`--background`) · ink **`#000`** text
  (`--foreground`) · cards **`#FFF`** (`--card`) · cream **`#F7F7F2`**
  (`--secondary`/`--muted`) · muted text **`#657180`** (`--muted-foreground`).
- **Gold `#DBCCAF`** = hairlines/borders (`--border`, `--input`) and the brand
  accent surface.
- **Orange `#FF8400`** (`--primary`, `--accent-orange`) = **PUNCTUATION ONLY** —
  eyebrow text, focus ring, active dot/rule, link hover. Never large orange fills,
  never orange body text/buttons.
- Emphasis highlight = gold marker **`#EBE092`** (`--gold-mark`, via `.hl` /
  `<mark>`); in-text link accent = gold-deep **`#9A6F24`** (`--gold-deep`).
- Radius **14px** (`--radius`).
- Because the token *names* stay shadcn-compatible, **use the Tailwind utilities**
  (`bg-background`, `text-foreground`, `border-border`, `bg-card`, `bg-secondary`,
  `text-muted-foreground`, `bg-primary`) — **never hardcode a hex in a component.**
  Missing token? Add it by mirroring `@bayes/ui`, don't guess a colour.

## Typography

- Body: **Inter** (`--font-sans`). Display/titles: **Archivo Black** via the
  `.font-display` class (home hero, article H1, prose `h2`). Serif available:
  **Kaisei Decol** (`--font-serif`). Headings are **not** uppercase.
- Google Fonts are loaded in `BaseLayout.astro` (Inter / Archivo Black / Kaisei).

## Component vocabulary (`global.css @layer components`, from `@bayes/ui`)

- **Buttons** — pills: `.btn` + `.btn-primary` (ink bg / beige text), `.btn-outline`,
  size `.btn-sm`.
- **`.eyebrow`** (uppercase tracked, orange) · **`.label`** (same, muted) ·
  **`.pill`** (gold-bordered chip) · **`.chip`** (cream tag).
- **Cards**: white + `border-border` (gold) + `rounded-[14px]` + hover lift &
  soft shadow.

## Chrome patterns

- **Header** container is `max-w-[96rem] px-4 sm:px-6` — it MUST match
  `DocsLayout.astro` so the logo aligns with the sidebar's left edge. "Back to app"
  is a `.btn-outline .btn-sm` pill.
- **Footer** is a near-black brand surface (`#0e0e13`, light text) — a design
  surface, not a theme.
- **Language switcher**: globe + current code (`EN`/`FR`) + chevron; menu lists
  full names, the active one is **bold + `bg-secondary`** (NO check icon —
  bayesimpact.org has none).

## Hard rules

- **Light-only. NEVER reintroduce dark mode.** No `.dark` block, no `dark:`
  utilities, no `@custom-variant dark`, no `prefers-color-scheme`, no theme toggle.
  It was removed on purpose. (The platform itself has no user light/dark toggle
  either — its "theme" is a brand *colour* key, `coral`.)
- **Orange = punctuation, gold = accent.** Don't turn buttons or links orange.
- Match bayesimpact.org / `@bayes/ui`; when in doubt, look at those files.

## Walkthrough animations are the EXCEPTION — they use the PRODUCT palette

Every `*Walkthrough.astro` widget is a **hand-built replica** that declares the
platform palette (coral `--primary`, neutral greys) on its **own scoped root class**
(`.msw` / `.anw` / `.caw` / …), so the site-wide Bayes beige/gold rebrand never leaks
in — the animation must look like **apps/web / `packages/ui`** Studio, NOT the brand
DA. Do NOT restyle animations to beige/gold, and do NOT mix in a different form:
every widget shares the same shell (208px sidebar, 680px height), controls,
`DUR = 6000`, and mechanics (see "Consistency" below). A one-off that uses global
tokens or the real component markup will clash with the other guides — don't.

---

# Fidelity method — derive from the real components, verify, never copy blind

Animations are hand-built HTML replicas of the platform. They drift and miss things
(conditional tabs, renamed fields, per-tab behaviour) unless authored against the
**current** code with a verification gate. Follow this every time.

## Per-animation procedure

- **Phase 0 — Freshness.** Re-read the target components **now** — the code moves
  (merges, refactors). Never trust an earlier read. From the feature's entry
  component, follow the imports to the components that actually render.
- **Phase 1 — Render inventory (before any HTML).** Write the real structure:
  route(s), screens/dialogs, and for every container (e.g. a tab list) **list EVERY
  item AND its render condition** (always / feature-flag X / project-state Y).
  Depict the **fully-provisioned superset** and annotate the conditional ones —
  never silently drop a conditional surface (that's how the orchestration/embed
  tabs got missed).
- **Phase 2 — Labels & icons verbatim.** Copy each label from the **EN + FR** locale
  files (note where from); exact Lucide names/paths; keep hardcoded-English labels
  as-is; neutral sample data.
- **Phase 3 — Cut the steps.** One step per action/screen, covering **every**
  inventory item. An inventoried surface with no step is a gap to fill.
- **Phase 4 — Build.** Reuse only the shared shell/mechanics/CSS; **re-derive the
  content** (tabs, fields, labels, steps) for THIS feature — never copy a sibling
  guide's content without re-verifying it against this feature's code.
- **Phase 5 — Verify against the code (the gate).** 1:1 checklist inventory→replica;
  **diff the tab set (count + order) against the component**; grep the built HTML for
  every tab label; `astro build` + `astro check` at 0 errors.
- **Phase 6 — Guard.** Record the source components + date in a header comment in the
  `.astro` file; re-run Phase 1 on any future edit.

**Golden rule:** put nothing in an animation you can't point to in the code
(component, locale key, icon) — and prove it in the Phase-5 checklist before finishing.

## Actions have state consequences

The animation's state must evolve with the actions, like the real app:

- Creating an agent → it appears in the **AGENTS** sidebar list and becomes the
  **active** item from the editor steps on (see `navNewAgent` in the agent
  walkthroughs: a hidden nav item revealed + `.on` once `step.page` is an editor
  page).
- Uploading a document → a new table row; sending an invite → a **Pending** entry
  then a member card; etc.

Model these per step (reveal/activate elements as the flow progresses) — a static
sidebar/table through a create flow is a fidelity bug.

## Studio sidebar layout (all walkthroughs)

The **SETTINGS** group (workspace name + Evaluations / Analytics / Sources / Members
/ Admin) is anchored to the **bottom**: the AGENTS list fills the space and pushes it
down, mirroring the platform (`SidebarContent` is `flex-1`). Implement with
`.grp-label.stack { margin-top: auto }`. The active nav item uses
`bg-sidebar-accent`.

## Agent editor reference (verified 2026-07-13 — RE-VERIFY before reuse)

Source of truth: `AgentCreator.tsx` (dialog) + `AgentEditor.tsx` (tab order &
conditions) + each `Agent*Tab.tsx`.

- **Create:** New Agent dialog → **Agent type** [Conversation / Extraction / Form] →
  **Name** (≥3 chars) → **Create** → navigates to the editor. Conversation is the
  default type.
- **Editor = tabs; each tab is its own form with its own `Save` button
  (`actions:save`)** — EXCEPT the **Embed** tab, which saves with **`Update`**
  (`actions:update`). Leaving a tab with unsaved changes prompts a confirm dialog.
- **Conversation** tabs: General, Model, Sources, Resource libraries, then
  **Conversation categories** (only if the project has categories), **Orchestration**
  (flag `agent-orchestration`), **Embed** (flag `agent-embed`).
- **Extraction / Form** (non-conversation): General, Model, **Output** (labeled
  **Form** for form agents). No Sources / Resource libraries / Categories /
  Orchestration / Embed.
- **General** fields: Name, Locale, **Greeting** (conversation & form only),
  **Instructions** (`agent:props.instructions` — NOT "Default Prompt", renamed). ·
  **Model:** Model, Temperature. · **Sources:** Answer source (`documentsRagMode`:
  model-only / all documents / by tags) + Document Tags. · **Resource libraries:**
  label `resourceLibrary:agentTab.label`, **Add library** (hardcoded EN), **Manage
  libraries**.

---

# Guide Authoring Playbook

Every feature guide is **two paired artifacts** that must stay identical in
**form** (only the content differs — see "Consistency" below):

1. A bilingual MDX doc: `src/content/docs/en/<slug>.mdx` + `src/content/docs/fr/<slug>.mdx`
2. A paired animated walkthrough component: `src/components/<Feature>Walkthrough.astro`

References to copy from (most complete first): `DocumentsWalkthrough.astro`,
`WebSourcesWalkthrough.astro`, `ResourceLibrariesWalkthrough.astro`.

## One-shot recipe

This expands step 3–8 of the master checklist above. **A source doc is NOT required**
— but do NOT reconstruct from memory: **derive the flow from the CURRENT `apps/web`
code every time** (re-read it now — it moves), following the Fidelity method
(inventory → verbatim labels → verify). Only ask the user if the feature name is
genuinely ambiguous (several candidates share it). If a doc *is* provided, follow it
exactly; otherwise infer from the code and proceed without asking.

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

### Level of detail (non-negotiable)

Guides are read by **two audiences at once**, and must serve both fully:

- **End users** following along click-by-click in the real UI — they need every
  concrete action named.
- **AI agents** answering questions from the guide text alone — they can only state
  what the text says, so anything omitted becomes an answer they cannot give.

Therefore:

- **No step may be omitted or glossed over.** Document the flow from the very first
  entry point to the final result — how the user *gets to* the feature (which app /
  card / sidebar item / button, with its exact label and icon), every screen, dialog,
  tab, field, toggle, dropdown option, and confirmation, and what happens after each
  action. If clicking something opens a dialog, the dialog is its own step. If a page
  has three tabs, all three are covered. "Obvious" intermediate steps are still
  written — the AI agent and the first-time user do not find them obvious.
- **One numbered `### n` sub-section per discrete action or screen**, matching the
  walkthrough steps 1:1 (see §Deriving the flow & cutting the steps). A screen shown
  in the animation with no matching prose section is a gap to fix.
- **Every on-screen label appears verbatim and in bold** — buttons, tabs, fields,
  menu items, empty-state text, status badges, validation messages — in both EN and
  FR, taken from the locale files (§Fidelity Phase 2). Never paraphrase a label.
- **Name the exact control**: "click **Run Evaluation** (top right)", not "start the
  run". State where it is (top-right, in the row's `⋮` menu, in the editor header)
  and what it does.
- **Cover conditional and edge surfaces**, not just the happy path: empty states,
  disabled/greyed buttons and why, feature-flag-gated screens (annotate them as
  optional/"if enabled"), and the **Troubleshooting** entries for each way a step can
  stall or fail.
- Keep prose **tight** — exhaustive coverage does not mean verbose sentences. Short,
  direct, label-dense; use numbered/bulleted sub-lists inside a step when it has
  several fields.

**Litmus test before finishing:** could a user who has never opened the feature
complete it end-to-end from the guide alone, and could an AI agent answer "where is
X / how do I do Y" for every X and Y in the feature, using only the guide's words? If
not, a step or label is missing.

### Other rules

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
