# Shared chat, PR 1: texts in a package and the generic compositions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shared package can show translated text, and the five generic compositions the chat uses live once, in `packages/app-ui`, with their translations.

**Architecture:** `packages/app-ui` gets a folder `src/compositions/` for components written by hand, apart from `src/components/`, which stays what the shadcn CLI generates. It gets a Lingui catalog of its own, `src/locales/{locale}.po`, which each app's `lingui.config.ts` declares as a second catalog and each app's `activateLocale` loads with its own. Each app's shell provides the two contexts the compositions read.

**Tech Stack:** React 19, Vite, Lingui 6 (`@lingui/vite-plugin`, `@lingui/babel-plugin-lingui-macro`), Vitest with Testing Library and happy-dom, Tailwind v4, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-11-26-shared-chat-design.md` (sections 1 and 2, and "Delivery", PR 1). The plans of PR 2 and PR 3 are written once this PR is merged, from the names it settles.

## Global Constraints

- The repository is public: no client, no private repository, no internal URL, in code, commits or the PR.
- Never run `npm install`. A new dependency of a package is written in place in `package-lock.json`; `npm ls <name>` then shows it resolved.
- In shell commands, write Evaluation's folder as `apps/ev?l`: the worktree's guard refuses its name spelled out.
- Languages: `en` (source), `fr`, `de`, `it`, `es`, `pl`. A catalog of a package holds all six.
- A person sees no difference in either app: same texts in each language, same saved width of a panel (`desk.sidePanelWidth`, `eval.sidePanelWidth`), same focus, same header.
- A translation is never rewritten: it moves from an app's catalog to the package's, character for character. Both apps agree on every message this PR moves.
- `packages/app-ui/src/components/` holds only what the shadcn CLI generates. Nothing written by hand goes there.
- Inside `packages/app-ui`, a file imports another file of the package by the package's name (`@caseai-connect/app-ui/components/button`), as the CLI writes it.
- The route specs and the stories of both apps change by their imports only. A route spec that needs another change is a behaviour change: stop and report.
- Gates before the PR: `npm run biome:check`, `npm run typecheck`, `npm run check -w @caseai-connect/app-ui`, `npm run check` and `npm run build` of both apps.
- Commits end with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. The work ends with `/end-feature`.
- Approving the spec gave the go for the governed files this PR edits: `lingui.config.ts` of both apps, `docs/frontend/shared-packages.md`, `docs/frontend/conventions.md`, both `AGENTS.md`, ADR 0031 (one amendment line), the root `CLAUDE.md`, `.github/workflows/ci.yml`.

## Review Focus

1. **A production build shows a message id instead of a text.** In production Lingui keeps only the id of a message; a package catalog that is not loaded shows hashes. Expected: the French text. Pinned in Task 1, Step 9.
2. **A package catalog lacks a language of the app.** Expected: a failing spec, before a person sees English in a Polish app. Pinned in Task 2.
3. **A message held by two catalogs gets two translations.** The catalog loaded last wins, silently. Expected: a failing spec. Pinned in Task 2.
4. **A person's saved panel width is lost.** A changed storage key resets every panel to its default. Expected: the key each app used before. Pinned in Task 4.
5. **Evaluation's top bar loses its back link or its actions** after its context is split in two. Expected: both render. Pinned in Task 5.

## File Structure

```text
packages/app-ui/
  package.json                      + exports of compositions and locales, test script, new dependencies
  vitest.config.ts                  new: happy-dom, the Lingui macro
  src/test/setup.ts                 new: English, no catalog, jest-dom
  src/test/render-with-i18n.tsx     new: the package's own render helper
  src/locales/{en,fr,de,it,es,pl}.po  new: the catalog of the package
  src/locales/index.ts              new: LOCALES and loadMessages
  src/locales/po.d.ts               new: the type of a compiled catalog
  src/compositions/                 new: components written by hand, which know no feature
    ExternalLink.tsx
    CopyButton.tsx
    RelativeTime.tsx
    ResizeHandle.tsx (+ spec)
    SidePanel.tsx (+ spec)
    side-panel-storage-key-context.ts
    HeaderActions.tsx
    header-actions-context.ts
  src/styles/globals.css            + @source "../compositions"
apps/desk, apps/eval
  lingui.config.ts                  + the package's catalog
  src/app/i18n.ts                   activateLocale loads both catalogs
  src/app/i18n.spec.ts              + the two specs of Task 2
  src/components/shared/            loses the moved files; the shell provides the contexts
