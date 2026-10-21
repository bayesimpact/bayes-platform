# ADR 0031: The frontend stack for agent-built apps, starting with the Desk

* **Status**: Proposed
* **Date**: 2026-10-20
* **Deciders**: Alexis
* **Amends**: [ADR 0010](0010-factory-per-model-and-story-per-route.md),
  [ADR 0011](0011-frontend-architecture.md) and [ADR 0012](0012-form-architecture.md), which keep
  governing `apps/web` until each of its apps is rebuilt on this stack, and
  [ADR 0025](0025-worktree-dev-environments.md) (a `desk` service in each environment)
* **Scope**: every frontend rebuilt from now on. First: `apps/desk` and `packages/desk-contracts`
  (new), `apps/api/src/domains/desk/` and `apps/api/src/common/schema-route/` (new), a context
  module in `apps/api/src/common/context/`, `docs/frontend/conventions.md` (new), the serving of web
  apps in `apps/api/src/common/web-app/`, `apps/api/Dockerfile` and the Helm chart (the Desk's
  theme mount), `apps/api/.dependency-cruiser.cjs`, the link of agent invitations
  (`apps/api/src/domains/invitations/` and Studio's copy button), `infra/worktree/`,
  `infra/oidc-picker/`, `infra/keycloak/`, `.github/workflows/ci.yml`, and `apps/web/src/desk/`
  (deleted at the cutover).

---

## 1. Context

Every frontend of the platform will be rebuilt on a new stack, one app at a time: the Desk first,
then Studio, evaluation, review campaigns and the conversation apps. Coding agents write most of
that code, so the stack and its rules are chosen for them first: an agent should be right the first
time, and know it at once when it is not.

The Desk is where project members use published agents: an agent grid, conversations with streamed
replies, memories, document and CSV extraction runs. Today it is the `desk` scope of `apps/web`.
`apps/web/src/desk` holds 11 files, but its routes import 249 modules at runtime, 62 of them from
Studio features, because Desk screens reuse Studio code. Counting type imports, through Redux store
types that aggregate every scope, they reach 466. It follows ADR 0011 (slices, thunks, listener
middleware, SPI services). Across its screens the Desk calls 45 distinct API endpoints, on routes
shaped for Studio, some of them reads sent as POST, and opening one conversation takes a waterfall
of about ten requests, some sent twice. Responses are typed at compile time only: `defineRoute`
carries phantom types, the DTO types are written by hand, and nothing parses a response at
runtime. Among the routes the Desk calls, Zod checks only two request bodies. Components show text
through i18next keys (`t("agentSession.delete.title")`), so neither a reader nor an agent sees the
words on screen in the code.

The new stack takes the stack and conventions of the `new-webapp` skill of the webapp kit (version
1.0.0), a starter that coding agents follow to build React apps. This ADR adopts its frontend
rules: TanStack Router and Query, React Hook Form with Zod, Tailwind and shadcn/ui, Vitest, MSW and
Playwright, boundaries checked by tools, and conventions that agents load from `AGENTS.md`. The
skill only starts empty folders, so it is not run here: this ADR carries its rules over by hand.
Three constraints frame the work:

* The Desk is an app of its own. It shares no code with `apps/web` or Studio: its code, its
  packages, its endpoints and its DTOs are its own.
* The NestJS API and `packages/api-contracts` keep their conventions, routes and DTOs. The Desk's
  endpoints sit next to the existing ones and call the same domain services.
* Every Desk endpoint has a Zod schema for what it receives and for what it returns.

Part of what the kit assumes does not hold here: one Cloudflare Worker that serves a Hono API, a
client typed by Hono inference (`hc<AppType>`), Better Auth or Supabase for sign-in, pnpm,
TypeScript 7, RFC 9457 errors and cursor pagination. Its single origin for the app and the API does
hold (section 2.14). The kit also leaves out what this product needs: OpenID Connect sign-in,
organizations and projects with role-based permissions, streamed LLM replies and long extraction
runs, French and English, one build configured at runtime for every install, and a monorepo.
Section 2 keeps the kit's frontend rules, replaces those parts and says where it departs from the
kit.

## 2. Decision

**Every frontend is rebuilt, one app at a time, as an app of its own, on the stack and the rules
below, chosen for coding agents. The Desk comes first: it becomes `apps/desk`, a Vite SPA served by
the API at `/app`, which shares no code with `apps/web`. Its contracts live in
`packages/desk-contracts`, and it calls only Desk endpoints. Each endpoint has Zod schemas for its
params, query, body, response and stream events, and both the API and the Desk enforce them at
runtime.**

### 2.1 Built for coding agents

* **An app is a closed world.** An agent working on the Desk reads the Desk, its contracts package
  and the endpoints behind it, and nothing else. No component, helper or rule of another app applies
  to it, and a change in another app cannot break it.
* **A tool checks every rule it can.** TypeScript in strict mode, Biome, dependency-cruiser, knip,
  the Zod schemas, the translation checks and the tests turn a broken rule into an error message.
  Prose rules are kept for what no tool sees. One command, `check`, gives the verdict and stays fast
  enough to run after every change.
* **The code says what it does where it does it.** English text sits in the components, a route's
  file path is its URL, a feature lives in one folder, types come from the schemas, and no
  injection layer stands between a component and the API. Named exports and one component per file
  named like it make every symbol and every string on screen greppable.
* **One way to do each thing.** Every app on the stack follows the same conventions, written once,
  and two recipes cover most changes.
* **An agent can see its work.** Storybook renders every screen without the API, a worktree
  environment runs the real stack, and Playwright drives both.
* **Well-known libraries, read before use.** The stack sticks to libraries with large and current
  documentation, and an agent reads that documentation before it uses an API.

### 2.2 Stack

| Layer | Choice |
|---|---|
| App | React 19 with the React Compiler, Vite, TypeScript in strict mode |
| Routing | TanStack Router, file-based through its Vite plugin, base path `/app` |
| Server state | TanStack Query |
| API client | One `fetch` wrapper driven by the route objects and their schemas |
| Validation | Zod 4, schemas shared with the API through `@caseai-connect/desk-contracts` |
| Forms | React Hook Form, `zodResolver`, shadcn `Field` components |
| Tables | TanStack Table v8 (section 2.3), rendered with the shadcn `Table` |
| Text | Lingui: English in the components, French in a PO catalog (section 2.10) |
| UI | Tailwind CSS v4 and shadcn/ui components on Base UI, generated into the Desk, `cva`, `cn()`, lucide-react, sonner |
| Sign-in | `oidc-client-ts`, in the Desk's own sign-in module (section 2.9) |
| Tests | Vitest with Testing Library and happy-dom, MSW 2, Storybook 10 (section 2.11), Playwright |
| Quality | Biome, dependency-cruiser, knip |

No Redux, react-router, axios, i18next or Radix. Zustand is the only client store
allowed, for real global client state and with a human's go.

### 2.3 Versions and monorepo tooling

The kit installs the latest versions with pnpm and TypeScript 7. The Desk joins the npm workspaces
instead, as `@caseai-connect/desk` (private, 0.0.0). The shared lockfile and the root tooling
(Biome, turbo, CI) are the only ties it keeps with the other workspaces:

* npm is the only package manager, and the root `package-lock.json` the only lockfile. Commands are
  npm ones (`npm run <script> -w @caseai-connect/desk`, `npx`). No git hook: CI is the gate, as for
  the rest of the repo.
* Runtime libraries keep one copy in the lockfile. The Desk's ranges admit the versions the
  monorepo resolves (React `^19.2.0`, Tailwind, React Hook Form and its resolvers, Vite, Vitest,
  TypeScript, Biome), so the browser bundle holds a single React and a single Zod, with no
  `resolve.dedupe`. A shared library moves for every workspace at once, in the
  [monthly dependency check](../monthly-dependency-check.md).
* A library new to the monorepo enters at its latest stable version: TanStack Router and Query,
  Lingui, Base UI, Testing Library's React package, happy-dom, Playwright, knip. Three choices
  follow from the lockfile. TanStack Table uses the v8 of `apps/web`, one copy for both: v8
  changes its table in place, which the React Compiler cannot memoize, so the components that call
  `useReactTable` opt out of it with `"use no memo"`, until a move to v9, the first version
  compatible with the compiler. Storybook uses the 10 of `apps/web` too. MSW stays on 2, which
  the monorepo's Vitest 4 expects, and moves to 3 with Vitest 5. Component tests use happy-dom,
  since jsdom 30 nests under `apps/desk` and moves the `undici` the API runs on.
* The latest TanStack Router plugin and knip need Zod 4.6, so the Desk moves the hoisted Zod from
  4.4.3 to 4.6.7 for every workspace, the API included. The PR that adds them runs the API suite,
  as does any Desk PR whose lockfile moves a version the API loads.
* The Desk's dependencies arrive in one deliberate update of the existing `package-lock.json`,
  with npm 11 as in the images. Regenerating the lockfile over a filled `node_modules` drops Linux
  binaries, and `--legacy-peer-deps` prunes peers the API needs, so neither is used. The diff also
  carries about a hundred lines of flag churn. `@hookform/resolvers` stays on 5, since 6.0.0 fails
  to install on a peer conflict.
* The Desk uses TypeScript 5.9, as `apps/web` does: TypeScript 7.0 ships without a compiler API,
  which dependency-cruiser, the Nest CLI and ts-jest still need. The kit's fallback, TypeScript 7's
  `tsc` beside TypeScript 6 for the tools, is not used either: its `@typescript/native` alias
  hoists and takes over the `tsc` of every workspace without a TypeScript of its own, whose
  `baseUrl` TypeScript 7 rejects.
* The Desk's tsconfig is already written for 7: `moduleResolution: "bundler"`, no `baseUrl`,
  relative `paths` (`@/*` to `./src/*`), `strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`,
  `erasableSyntaxOnly`, `noUnusedLocals` and `noUnusedParameters`, and never `ignoreDeprecations`.
  App code compiles with the DOM lib and without Node types, and config files have a tsconfig of
  their own. `erasableSyntaxOnly` holds because neither the Desk nor its contracts declare an enum
  or import `packages/api-contracts`, whose shared files still declare some.
* `vite.config.ts` declares the same `@/*` alias and lists `tanstackRouter()`, then `react()` with
  Lingui's macro plugin before the React Compiler in its Babel plugins, then `lingui()` and
  `tailwindcss()`. The contracts resolve through the `exports` of `packages/desk-contracts`, with no
  alias.
* The root Biome configuration stays. `apps/desk/biome.json` extends it with
  `"root": false, "extends": "//"`, adds the kit's stricter rules for Desk code (no enum, no
  non-null assertion, no default export outside config files, no `console.log`) and ignores the
  generated `routeTree.gen.ts`, as knip does. That file is committed, so CI can typecheck without
  running Vite.

### 2.4 Folders and boundaries

```text
apps/desk/
  AGENTS.md, CLAUDE.md      what is specific to the Desk; CLAUDE.md imports the shared rules too
  public/theme/             default theme files, replaced by each install's own
  src/
    app/                    config (Zod-validated), query client, router, providers, i18n
    routes/                 thin file-based routes; routeTree.gen.ts is generated
    features/<feature>/
      api/                  keys.ts, queries.ts, mutations.ts
      components/           components of the feature, skeletons included
      hooks/                hooks that do not touch the network
      schemas.ts            schemas of the app only: a form with no endpoint, a .refine
      index.ts              what the rest of the app may import, and nothing more
    components/ui/          shadcn components, generated by its CLI
    components/shared/      DataTable, ConfirmDialog, FileDropzone and other compositions
    lib/                    api-client.ts, stream.ts, auth/, utils.ts
    locales/                en.po (source), fr.po
    styles/                 global.css: Tailwind and the design tokens
    test/                   setup, MSW handlers, fixture factories
  e2e/                      Playwright journeys
packages/desk-contracts/    the Desk's routes and Zod schemas, shared with the API
```

dependency-cruiser enforces the direction of imports between the folders of `src/`:

* `routes/` imports feature `index.ts` files, `components/`, `lib/` and `app/`.
* A feature imports another feature through its `index.ts` only, and preferably not at all: shared
  code moves to `lib/` or `components/shared/`.
* `components/` and `lib/` import neither `features/` nor `routes/`.
* The Desk imports nothing from another app or from a package another app owns: `apps/web`,
  `apps/api`, `packages/ui` and `packages/api-contracts` are out of bounds. Its only workspace
  dependency is `@caseai-connect/desk-contracts`. Only `lib/auth/` imports `oidc-client-ts`.
* No cycles.

knip reports unused files, exports and dependencies. Both tools run in the Desk's
`check:boundaries` script, which CI already runs through turbo. They only see imports, so these
boundaries can still be bypassed (section 6).

The Desk shares no code with the other apps: what it needs lives in it, even where `apps/web` has
its own version. Whether the apps of the new stack share code with each other is decided when the
second one starts (section 7).

### 2.5 Code conventions

* **TypeScript.** No `any`, `@ts-ignore` or `!` assertion. An `as` carries a comment that proves it
  safe, and a `@ts-expect-error` a comment that explains it. Types are derived (`z.input`,
  `z.output`, router inference) and never redeclared. `type` by default, `interface` only to extend
  another interface, `import type` for types, and string unions or `as const` objects instead of
  enums.
* **Components.** One exported component per file, named like the file (`AgentCard.tsx` exports
  `AgentCard`), with named exports only. A component stays under about 200 lines; beyond that, it
  splits into sub-components or hooks. Presentational components take props and return JSX, and
  their logic lives in hooks. Props are typed by an `AgentCardProps` type declared just above the
  component. No `useEffect` to derive state or to sync server data: compute it, or let TanStack
  Query hold it.