```

---

### Task 1: A catalog in `packages/app-ui`, proven on `ExternalLink`

This task is the spike of the spec. `ExternalLink` shows one message and has no spec: it is the smallest thing that proves the whole path. **If Step 5, 8 or 9 fails because Lingui refuses a catalog outside the app's root, stop: do not work around it, report what failed with its output.** The fallback is a decision of the product owner.

**Files:**
- Create: `packages/app-ui/src/compositions/ExternalLink.tsx`, `packages/app-ui/src/locales/index.ts`, `packages/app-ui/src/locales/po.d.ts`, `packages/app-ui/src/locales/{en,fr,de,it,es,pl}.po`
- Modify: `packages/app-ui/package.json`, `package-lock.json`, `packages/app-ui/src/styles/globals.css`, `apps/desk/lingui.config.ts`, `apps/desk/src/app/i18n.ts`, every Desk file that imports `@/components/shared/ExternalLink`
- Delete: `apps/desk/src/components/shared/ExternalLink.tsx`
- Test: `apps/desk/src/app/i18n.spec.ts`

**Interfaces:**
- Produces: the import path `@caseai-connect/app-ui/compositions/<Name>` (export `"./compositions/*": "./src/compositions/*.tsx"`).
- Produces: `@caseai-connect/app-ui/locales` (export `"./locales": "./src/locales/index.ts"`), with
  `export const LOCALES = ["en", "fr", "de", "it", "es", "pl"] as const`,
  `export type Locale = (typeof LOCALES)[number]` and
  `export async function loadMessages(locale: Locale): Promise<Messages>` (`Messages` from `@lingui/core`), which imports `./${locale}.po`.
- Produces: in each app's `lingui.config.ts`, a second entry of `catalogs`:
  `{ path: "<rootDir>/../../packages/app-ui/src/locales/{locale}", include: ["<rootDir>/../../packages/app-ui/src"] }`.

- [ ] **Step 1: Write the failing test** in `apps/desk/src/app/i18n.spec.ts`

```ts
it("shows a text of a shared package in the language the person picked", async () => {
  await activateLocale("fr")
  // The message of ExternalLink, in the catalog of packages/app-ui.
  expect(i18n._(msg`(opens in a new tab)`)).toBe("(s'ouvre dans un nouvel onglet)")
  await activateLocale("en")
})
```

Take the expected French from `apps/desk/src/locales/fr.po` as it is today; do not retype it. This spec file runs in the `node` project: if `activateLocale` needs `document`, move this one test to a new `src/app/i18n.dom.spec.tsx`.

- [ ] **Step 2: Run it to see it pass for the wrong reason**

Run: `npx vitest run src/app/i18n` in `apps/desk`. Expected: PASS, since the message is still in the Desk's own catalog. It must still pass after Step 6, when the message has left that catalog.

- [ ] **Step 3: Move `ExternalLink`**

Move `apps/desk/src/components/shared/ExternalLink.tsx` to `packages/app-ui/src/compositions/ExternalLink.tsx`. Its comment says "the app", not "the Desk". Rewrite the Desk's imports to `@caseai-connect/app-ui/compositions/ExternalLink`.

- [ ] **Step 4: Wire the package**

In `packages/app-ui/package.json`: the two exports above; `@lingui/core` and `@lingui/react` as peer dependencies (and dev dependencies, at the apps' versions). Mirror them in `package-lock.json`. In `globals.css`, after `@source "../components";`, add `@source "../compositions";`. Add `src/locales/index.ts` and `po.d.ts` (the same `declare module "*.po"` as `apps/desk/src/app/env.d.ts`).

- [ ] **Step 5: Declare the catalog and extract**

Add the second catalog to `apps/desk/lingui.config.ts`. Before extracting, copy the message's five translations: run `npm run i18n:extract -w @caseai-connect/desk`, which creates the six package catalogs with empty translations, then fill `(opens in a new tab)` in each from the Desk's catalog as it was on `main` (`git show origin/main:apps/desk/src/locales/fr.po`).

Expected: `packages/app-ui/src/locales/*.po` exist, each with the one message and its origin `../../packages/app-ui/src/compositions/ExternalLink.tsx`; the message is gone from `apps/desk/src/locales/*.po`.

- [ ] **Step 6: Load both catalogs** in `activateLocale` of `apps/desk/src/app/i18n.ts`

```ts
const [shared, { messages }] = await Promise.all([
  loadMessages(locale),
  import(`../locales/${locale}.po`),
])
// The app's catalog last: it wins for a message both hold.
i18n.loadAndActivate({ locale, messages: { ...shared, ...messages } })
```

- [ ] **Step 7: Run the checks**

Run: `npm run i18n:check -w @caseai-connect/desk`. Expected: exit 0, and it reads both catalogs (empty one translation of the package's `fr.po` to see `check missing` fail, then restore it).
Run: `npx vitest run src/app/i18n` in `apps/desk`. Expected: PASS.

- [ ] **Step 8: Check the dev server**

Run: `npm run storybook -w @caseai-connect/desk` (or the worktree environment's Desk), open a page with a link to a new tab in French. Expected: the French text in the link's accessible name, no error about a catalog in the server's log.

- [ ] **Step 9: Check the production build** (Review Focus 1)

Run: `npm run build -w @caseai-connect/desk`, then `grep -l "s'ouvre dans un nouvel onglet" apps/desk/dist/assets/*.js`.
Expected: one chunk holds the French text.

- [ ] **Step 10: Commit**

`refactor: a catalog of translations in @caseai-connect/app-ui, with ExternalLink`

---

### Task 2: Evaluation loads the catalog, and the specs that guard it

**Files:**
- Modify: `apps/eval/lingui.config.ts`, `apps/eval/src/app/i18n.ts`, Evaluation's imports of `@/components/shared/ExternalLink`, `apps/eval/src/app/i18n.spec.ts`, `apps/desk/src/app/i18n.spec.ts`
- Delete: `apps/eval/src/components/shared/ExternalLink.tsx`
- Create: `packages/app-ui/src/locales/locales.spec.ts`

**Interfaces:**
- Consumes: `LOCALES`, `loadMessages` and the catalog entry of Task 1.

- [ ] **Step 1: Write the failing tests**

In each app's `src/app/i18n.spec.ts`:

```ts
it("has every one of its languages in the catalog of each shared package", () => {
  expect([...SHARED_LOCALES].sort()).toEqual(expect.arrayContaining([...LOCALES].sort()))
})

it("gives one translation to a message that two of its catalogs hold", async () => {
  for (const locale of LOCALES) {
    const shared = await loadMessages(locale)
    const { messages } = await import(`../locales/${locale}.po`)
    for (const id of Object.keys(messages).filter((key) => key in shared))
      expect(messages[id], `${locale}: ${id}`).toEqual(shared[id])
  }
})
```

(`SHARED_LOCALES` is `LOCALES` of `@caseai-connect/app-ui/locales`.) In `packages/app-ui/src/locales/locales.spec.ts`: `LOCALES` equals the `.po` files of the folder, as the apps' first spec does with `import.meta.glob`.

- [ ] **Step 2: Run them.** Expected in Evaluation: the import of `@caseai-connect/app-ui/locales` fails to compile a `.po`, since its `lingui.config.ts` does not declare the catalog yet.

- [ ] **Step 3: Do in Evaluation what Task 1 did in the Desk** (Steps 3, 5 and 6): move its imports, delete its copy, declare the catalog, load both catalogs.

Run `npm run i18n:extract` of Evaluation. Expected: `git diff packages/app-ui/src/locales` is empty: both apps extract the same package catalog.

- [ ] **Step 4: Run both apps' `i18n:check` and i18n specs.** Expected: PASS. Then prove the second spec: give `Cancel` another French translation in the package's catalog (add the message by hand), see it fail, undo.

- [ ] **Step 5: Commit**

`refactor: Evaluation loads the catalog of @caseai-connect/app-ui`

---

### Task 3: `CopyButton` and `RelativeTime`

Both are identical in the two apps and have no spec.

**Files:**
- Create: `packages/app-ui/src/compositions/CopyButton.tsx`, `RelativeTime.tsx`
- Modify: both apps' imports; the six package catalogs; both apps' catalogs
- Delete: the two files in each app's `src/components/shared/`

**Interfaces:**
- Consumes: Task 1's import path and catalog.
- Produces: `CopyButton` and `RelativeTime` with their props of today, unchanged.

- [ ] **Step 1: Move the files**, with `@caseai-connect/frontend-lib` as a new dependency of `packages/app-ui` (`package.json` and lockfile) if they import it, and rewrite both apps' imports.
- [ ] **Step 2: Extract in the Desk, then copy the translations** of `Copied` and `just now` (with its translator comment) from `origin/main`'s catalogs. A message another file of an app still shows stays in that app's catalog too: that is expected, and Task 2's spec guards it.
- [ ] **Step 3: Run** `npm run i18n:check` and `npm run test` of both apps. Expected: PASS, with no spec or story changed beyond imports.
- [ ] **Step 4: Commit** — `refactor: CopyButton and RelativeTime in @caseai-connect/app-ui`

---

### Task 4: `SidePanel` and `ResizeHandle`, with the package's own tests

**Files:**
- Create: `packages/app-ui/src/compositions/SidePanel.tsx`, `SidePanel.spec.tsx`, `ResizeHandle.tsx`, `ResizeHandle.spec.tsx`, `side-panel-storage-key-context.ts`, `packages/app-ui/vitest.config.ts`, `packages/app-ui/src/test/setup.ts`, `packages/app-ui/src/test/render-with-i18n.tsx`
- Modify: `packages/app-ui/package.json` (scripts, dev dependencies), `package-lock.json`, `apps/desk/src/components/shared/DeskShell.tsx`, `apps/eval/src/components/shared/AppShell.tsx`, both apps' imports, the catalogs, `.github/workflows/ci.yml`
- Delete: the four files in each app's `src/components/shared/`

**Interfaces:**
- Produces: `export const SidePanelStorageKeyContext = createContext<string>("sidePanelWidth")` in `side-panel-storage-key-context.ts`, exported as `@caseai-connect/app-ui/compositions/side-panel-storage-key-context` (an explicit entry of `exports`, since the file is `.ts`).
- Produces: `SidePanel` with Evaluation's props: `title`, `description`, `onClose`, `footer`, `children`, and `takesFocus?: boolean` (default `true`). It reads its storage key from the context.
- Produces: scripts of `packages/app-ui`: `"test": "vitest run"` and `"check": "tsc --noEmit && biome check . && vitest run"`.

- [ ] **Step 1: Give the package its tests.** `vitest.config.ts`: happy-dom, `@vitejs/plugin-react` with `@lingui/babel-plugin-lingui-macro`, `include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"]`, `setupFiles: ["src/test/setup.ts"]`. `setup.ts`: jest-dom, `cleanup` after each test, and `i18n.loadAndActivate({ locale: "en", messages: {} })`, so a spec reads the English source. `render-with-i18n.tsx`: `renderWithI18n(ui: ReactElement)`, as the apps' helper. If the macro plugin asks for a Lingui configuration, give the package a `lingui.config.ts` with `sourceLocale` and `locales` only, and no extract script: the apps extract.

- [ ] **Step 2: Move the two specs and write the failing ones.** Start from Evaluation's `SidePanel.spec.tsx`, and add to it what only the Desk's has. Add:

```tsx
it("keeps its width under the key its shell gives", async () => {
  renderWithI18n(
    <SidePanelStorageKeyContext value="desk.sidePanelWidth">
      <PanelInSidebar />
    </SidePanelStorageKeyContext>,
  )
  // Widen the panel with its handle, as ResizeHandle.spec.tsx does.
  expect(window.localStorage.getItem("desk.sidePanelWidth")).not.toBeNull()
  expect(window.localStorage.getItem("sidePanelWidth")).toBeNull()
})

it("leaves the focus where it is when it does not take it", () => {
  // takesFocus={false}: document.activeElement stays the button that had it.
})
```

- [ ] **Step 3: Run them.** `npx vitest run` in `packages/app-ui`. Expected: FAIL, the modules do not exist.

- [ ] **Step 4: Move `ResizeHandle` and `SidePanel`** from Evaluation's copies (the superset), with the storage key read from the context. Rewrite both apps' imports.

- [ ] **Step 5: Each shell provides its key** (Review Focus 4). `DeskShell` wraps its page in `<SidePanelStorageKeyContext value="desk.sidePanelWidth">`, `AppShell` in `value="eval.sidePanelWidth"`.

- [ ] **Step 6: Extract, and copy the translations** of `Resize the panel` and `Close the panel`.

- [ ] **Step 7: Run** `npm run check -w @caseai-connect/app-ui` and `npm run test` of both apps. Expected: PASS.

- [ ] **Step 8: CI runs the package's specs.** In `.github/workflows/ci.yml`, in the `desk-tests` job, after "Run frontend lib tests":

```yaml
      # The shadcn components and the compositions the Desk and Evaluation share.
      - name: Run app-ui tests
        if: needs.changes.outputs.desk-tests == 'true'
        run: npm run test --workspace=@caseai-connect/app-ui
```

- [ ] **Step 9: Commit** — `refactor: SidePanel and ResizeHandle in @caseai-connect/app-ui, with its specs`

---

### Task 5: `HeaderActions`, and Evaluation's top bar

**Files:**
- Create: `packages/app-ui/src/compositions/HeaderActions.tsx`, `header-actions-context.ts`
- Modify: `apps/desk/src/components/shared/DeskShell.tsx`, `apps/eval/src/components/shared/AppShell.tsx`, `apps/eval/src/components/shared/HeaderBack.tsx`, both apps' imports
- Create: `apps/eval/src/components/shared/header-back-context.ts`, `apps/eval/src/components/shared/AppShell.spec.tsx` (the shell has no spec today; its top bar is a `<header>`, the `banner` of the page)
- Delete: `HeaderActions.tsx` in both apps, `apps/desk/src/components/shared/header-actions-context.ts`, `apps/eval/src/components/shared/header-slots-context.ts`

**Interfaces:**
- Produces: `export const HeaderActionsContext = createContext<HTMLElement | null>(null)`, exported as `@caseai-connect/app-ui/compositions/header-actions-context`; `HeaderActions({ children })`, the Desk's file as it is.
- Produces, in Evaluation only: `export const HeaderBackContext = createContext<HTMLElement | null>(null)` in `header-back-context.ts`, which `HeaderBack` reads.

- [ ] **Step 1: Write the failing test** (Review Focus 5), in Evaluation's `AppShell.spec.tsx`

```tsx
it("puts a page's back link at the start of the bar and its actions at the end", () => {
  // Render AppShell around a page that renders
  // <HeaderBack><a href="/x">Back</a></HeaderBack> and
  // <HeaderActions><button type="button">Export</button></HeaderActions>.
  const bar = screen.getByRole("banner")
  expect(within(bar).getByRole("link", { name: "Back" })).toBeVisible()
  expect(within(bar).getByRole("button", { name: "Export" })).toBeVisible()
})
```

- [ ] **Step 2: Run it on today's code.** Expected: PASS. It is the net for the refactor: it must still pass after Step 4.
- [ ] **Step 3: Move `HeaderActions` and its context** from the Desk's copies, and rewrite both apps' imports. `DeskShell` provides the package's context.
- [ ] **Step 4: Split Evaluation's context.** `AppShell` provides `HeaderActionsContext` with its actions element and `HeaderBackContext` with its back element. `HeaderBack` reads `HeaderBackContext`.
- [ ] **Step 5: Run** `npm run test` of both apps. Expected: PASS, route specs and stories unchanged beyond imports.
- [ ] **Step 6: Commit** — `refactor: HeaderActions in @caseai-connect/app-ui, and a context of its own for Evaluation's back link`

---

### Task 6: The docs, then the PR

**Files:**
- Modify: `docs/frontend/shared-packages.md`, `docs/frontend/conventions.md`, `apps/desk/AGENTS.md`, `apps/eval/AGENTS.md`, `docs/adr/0031-frontend-stack-for-agent-built-apps.md`, `CLAUDE.md`

- [ ] **Step 1: `docs/frontend/shared-packages.md`.**
  - Row `app-ui`, "Holds": add "compositions written by hand that know no feature (`src/compositions/`: `SidePanel`, `HeaderActions`, `CopyButton`, `RelativeTime`, `ExternalLink`) and their catalog of translations". "May depend on": add `frontend-lib`, Lingui as a peer. "Must not hold": "in `src/components/`, a component the shadcn CLI did not generate; in `src/compositions/`, a component that knows a feature or that one app alone uses; business logic".
  - Limits, the bullet on text: a shared package shows text only when it has a catalog of its own (`src/locales/`), which each app's `lingui.config.ts` declares and each app's `activateLocale` loads; a text that names an app stays in the app.
  - "Build and checks": `app-ui` now has specs, which CI runs in the Desk's job.
  - "Adding a shared package": a step for a package that shows text (the catalog entry in each app's `lingui.config.ts`, `loadMessages`, the two specs of each app's `i18n.spec.ts`).
- [ ] **Step 2: `docs/frontend/conventions.md`**, "Text and translations": `i18n:extract` of an app also writes the catalogs of the shared packages; a text of a shared package is translated there, once.
- [ ] **Step 3: Both `AGENTS.md`**: the "Shared compositions" bullets name what is left in `src/components/shared/` and point to `@caseai-connect/app-ui/compositions` for what moved.
- [ ] **Step 4: ADR 0031**: one amendment line and three sentences in section 2.4 on why the compositions and their texts are shared. `CLAUDE.md`: nothing lists the packages' contents any more; change it only if a sentence is now false.
- [ ] **Step 5: Run the gates** of "Global Constraints". Expected: all exit 0.
- [ ] **Step 6: Run `/end-feature`**: no changelog entry (a refactor), both convention reviews, the PR.

## After this PR

PR 2 (the chat object and the calls to the API) and PR 3 (the components, the chat's catalog, the end of the parity check) each get a plan of their own, written from `main` once the PR before is merged. `packages/chat` then takes the catalog mechanism of this PR as it stands.