* **Naming.** Component files in `PascalCase.tsx`, other files in `kebab-case.ts(x)`. Hooks are
  `useXxx`, internal handlers `handleXxx`, handler props `onXxx`, booleans `isXxx`, `hasXxx` or
  `canXxx`. Loop variables get descriptive names, as the root `CLAUDE.md` requires.
* **Logs.** No `console.log`; `console.error` only for real errors.
* **Dependencies.** No library outside the stack of section 2.2 without saying why the existing
  ones fall short, and none that competes with it (a second UI kit, grid, store, styling system or
  translation library).

### 2.6 Routing and data loading

* The Desk keeps today's URLs, so bookmarks and links from Studio keep working:
  `/app/o/$organizationId/p/$projectId`, and under it `/a/$agentId`,
  `/a/$agentId/as/$agentSessionId`, `/a/$agentId/extraction`,
  `/a/$agentId/extraction/csv-runs/$csvRunId` and `/a/$agentId/extraction/runs/$extractionRunId`.
  `/app` becomes the Desk's home (section 2.9), and `/app/o/$organizationId` redirects to it; today
  the first shows an endless loader and the second the not-found page.
* Route files compose features and hold no business logic. Search params are validated by Zod 4
  schemas given directly to `validateSearch`, with no adapter, and path params by Zod schemas
  through `params.parse`. The URL holds filters, pagination, sorting and tabs, and a loader that
  reads search params declares them in `loaderDeps`.
* A loader starts every query its screen needs, in parallel, through the QueryClient of the router
  context: `context.queryClient.query({ ...xxxQueryOptions(...), staleTime: "static" })`, the form
  TanStack Query 5.102 gives for the deprecated `ensureQueryData`. The loader returns cached data
  at once, and the component's `useSuspenseQuery` refreshes it in the background when it is stale.
* Components read with `useSuspenseQuery` or `useSuspenseQueries`, so data is always defined: no
  `isLoading`, no `data?.`, no `if (!data)`. A component never chains `useSuspenseQuery` calls on
  queries its loader did not start, since each would wait for the one before.
* Each route that loads data has a `pendingComponent` shaped like the page (skeletons, never a
  full-page spinner) and an `errorComponent` whose retry resets the query. A section that must not
  block its page gets a local `Suspense` with its own skeleton. `__root.tsx` holds a global error
  boundary.
* `useQuery` is an exception, justified in a one-line comment: a conditional query, optional data
  such as a badge, or live search with `placeholderData: keepPreviousData`.
* Each feature has a query key factory (`conversationKeys.detail(id)`), and each query is a
  `queryOptions` factory in `features/<feature>/api/queries.ts`, shared by loaders and components.
  The router's `defaultPreloadStaleTime` is 0, so TanStack Query alone decides freshness. Queries
  never retry a 4xx, and mutations never retry.

### 2.7 Network code, mutations, forms and tables

* Every network call, streams and signed-URL uploads included, lives in `features/<feature>/api`
  on top of `lib/api-client.ts` and `lib/stream.ts`, and takes its types from the route's schemas.
  No component calls `fetch`. An upload is one mutation that presigns, sends the bytes and confirms.
* Mutation hooks call the client and invalidate the affected keys on success, and on a 500 too,
  since a write may have committed before its response failed its schema. They never suspend: the
  UI reads `isPending`. Optimistic updates are reserved for the places whose UX needs them,
  starting with the chat.
* Forms use React Hook Form with `zodResolver(schema)`. The schema is the Desk request schema the
  API applies, and a rule about the data itself belongs there. Unlike the kit, whose forms validate
  exactly what the API validates, a form may add a `.refine` for a UX rule the server does not need.
  Fields are `Field`, `FieldLabel` and `FieldError` bound through `Controller`, with no `Form`
  wrapper, as the kit prescribes. `useWatch` replaces `watch()`, which the React Compiler cannot
  memoize.
* A 400 from a Desk endpoint carries the Zod issues (section 2.13), and the mutation maps them onto
  the fields with `setError`. Other failures become a toast. The submit button is disabled while the
  form submits, and a submitted form confirms its outcome with a toast.
* Every data table goes through one `DataTable` in `components/shared/`. Column definitions sit in
  `features/<feature>/components/<entity>-columns.tsx`, typed on the row type. A server-paginated
  table uses TanStack Table's manual pagination, sorting and filtering. Its state lives in
  validated search params, the loader prefetches the page they describe, and the router transition
  keeps the previous page on screen while the next one loads. A small list loaded whole sorts,
  filters and paginates on the client with TanStack Table's row models. Every table has an empty
  state and a skeleton.
* State, in order of preference: a derived value, `useState`, the URL, TanStack Query. Server data
  is never copied into a client store; seeding a form from a query is fine.
* Loading errors reach the route's `errorComponent` or a local boundary paired with
  `QueryErrorResetBoundary`. Mutation errors are handled in the mutation and never reach an error
  boundary. No empty `catch`.

### 2.8 Streams

The kit uses realtime events only to invalidate queries. The Desk reads the reply stream and the run
status stream with `fetch` and a reader that also accepts the `id:` lines Nest writes, since
`EventSource` cannot send the bearer token.

* **Chat replies.** Sending a message is a mutation. It opens the reply stream (section 2.13),
  parses every event with the route's event schema and writes into the conversation's query cache
  with `setQueryData`: an optimistic user message and an assistant placeholder first, then text
  chunks and tool steps. Each agent that speaks gets a `start` and an `end` event, so a sub-agent
  that takes over adds a pair. A stream that closes with no `end` or `error` event fails the reply.
  Leaving the conversation aborts the stream. After the last `end`, the mutation invalidates the
  queries of the message and the conversation.
* **A reload during a reply.** The server keeps generating after a disconnect. While a message is
  `streaming`, its query refetches every 2 s (`refetchInterval`), with a pause while the tab is
  hidden, until the status settles. After 3 failures in a row or 30 minutes, the reply shows as
  interrupted.
* **Document and CSV run status.** One status stream per agent stays open while runs are in
  progress and a mounted screen reads it, and reconnects with an exponential backoff from 1 s to
  15 s. Its events patch a run's status in the cache, and a final status invalidates the affected
  queries. The kit's realtime rule only invalidates; patching the status keeps a busy CSV run from
  refetching on every record, and the events come from a Desk endpoint that filters them by owner
  and checks them against the route's event schema.

`experimental_streamedQuery` is not used: it models a query, and a chat reply is a mutation that
edits the conversation's query.

### 2.9 Sign-in, home, runtime configuration and UI

* **Sign-in.** The Desk signs in with OpenID Connect (authorization code with PKCE) through
  `oidc-client-ts`. Its sign-in module, `lib/auth/`, starts as a copy of the one in `apps/web`
  (`src/external/oidcClient.ts`, `src/config/oidc.config.ts`, the `login_hint` and return-path
  helpers, and their specs), wired to the Desk's configuration. From then on it is Desk code, which
  changes with the Desk and never in step with `apps/web`. It uses the identity provider and client
  of the install with redirect URIs of its own (`<origin>/app/auth/callback` after sign-in,
  `<origin>/app/` after sign-out) and a token storage of its own, so the two copies can drift
  without ever sharing or rotating the same refresh token. A person signs in to each app; the
  identity provider's session usually makes the second sign-in silent. A pathless `_authenticated`
  route checks the session in `beforeLoad` and starts sign-in with the return path in the state when
  there is none, and the callback route completes it and opens that path. Refreshes rotate the
  refresh token, so a Web Lock serializes them across the Desk's tabs, as in `apps/web`. Sign-out
  clears the QueryClient and invalidates the router, and so does a session that ends in another
  Desk tab or on a failed refresh.
* **Home, invitations, access and terms.** `/app` shows the caller's pending agent invitations, to
  accept or decline, and the projects where they hold `desk.ui.read`. An agent invitation's link
  opens the Desk (section 2.13). Desk endpoints answer 403 to a caller without `desk.ui.read`
  (section 2.13), and when `GET {project}` (section 3) does, the Desk shows its not-found page. A
  person who has not accepted the current terms accepts them in the Desk before anything else.
* **Runtime configuration.** One build serves every install. `src/app/config.ts` reads
  `window.__CONFIG__`, which the API injects into the Desk's `index.html` from an allowlist of the
  Desk's own (`DESK_*` variables, with the OIDC defaults the API already derives), and falls back
  to the build-time `VITE_*` values. It validates the result with Zod at startup, coerces the
  values, which arrive as strings, is the only file that reads `import.meta.env`, and holds nothing
  secret. The client calls `/api` on the page's origin and reads no API URL from the configuration.
* **UI.** The shadcn CLI generates the Desk's components into `src/components/ui/`, from the Desk's
  `components.json`, on Base UI. Base UI is the default shadcn starts new projects on, with its docs
  and new components written for it first; it comes from the team that built Radix, and the Desk
  has no Radix code to stay compatible with. Base UI composes with a `render` prop where Radix used
  `asChild`, and TypeScript rejects an `asChild` an agent writes out of habit. The Desk holds its
  own Tailwind v4 tokens in `src/styles/global.css`. They start from today's values, so the Desk
  looks like the rest of the platform. Desk code
  extends components with `cva` and changes a generated component only when composition falls
  short, minimally and with no business logic. The tenant theme (`theme.css`, logo, favicon) is
  read at runtime from `/app/theme/`, where each install mounts its files over the defaults of
  `public/theme/`.
* **Styling.** Tailwind only: the Desk writes no stylesheet, CSS module or inline style beyond the
  global entry that loads the tokens. Conditional classes go through `cn()`, and colors and spacing
  come from the tokens, with no arbitrary values. Semantic elements, a label on every field,
  keyboard navigation and a meaningful `alt` on every image are required.

### 2.10 Text and translations

Components hold their English text, through Lingui's macros. Lingui is built around source text:
the English sentence is the message, ICU MessageFormat carries plurals and variables, and a CLI
keeps the catalogs in step with the code.

```tsx
import { Plural, Trans, useLingui } from "@lingui/react/macro"

export function ConversationListHeader({ count, onCreate }: ConversationListHeaderProps) {
  const { t } = useLingui()
  return (
    <header>
      <h1>
        <Plural value={count} one="# conversation" other="# conversations" />
      </h1>
      <Button onClick={onCreate} aria-label={t`Start a new conversation`}>
        <Trans>New conversation</Trans>
      </Button>
    </header>
  )
}
```

* `<Trans>` holds text in JSX, `t` from `useLingui()` text in attributes and toasts, `<Plural>` and
  `plural` counts, and `msg` text defined outside a component and translated where it renders.
  Variables and inline components go inside the message: `<Trans>Delete {title}?</Trans>`.
* `npm run i18n:extract -w @caseai-connect/desk` (`lingui extract --clean`) writes every message to
  `src/locales/fr.po`, with the file and line it comes from; `en.po` fills itself from the source.
  The agent that changes a text translates the new French entries in the same change.
* `check` runs `lingui check sync` and `lingui check missing`, so a stale catalog or a missing
  French translation fails the PR. Changing an English text creates a new message, whose French
  then has to be written again.
* The same English with two meanings gets a `context` (`t({ message: "Open", context: "status" })`),
  and a `comment` tells the translator what a short text refers to.
* Agents work with Lingui's own skills: `lingui-best-practices` for the macros and the catalogs,
  `enhanced-message-context` for translator comments, `find-unwrapped-strings` to audit text left
  outside a macro, and `lingui-framework-setup` at the bootstrap. They are declared in the project's
  agent settings (`.claude/settings.json` for Claude Code), so every session in the repo has them,
  kept up to date by Lingui. When a skill and these rules disagree, on where the catalogs live for
  example, these rules win.
* The Desk keeps its own language choice: the browser's language first, then the person's pick in
  the user menu. Dates and numbers go through `Intl`. Zod messages shown in forms go through Lingui
  too. `<html translate="no">` stays, because browser translation breaks streamed text.
* Code, identifiers, commits and source texts are in English.

### 2.11 Tests and quality gate

* Vitest runs two projects. Pure logic (the stream parser, the client, schemas) runs in node,
  unlike the kit's single jsdom project. Components and hooks run in happy-dom with Testing Library
  and user-event; a test checks what a person sees, queries by role and label (in English, the
  source text), and uses `data-testid` as a last resort. Test files sit next to the code.
* The network is mocked with MSW only, never by mocking TanStack Query, `fetch` or the client.
  Handlers live in `src/test/msw/`. Their fixtures come from factories whose output goes through the
  Desk response schemas, so a mock cannot drift from the contract. Stream handlers return a
  `ReadableStream`, since MSW's `sse()` only intercepts `EventSource`.
* Storybook (`npm run storybook -w @caseai-connect/desk`) serves the Desk on the same handlers, to
  build or check a screen without the API. Each story of `src/stories/` builds its own world of
  the handlers and opens the whole Desk at a page, with a memory history: the person navigates
  from there as in the Desk, so a story is both a state and the start of a journey. It takes the
  place of the route stories of ADR 0010, and of the mock mode the first version had (section 5).
  The worktree environment serves it, which makes a state easy to share.
* Playwright covers the critical journeys (sign-in, a conversation, a document run, a CSV run)
  against a worktree environment, with the real API and database.
* Every bug fix comes with the test that would have caught it. Ids in tests come from
  `randomUUID()`, since `z.uuid()` rejects the hand-written ids some existing specs use.
* `npm run check -w @caseai-connect/desk` runs the typecheck, Biome, dependency-cruiser, knip, the
  translation checks and Vitest. It passes after each significant change, on top of the repo's
  completion criteria.

### 2.12 The Desk contract

Desk contracts live in a package of their own, `packages/desk-contracts`
(`@caseai-connect/desk-contracts`), written the way `packages/api-contracts` is: one folder per area
(`project`, `account`, `conversations`, `memories`, `extraction`), each with an `{area}.dto.ts` that
holds the Zod schemas and an `{area}.routes.ts`, the `{ payload }` and `{ data }` envelopes, the
CRUD keys `getAll`, `getOne`, `createOne`, `updateOne` and `deleteOne`, and one `Desk{Area}Routes`
object per area. It depends on Zod alone and imports nothing from `packages/api-contracts`. The
Desk resolves it as source through its `exports`. The API requires its CommonJS build at runtime and
maps it to its source in Jest, as it does for `api-contracts`.

* A route is declared with `defineSchemaRoute`, a helper of the package. It takes the method, the
  path and the schemas of the params, query, body and response, plus the event schema of a stream,
  and infers the request and response types from them. It returns the shape of `defineRoute`
  (`path`, `getPath`, `method`, phantom `request` and `response`) plus a `schemas` property, so the
  API's controllers and its e2e requester use Desk routes like any other; building a typed path is
  the client's job. A part the route does not read must be empty, and an absent body counts as
  empty, so nothing unchecked comes in.
* Schemas are named by role, after the kit's `xxxInput`, `xxxOutput` and `xxxQuery`, with the
  `Schema` suffix of the existing contracts (`createConversationInputSchema`,
  `conversationOutputSchema`), and their types take the `Dto` suffix. Types derive from schemas
  only: `z.input` for what a client sends, `z.output` for what it gets. A Desk DTO is never written
  by hand.
* The package defines its own enums and constants (agent types, message statuses, tool names,
  accepted MIME types) with `z.enum` and `as const` objects. The API maps its domain values onto
  them, and a compile-time check in the Desk module proves the mapping covers every domain value.
* Response schemas use JSON types only, with no transform, pipe or codec, so the API and the Desk
  check the same JSON with the same schema. Dates stay epoch milliseconds, as everywhere else in the
  API, and the Desk turns them into dates for display.
* Ids are `z.uuid()`, enums `z.enum`, and input objects are strict (`z.strictObject`). A field that
  may have no value is `.nullable()` and always present, since `JSON.stringify` drops `undefined`.
* Query values arrive as strings. Numbers use `z.coerce.number<string>()` with a rule that rejects
  an empty string, flags `z.stringbool()`, and a sort key is a `z.enum` of the sortable fields.
  Nested filters travel as one JSON parameter, through a `z.codec` that turns a malformed value into
  an issue. The client builds the query string with `z.encode`, and the input guard answers 400 to
  any error a schema raises.
* Lists keep the API's offset pagination: the rows under `items`, beside `total`, `page` and
  `limit`, with a 0-based page and a limit of 100 at most, which maps onto TanStack Table pages. The
  kit's cursor pagination is not adopted.
* Reads are GET, which fits TanStack Query and HTTP semantics.
* Contract files compile under the TypeScript 5.5 the API uses as well as the Desk's 5.9, so they
  keep to 5.5 syntax.

### 2.13 Desk endpoints on the API

**Phase 1 (Alexis, 2026-10-21).** The Desk is first built on the API as it is, and this section
waits for the backend to be rebuilt, once the Desk's screens are right. Until then, `apps/api`
changes as little as possible and only in its usual way. The Desk reads the existing endpoints,
filtering on the client what they return for every app, and a missing endpoint is written like the
other routes and controllers of `apps/api`, with `ZodValidationPipe` on its body.
`packages/desk-contracts` describes the routes the Desk calls and the fields it reads, the Desk
checks every response against it, and the API does not import it. `docs/frontend/conventions.md`
holds the rules of this phase.

* The Desk is the first app with endpoints of its own, and the next apps follow the same pattern: a
  contracts package, a path prefix and an API module named after the app, and an access guard on the
  app's UI permission (`studio.ui.read`, `evaluation.ui.read` and so on).
* Desk endpoints live in `apps/api/src/domains/desk/`, a cross-domain module in the read-model layer
  of ADR 0007 (still proposed), beside `me` and `analytics`, that also carries commands. It takes
  its schemas from `@caseai-connect/desk-contracts`, maps domain records onto the Desk DTOs, and
  calls the exported services of the feature modules, never another domain's entities. Anything it
  persists itself goes through custom repositories (ADR 0020). The dependency-cruiser rules that
  list `me` and `analytics` list `desk` too. The context resolvers it needs come from a context
  module in `apps/api/src/common/context/`, which registers their entities and exports the guard
  and the resolvers, so the Desk module registers no entity of another domain.
* Paths start with `desk/` and keep the param names the context resolvers read:
  `desk/organizations/:organizationId/projects/:projectId/agents/:agentId/...`, `:agentSessionId`,
  `:agentCsvExtractionRunId`. They inherit the `api` prefix and bearer auth. Nothing goes under
  `/public`, and the Desk itself needs no CORS: its routes only fall under the `FRONTEND_URL` policy
  the API applies to `/api` paths, which this ADR does not widen.
* Paths carry no version, unlike the kit's `/api/v1`: the Desk and the API ship in one image, so a
  breaking change reaches both in one release. A tab still running an old build that gets a response
  its schema rejects shows an error page that offers to reload.
* `apps/api/src/common/schema-route/` holds the generic part, which reads the `schemas` of any route
  that carries them. Its input guard parses the params, query and body with the route's schemas
  before any resolver runs. A malformed id then gets a 400 before it reaches the database, and a
  streamed route can still fail with an HTTP status, since no frame has gone out yet. Handlers read
  the parsed values through a parameter decorator. Its response interceptor parses each response
  with the route's schema before it leaves: unknown keys are stripped, and a mismatch is logged with
  its issue paths and answered with a 500. On a stream the headers are already sent, so it parses
  each event with the event schema instead, and a mismatch is logged and ends the stream with one
  typed `error` event.
* `@SchemaRoute(route, { permission, activity })` applies the guard chain (`JwtAuthGuard`,
  `UserGuard`, the input guard, `ResourceContextGuard`, `CheckPermissionGuard`), the interceptor,
  the HTTP method and the status code to each handler, so e2e tests, which do not run `main.ts`,
  exercise them. `permission` is required, so no route skips its check by omission. `activity`
  records what `@TrackActivity` records on the `live` routes, except on streams, where the
  activity interceptor would run once per event. `@DeskRoute` wraps it and adds the Desk access
  guard at the end of the chain. Desk controllers declare no guard of their own, since a controller
  guard runs before the handler's guards.
* A 400 from the input guard keeps Nest's body and adds the issues:
  `{ statusCode, message, error, issues: [{ path, code, message }] }`. Other errors keep Nest's
  default body, and the Desk parses both with one Zod schema, where `issues` and `error` are
  optional: a malformed JSON body (400) and an oversized one (413) carry neither. The kit's RFC
  9457 format is not adopted, so the API keeps one error shape.
* Authorization follows ADR 0019. With `@CheckPermission`, each route checks the key and resource
  that the matching route checks today: the session, extraction and CSV keys on the project
  (`agent.conversation.session.create`, `csv_extraction_run.read` and so on), and `agent.read` on
  the agent for memories and the form schema. The `live` routes are the session and run routes that
  today's Desk calls, such as `conversation-agent-sessions/live` and `memories/live`. The Desk
  access guard adds two checks through `PermissionService`, the way `apps/api/CLAUDE.md` allows a
  second check: `desk.ui.read` on the project, which only `apps/web` checks today, and `agent.read`
  on the agent when the route names one. A caller who cannot read the agent gets the 404 an agent
  of another project gets, so the Desk does not reveal the project's other agents.
* The Desk's agent list takes `PermissionService.listResourceIds(userId, "agent.read")`, then a
  custom repository method that keeps the project's published agents, as the Apps agent list already
  does. `AgentsService.listAgents`, which reads agent memberships and also feeds Studio and the MCP
  `list_agents` tool, stays as it is. A source document is read through the caller's own run, with
  `agent.extraction.session.read`, and feedback goes through the caller's own conversation.
* On Desk routes only, these rules change who reaches what. Project owners and admins see every
  agent of the project, including one whose agent membership was removed. A project member reaches
  the agents they hold a membership on, and no longer the others by id. Review campaign testers and
  reviewers hold no `desk.ui.read` and stay out. People who joined a campaign before its roles
  existed still hold `project_member`, so they pass `desk.ui.read`, but they hold no agent
  membership and reach no agent. No key or role changes, and `docs/rbac-permission-matrix.md`
  records that `desk.ui.read` now also gates these routes.
* The account routes under `desk/me` (home, profile, terms, agent invitations, connected apps) name
  no project and serve any signed-in person, as `me` does today. The home lists only the projects
  where the person holds `desk.ui.read`, and only invitations to an agent.
* An agent invitation's link opens the Desk. The invitation email and Studio's "Copy invitation
  link" button build it as `<origin>/app/?login_hint=<email>`, and the Desk passes the hint on to
  sign-in. Project and review campaign invitations keep their link to `apps/web`.
* The session type is `live`, fixed by the server: the Desk never sends a session type or a
  settings revision.
* The reply stream takes the message in a POST body and answers 200. Every frame, failures inside
  the stream included, is a typed event, as in the public v1 stream, and the API and the Desk check
  it against the route's event schema. A stream handler never throws and never errors its
  Observable, which Nest would turn into an untyped `event: error` frame. A check that needs an
  HTTP status, such as the session being `live`, runs in a guard. Node closes a POST request once
  its body is read, so Nest never sees the client leave: the Desk completes the response Observable
  when the response closes, generation goes on as it does today, and a test aborts a reply midway
  to prove the stream ends. The status stream sends only the caller's own runs.
* File bytes go from the browser to the signed storage URL, outside the API. The presign call
  before them, and the confirm call after an extraction document's upload, are Desk endpoints like
  the others. An attachment URL is read through the caller's own conversation, where today's route
  finds the attachment anywhere in the project.
* The Desk domain has an `auth.spec.ts` covering every Desk route, and one functional e2e spec per
  action, as `apps/api/CLAUDE.md` requires. The auth spec covers project owners, admins and members
  with and without a membership on the agent, campaign testers and reviewers, and organization
  roles with no project role. The default factories give the member an agent membership, so the
  cases without one are built explicitly.
* Existing routes stay. Removing the `live` routes that only the old Desk called is a separate
  decision, after the cutover.

### 2.14 Serving and environments

* **Production.** The `app-runtime` target of `apps/api/Dockerfile` builds the Desk in a stage of
  its own, with Vite's base set to `/app/`: it copies the `package.json` of the Desk and of its
  contracts and installs them with a filtered `npm ci`. The API's own stages build
  `packages/desk-contracts`, which the API requires at runtime. `registerWebApp` serves the Desk's
  build at `/app`, ahead of the fallback of `apps/web`, with its own `index.html` and its own
  injected configuration. Its headers follow the kit: immutable caching for the hashed files under
  `/app/assets/` only, `no-store` on the entry page, `nosniff` and a `Permissions-Policy` that
  allows the microphone for dictation. The `Referrer-Policy` stays the browser default. The Helm
  chart mounts each install's theme files into the Desk's build too. A script
  Content-Security-Policy is a follow-up for both apps (only `/oauth/` pages send one today,
  `frame-ancestors 'none'`): the inline configuration script first needs a nonce or a hash. The
  change also fixes the comments that still say the image serves `apps/web` at `/app/`.
* **Cutover.** Until the Desk matches today's screens, the image leaves it out and `apps/web` keeps
  serving `/app`. Every install registers the Desk's redirect URIs with its identity provider
  beforehand. One release then starts serving the Desk and deletes `apps/web/src/desk` and the code
  only it used.
* **Worktree environments.** A `desk` service, under a `desk` profile, runs the Vite dev server. On
  the environment's host it takes the paths that match `^/app(/|$)`, as the API router matches its
  own, with a redirect from `/app` to `/app/`. Its Traefik priority sits between those of the API
  and the web app, so the three share one origin as in production. The init step and the
  `contracts` service build and watch `packages/desk-contracts` as they do `api-contracts`. The same
  change adds the `nm-desk` volume (in `x-node-volumes`, the init service, the top-level volumes
  and `init.sh`) and updates the team's tooling: its list of `node_modules` folders, its services
  and presets, and the redirect URIs of the environment's sign-in client. The volume comes up front,
  before any package nests under `apps/desk`, so a later upgrade cannot stop environments from
  starting.
* **Local development.** The Desk dev server runs on port 5177 with the base `/app/` and proxies
  `/api` to the API. The sign-in samples (`infra/oidc-picker`, `infra/keycloak`) list its redirect
  URIs.
* **CI.** The PR workflow runs the Desk's tests and its `vite build`, since no PR job builds a web
  app today. The typecheck, the build of `packages/desk-contracts` and `check:boundaries` already
  run through turbo and need no change. Playwright joins once the journeys exist.

### 2.15 Way of working

The kit's way of working comes with its stack:

* The rules every app on this stack shares live in `docs/frontend/conventions.md`, written from this
  ADR, which keeps the reasons. Each app adds its own `AGENTS.md` (`apps/desk/AGENTS.md`) for what
  is specific to it and links to the shared file, and its `CLAUDE.md` imports both
  (`@../../docs/frontend/conventions.md` and `@AGENTS.md`), so every agent reads the same text.
  Unlike the kit, whose `AGENTS.md` files are copied unchanged, these are written from this ADR.
  The repo's other apps keep their rules in `CLAUDE.md` and point to it from `AGENTS.md`; the new
  stack writes them in `AGENTS.md`, the file every agent tool reads, and `CLAUDE.md` imports it.
* An agent reads the root `CLAUDE.md` first, then the app's rules, and `apps/api/CLAUDE.md` too when
  the task touches Desk endpoints; these files win over habit. A deviation goes into an ADR first,
  then into the rules.
* Follow the patterns already in `apps/desk`. When in doubt, find an example there and imitate it,
  then read the library's documentation. Reading `apps/web` to learn what a screen does today is
  fine, but its code follows ADR 0011 and is never imported, copied or taken as a model. The
  sign-in module is the one exception, copied once at the start (section 2.9).
* One way to do each thing, little magic, small verified changes, and no unrequested refactor
  alongside a feature.
* Never guess an API: read the library's documentation first, from its official source. Many of
  the stack's libraries publish it for agents, as an `llms.txt` index or as a Markdown version of
  each page (`https://lingui.dev/ref/macro.md`), which costs the fewest tokens. When the
  documentation contradicts these rules, stop, explain, propose a change and wait for a human's go.
* Ask a human before an architecture decision, a new dependency, a version change or an action on
  a shared or remote system. A human types every secret.
* The first PR carries one real endpoint and the screen that reads it, end to end: contract, guards,
  interceptor, client, query, route, translations and MSW handler. Other screens start once it
  works.
* **A Desk endpoint**, contract first: its schemas and route in `packages/desk-contracts`, the
  permission keys, the service calls, the handler with `@DeskRoute`, the e2e specs, the MSW handler
  and its factory, then the repo's checks and the Desk's `check`, whose typecheck proves the Desk
  reads the new types.
* **A Desk feature**: its endpoint first when it is missing or must change, then keys, queries and
  mutations, components with their skeletons and their English text, `index.ts` with the strict
  minimum, the route with its loader, pending and error components, the French translations after
  `i18n:extract`, tests and `check`. Last comes a look in the browser (Playwright MCP when
  available) at desktop and phone widths, in French and English, with the loading, error and empty
  states.
* Both recipes become project skills once the first slice lands, so an agent follows them step by
  step.
* Definition of done: `check` passes with no ignored warning, `vite build` works, and the build
  served under `/app/` by `vite preview` loads and reloads a deep link. Screens load through their
  loader and `useSuspenseQuery` with skeletons, each `useQuery` carries its justification, error
  states offer a retry, empty states exist, every new text has its French translation, and the
  screen was checked at desktop and phone widths. No API type is written by hand, and there is no
  dead code, `console.log`, unflagged TODO or unjustified dependency. The work ends with a summary
  of what was done, what remains, the decisions these rules did not cover, and the actions left to a
  human, such as registering a redirect URI with an install's identity provider.
* Forbidden: Redux, a store other than Zustand, or Zustand without a human's go; `fetch` in a
  component; a text shown to people outside a Lingui macro; `any`, `@ts-ignore`, a `!` assertion,
  or an `as` without a comment proving it safe; a secret in code, the configuration, a `VITE_*`
  value, a log or a commit, and a committed local `.env` file; code copied from one feature into
  another instead of moved to `lib/` or `components/shared/`; an import from another app or from a
  package another app owns; editing `AGENTS.md`, the shared conventions, a tsconfig,
  `apps/desk/biome.json`, or the dependency-cruiser, knip, Lingui, Vitest or Playwright config
  without a human's go; disabling a lint rule, a type check, a translation check or a test to make
  `check` pass.

## 3. First cut of the Desk endpoints

`{project}` stands for `desk/organizations/:organizationId/projects/:projectId` and `{agent}` for
`{project}/agents/:agentId`. In the Desk endpoints column, `GET`, `POST {agent}/conversations`
names two methods on one path, and `...` abbreviates the conversation, document or run path given
before it. Each endpoint's schemas and exact path are settled in its implementation PR.

This cut replaces today's 45 calls, and the three invitation calls of the onboarding, with 42
endpoints: screen-sized reads where the waterfall costs the most, resource-sized commands that map
one to one to mutations, and streams kept apart so they never block a screen. Screen-sized reads
depart from the kit's one-resource endpoints: each has one query key, which any mutation touching
part of it invalidates.

| Area | Desk endpoints | Today's calls they replace |
|---|---|---|
| Account | `GET desk/me`: the caller, the terms to accept, and the projects where they hold `desk.ui.read` | `GET me`, `GET organizations/mine` (twice), `GET projects/mine` |
| | `GET desk/me/invitations`; `POST .../:invitationId/accept`; `POST .../:invitationId/decline`: the caller's agent invitations | `GET me/invitations` and its accept and decline, today in the onboarding of `apps/web` |
| | `POST desk/me/terms-acceptances`; `PATCH desk/me`; `GET desk/me/connected-apps`, `DELETE desk/me/connected-apps/:grantId` | `POST me/terms-acceptances`; `PATCH me`; the OAuth grant list and revocation |
| Project | `GET {project}`: the organization, the project and the Desk features it enables, the published agents the caller can read, and whether the caller can open Studio | the organization's projects, the agent list |
| Conversations | `GET`, `POST {agent}/conversations`; `DELETE {agent}/conversations/:agentSessionId` | the three `conversation-agent-sessions/live` routes |
| | `GET {agent}/conversations/:agentSessionId`: the conversation, its messages, its forms and the form schema | the message list, `settings/:revision/output-json-schema`, the session looked up in the list |
| | `POST {agent}/conversations/:agentSessionId/messages`: the reply stream | `GET .../messages/stream?q=` |
| | `GET .../messages/:messageId`; `GET .../mcp-apps` | `POST .../messages/:messageId`; `POST .../messages/mcp-app-html` |
| | `POST .../attachments`; `GET .../attachments/:attachmentDocumentId/url` | the attachment presign and temporary URL |
| | `POST .../messages/:messageId/feedbacks` | `POST agent-messages/:agentMessageId/feedbacks` |
| | `GET .../sources/:documentId`: whether a cited document is public, and its URL when it is | `GET documents/:documentId/is-public` and `temporary-url` |
| Memories | `GET`, `DELETE {agent}/memories`; `DELETE {agent}/memories/:memoryId`; `POST {agent}/memories/proposals` | the four `memories/live` routes |
| Extraction | `GET {agent}/extraction-runs`: document and CSV runs in one list, with a `kind` | the two run lists |
| | `GET {agent}/extraction-runs/events`: status of the caller's runs | the two status streams |
| | `GET`, `POST {project}/extraction-documents`; `POST .../:documentId/confirm`; `DELETE .../:documentId`; `GET .../:documentId/columns` | the caller's documents, presign, confirm, delete, CSV columns |
| | `POST {agent}/document-runs`; `GET`, `DELETE {agent}/document-runs/:agentSessionId`; `GET .../document-url` | execute, read, delete, and Studio's document URL, which members cannot use |
| | `POST {agent}/csv-runs`: create and start in one call | create, then execute |
| | `GET`, `DELETE {agent}/csv-runs/:agentCsvExtractionRunId`; `GET .../records`; `POST .../retry`; `POST .../cancel`; `GET .../export-url` | the matching `csv-extraction-runs/live` routes |

## 4. Consequences

* The Desk depends on no other app's code. Its sign-in, components, tokens, theme files,
  contracts and translations are its own, and a change in Studio cannot break it.
* A person signs in to the Desk and to Studio separately, and every install registers the Desk's
  redirect URIs with its identity provider. The identity provider's session usually makes the
  second sign-in silent.
* Some code exists twice while `apps/web` lives on, on purpose: components, sign-in, and the logic
  of the screens being rebuilt. The Desk's version follows this ADR, and the old screens leave with
  `apps/web/src/desk` at the cutover.
* One contract per endpoint is enforced on both sides: the server cannot leak an internal field,
  the Desk cannot read a field the server does not send, and a contract bug fails the endpoint's
  e2e tests before it reaches a screen.
* The text on screen reads in the component that shows it, and a missing or stale French
  translation fails the PR.
* On Desk routes the API checks `desk.ui.read` and `agent.read`. The routes behind today's Desk
  check `agent.read` for memories and the form schema only, and `desk.ui.read` nowhere.
* Desk endpoints fix gaps of the routes they replace: CSV record filters the server ignores, a
  status stream not filtered by owner, CSV columns and first rows read without an owner check, an
  attachment URL found anywhere in the project, and a document run whose source file opens through
  Studio's document URL, which answers 403 to project members.
* The 42 endpoints of the first cut and their e2e specs are new code, and the API carries a second
  family of routes for the same features until the `live` routes are retired.
* The repo holds two frontend conventions, two translation libraries and two primitive libraries
  until the last app leaves `apps/web`: ADR 0011, i18next and Radix there, this ADR, Lingui and Base
  UI on the new stack. The skills scoped to
  `apps/web` (`check-use-state`, `check-factories-and-stories`, the frontend half of
  `crud-generator`) do not apply to the new stack, and its `check` script, Storybook and recipe
  skills take their place. `storybook-screenshot` works on the Desk's stories once given the
  Storybook's URL.
* Responses are parsed twice, once by each side. Zod 4 keeps that small for Desk payloads; if large
  transcripts make it visible, `z.compile` (Zod 4.5 and later) is the first lever.
* The cutover needs a second build served at `/app`, the Desk's theme mount and redirect URIs in
  every install, and the worktree changes.

## 5. Alternatives considered

* **Rebuilding the Desk inside `apps/web` on the new stack.** Its routes reach Studio code and the
  store types of every scope, and two styles in one app blur the boundary this ADR draws.
* **Sharing `apps/web`'s sign-in, components and onboarding.** It would give one session for both
  apps and nothing to register in each install, but the Desk would move with the code and the
  releases of `apps/web`.
* **Desk contracts as a folder of `packages/api-contracts`.** One build less, but the Desk would
  import a package shared with Studio, with its TypeScript 5.5 build and the enums of its shared
  files.
* **Radix, as in `packages/ui`.** shadcn still supports it, but its new projects, its docs and its
  new components start from Base UI, and the Desk has no Radix code to stay compatible with.
* **A host of its own, as `apps/web-embed` has.** It needs a CORS origin, a new image, Helm
  component and ingress, and links from Studio to another host.
* **A GET reply stream after a POST that creates the message.** Nest would see the client leave
  with no extra code, but the generation service would have to hold a pending message between the
  two calls.
* **i18next with keys, as in `apps/web`.** Components read keys, so the words on screen are not in
  the code. i18next can also take the English sentence as its key, with its separators turned off,
  but plurals still need suffixed entries in an English file, and extraction and checks come from a
  separate CLI. Lingui is built around source text, and its CLI checks the catalogs.
* **nestjs-zod.** The API's global class-validator pipe (`whitelist`, `forbidNonWhitelisted`) would
  run first on nestjs-zod's DTO classes and reject their properties, which carry no class-validator
  decorator. The library also has no NestJS 12 peer yet.
* **ts-rest.** No release since early 2025, and Zod 3 only.
* **oRPC.** It replaces the `defineRoute` shape and the `{ payload }` and `{ data }` envelopes this
  ADR keeps.
* **NestJS 12's built-in Standard Schema validation and serialization.** It is the target once the
  API moves to NestJS 12 and TypeScript 6. The schema route guard and interceptor read the same
  schemas and can be swapped for it then.
* **Parsing responses on one side only.** The server check keeps internal fields from leaking and
  catches contract bugs in e2e tests. The client check catches version skew between a deployed app
  and a deployed API.
* **ISO date strings with Zod codecs.** The rest of the API sends epoch milliseconds, and one
  convention is easier to hold than two.
* **A mock mode instead of Storybook.** The first version served the Desk on the handlers with
  `npm run dev:mock` and picked a state with `?mock=<scenario>`. Storybook replaced it on
  2026-10-21, on the same handlers: a story keeps a state at a link, the worktree environment
  serves and shares it, screenshots come per story, and a story of the whole Desk still lets the
  person go from page to page. The address bar no longer follows the page, which the story's
  starting page makes up for.

## 6. Open questions

* The Desk's independence is not fully enforced yet. dependency-cruiser only sees imports: a copied
  file, a CSS import or an edit of its configuration can still bring code of `apps/web`,
  `packages/ui` or `packages/api-contracts` into the Desk. This will cause problems, and a solution
  has to be found.
* Project owners and admins see every agent of the project in the Desk, while the Studio list and
  the MCP `list_agents` tool keep reading agent memberships. Should those two lists move to
  `PermissionService` as well?
* A new agent gives memberships to the project's admins and owners only. Should it give one to
  project members too, now that the Desk limits a member to the agents they hold a membership on?
* The `project_member` rows of people who joined a campaign before its roles existed are due to be
  removed by a later migration. Should the cutover wait for it?
* Moving the session keys from the project to the agent is a known follow-up with no public issue
  yet.
* Context7, an MCP server that serves current library documentation to agents, would spare them
  looking up each library's pages. It is a third-party service whose index is fed by the community,
  so the tech team decides whether to add it to `.mcp.json`.

## 7. Re-evaluate if

* The second app joins the stack: whether the apps of the new stack share code with each other (a
  design system, a sign-in module, the API client) is decided then, and the conventions get tested
  on a second app.
* The API moves to NestJS 12, or TypeScript 7.1 ships a compiler API: a typecheck several times
  faster pays off with every agent run.
* Parsing large transcripts shows in response times.
* Session permissions move from the project to the agent, which would let the Desk access guard drop
  its own `agent.read` check.
