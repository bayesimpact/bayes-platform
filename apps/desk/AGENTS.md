# AGENTS.md (apps/desk)

The Desk: where project members use the published agents of their projects. It follows the shared
rules of [docs/frontend/conventions.md](../../docs/frontend/conventions.md), and
[ADR 0031](../../docs/adr/0031-frontend-stack-for-agent-built-apps.md) keeps the reasons.
[docs/frontend/shared-packages.md](../../docs/frontend/shared-packages.md) lists the packages
it shares with the other apps, and their limits. This file
holds what is specific to the Desk.

## The Desk at a glance

- Served under `/app/` (Vite's `base`, `appBasePath` in `src/app/config.ts`, the router's
  `basepath`). The URLs of today's Desk stay: `/app/o/$organizationId/p/$projectId` and the agent
  pages below it. `/app` is the home, and `/app/o/$organizationId` redirects to it.
- Contracts: `@caseai-connect/desk-contracts` (`packages/desk-contracts`), one folder per area
  (`account`, `agent-sessions`, `agents`, `conversations`, `documents`, `extractions`,
  `invitations`, `memories`, `organizations`, `projects`), with `common/` for the paths every
  route starts with, the route helper and the error body it re-exports from
  `@caseai-connect/schema-route` (`packages/schema-route`), and a `Desk{Area}Routes` object per
  area (`extractions` has two: documents and CSV files). The chat's schemas and routes come
  from `@caseai-connect/chat-contracts` (`packages/chat-contracts`), which it re-exports, as
  Evaluation's contracts do: `DeskConversationsRoutes` adds them, under the `live` sessions, to
  the creation and the deletion of a conversation, and `DeskDocumentsRoutes` is the documents'
  routes under `desk/`. The params every route extends (`AgentParamsDto`,
  `ConversationParamsDto`) come from it too. It
  describes the `desk/` routes the Desk calls and the fields it reads, and the API serves these
  routes with the same schemas.
- Endpoints: the Desk calls only its own endpoints, under `desk/`, with one exception: a resource
  card links to a library file at `organizations/.../resource-libraries/.../resources/.../file`
  (`toResourceUrl` of `@caseai-connect/frontend-lib`), outside `desk/` and the contracts, until a
  Desk route serves it.
  `DeskModule` (`apps/api/src/domains/desk/`) serves the `desk/` routes with `@SchemaRoute`, and
  each one copies the endpoint the Desk called before, with the same permission on the same
  resource. A new or changed endpoint is contract first (`docs/frontend/conventions.md`,
  Endpoints). The sidebar reads `desk/me`, then `desk/projects/mine`, `desk/organizations/mine`
  and the agents of each project that grants `desk.ui.read`, as apps/web does, under one query
  (`deskAgentsQueryOptions` in `features/agents`), and the person's invitations every minute. It
  keeps the agents whose
  `permissions` hold the session key of their type (`AGENT_SESSION_CREATE_PERMISSIONS`): the API
  also lists the agents a project evaluator only reads.
- MCP Apps: a card runs in the sandbox of `@caseai-connect/mcp-app-host`
  (`packages/mcp-app-host`). The Desk keeps what is its own: the `useMcpApp` hook and `McpAppCard`
  in `features/conversation` and the placeholder. The lookup of an app's HTML (`findMcpAppHtml`)
  comes from `@caseai-connect/chat`.
- Sign-in: `@caseai-connect/sign-in` (`packages/sign-in`). Only `src/lib/auth/` imports it:
  `session.ts`, which the rest of the
  Desk reads, and `adopt-desk-session.ts`, the move of the session the Desk held on its own before
  every app shared one. The sign-in uses the install's client and comes back to
  `<origin>/app/auth/callback` (`<origin>/app/` after sign-out). Its session is the one every app
  of the origin shares: the stored user under apps/web's key (`oidc.user:`), refreshed under the
  same Web Lock (`oidc-token-refresh`), and followed when another app signs out or switches
  account. Only the state of its own sign-ins stays under `desk.oidc.`.
- Sign-in problems never loop. A 401 whose message the API uses to refuse a person raises a
  `SignInRefusedError`, shown as a page that says why. An automatic sign-in starts at most once
  every 30 seconds (`SignInLoopError` beyond), and a callback whose OIDC state was lost retries
  once a minute at most. Queries never retry these errors.
- Terms: the layout of the signed-in pages waits for `me` and shows the terms to accept before any
  page, as apps/web does. It is the one section that holds its pages back, on purpose.
- Configuration: the API injects `window.__CONFIG__` when it serves the Desk, from the `WEB_*`
  variables it gives apps/web (`helpCenterUrl`, the `oidc*` keys), and the version it runs
  (`appVersion`, `gitSha`), which the user menu shows; in dev, the `VITE_*` values of
  `apps/desk/.env` stand in (see `.env-example`).
- New releases: each production build gets an id, which it knows (`buildId` in
  `src/app/config.ts`) and publishes in `version.json` beside its files (`publishBuildId` in
  `vite.config.ts`). The API only serves that file with `Cache-Control: no-cache`, so no cache on
  the way keeps it. The root route polls that file every minute while the
  tab is visible (`features/releases`) and hands its id to `appUpdate` (`src/lib/app-update.ts`).
  Another build counts as new once it alone was published for a minute, so a rolling deployment
  does not announce the old build, and at once when Vite cannot load a chunk of this tab's build
  (`vite:preloadError`). Then `NewReleaseBanner`, at the top of every signed-in page, offers the
  reload, which the person chooses; `useReloadWhenSafe`, in the root route, turns the next move to
  another page into a full load of that page, unless a mutation is on its way; and
  `RouteErrorState` offers a reload, not a retry. The Desk never reloads the page the person is on
  by itself. Dev, the tests and Storybook have no build id, and poll nothing.

## Commands

Run them from the repository root.

| Command | What it does |
|---|---|
| `npm run dev -w @caseai-connect/desk` | Dev server on port 5177 at `/app/`, forwarding `/api` to the local API |
| `npm run storybook -w @caseai-connect/desk` | Storybook on port 6009: the whole Desk on the MSW handlers, with no API and no sign-in, one story per state of its world |
| `npm run check -w @caseai-connect/desk` | Typecheck, Biome, the component files check, dependency-cruiser, knip, translation checks and Vitest |
| `npm run test -w @caseai-connect/desk` | Vitest alone; `npx vitest run <path>` in `apps/desk` runs one spec |
| `npm run check:desk-parity -w @caseai-connect/eval` | Compares the Desk's chat with Evaluation's copy of it: run it after a change to the chat |
| `npm run i18n:extract -w @caseai-connect/desk` | Writes every message to `src/locales/en.po` and to the catalog of each other language of `lingui.config.ts`, and the texts of the shared packages to their own catalogs (`packages/app-ui/src/locales/`), without line numbers, to translate in the same change |
| `npm run build -w @caseai-connect/desk` | The production build, in `apps/desk/dist` |
| `npm run preview -w @caseai-connect/desk` | Serves that build on port 5178 at `/app/` |

In a worktree with an environment, never start `dev` on the host: the environment's `desk` service
runs it, under the `desk` profile (`bayes wt up --with desk`), at `<WT_ORIGIN>/app/`. Its Storybook
runs under the `storybook-desk` profile (`bayes wt up --with storybook-desk`, or the `front`
preset), at `<WT_SCHEME>://<name>-desk-storybook.<WT_TOOLS_DOMAIN>`, the link to share. The browser
of Claude Desktop blocks the scripts of that public domain: open it there at
`http://<name>-desk-storybook.connect.localhost:8800`, which the environment serves too. In the
main checkout, `npm run storybook -w @caseai-connect/desk` serves it on port 6009, with its MCP
server at `/mcp` (`storybook-desk` in `.mcp.json`). The `storybook-screenshot` skill captures its
stories, with `--base-url` for an environment's.

## Reference files

Before writing a kind of code, read the file that shows it here and imitate it: each one follows
the conventions as they stand. When a rule changes, its reference file changes in the same PR.

| Kind of code | Reference |
|---|---|
| A route with its loader, search params, pending and error components | `src/routes/_authenticated/o/$organizationId/p/$projectId/a/$agentId/extraction/csv-runs/$csvRunId.tsx` |
| A loader | `src/features/extraction/load-extraction.ts` |
| Query keys and query options | `src/features/account/api/keys.ts`, `src/features/account/api/queries.ts` |
| A mutation and its cache refresh | `src/features/account/api/mutations.ts` |
| A form | `src/features/account/components/EditNameDialog.tsx` |
| A table, its columns and its skeleton | `src/features/extraction/components/CsvRecordsTable.tsx`, `csv-record-columns.tsx`, `CsvRecordsSkeleton.tsx` |
| A stream | `packages/chat/src/api/stream-reply.ts` |
| A route's spec | `src/routes/_authenticated/o/$organizationId/p/$projectId/a/$agentId/extraction/csv-runs/$csvRunId.spec.tsx` |
| An MSW handler and its factory | `src/test/msw/extraction-handlers.ts`, `src/test/factories/extractions.factory.ts` |
| A story | `src/stories/Extraction.stories.tsx` |

## Where things are

- The home: `src/routes/_authenticated/index.tsx`, which opens the last agent the person used,
  through `features/agents`, whose `listDeskProjects` keeps the projects that open the Desk. The
  user menu reads the `me` query of `features/account`.
- The layout of every signed-in page, with the session check and the terms to accept:
  `src/routes/_authenticated.tsx`. The sidebar's footer, with the user menu and the invitations:
  `src/routes/-components/DeskSidebarFooter.tsx` (the router ignores `-` folders). The sign-in
  callback: `src/routes/auth/callback.tsx`, whose problems `signInCallbackProblemOf`
  (`@caseai-connect/sign-in`) tells apart and `components/shared/SignInCallbackErrorPage.tsx`
  explains.
- An agent's pages: `src/routes/_authenticated/o/$organizationId/p/$projectId/a/$agentId/`, with
  a conversation (`features/conversation`) or, for an extraction agent, `extraction/` and its
  document runs, CSV setups and CSV runs (`features/extraction`). The sidebar's history is
  `features/history`, the agent switcher and the agents' guards (`requireAgentType`,
  `hasSourcesTool`) `features/agents`, what an agent remembers `features/memory`, the envelope of
  invitations `features/invitations`, the terms and the name `features/account`. Each feature's
  route loaders sit in its `load-*.ts`.
- The shadcn components, the design tokens and the stylesheet shadcn relies on come from
  `@caseai-connect/app-ui` (`packages/app-ui`), which the Desk shares with Evaluation:
  `src/styles/global.css` imports its `globals.css`, then holds the chat's tokens and
  highlights, which Evaluation's parity check compares with its copy. `npx shadcn add`, run in
  `apps/desk`, writes into the package. The sidebar takes each install's color from its
  `theme.css` (`docs/frontend/conventions.md`, UI and styling).
- `SidePanel` for every panel docked beside a page comes from `@caseai-connect/app-ui`
  (`compositions/SidePanel`): it makes the page behind inert where it covers it, and folds the
  sidebar when it opens or stretches so wide that the page, its previous sibling, keeps less than
  480 px. `DeskShell` gives it the key of the width it saves, `desk.sidePanelWidth`.
- `HeaderActions` for the actions of the bar above the page comes from `@caseai-connect/app-ui`
  (`compositions/HeaderActions`): `DeskShell` gives it the element of the bar through
  `HeaderActionsContext`.
- Shared compositions, in `src/components/shared/`: `DataTable` for every table,
  `HighlightedCodeBlock` for code and JSON, `RunStateIcon` for where a run stands,
  `NewReleaseBanner` for a new release. The compositions that know no feature (`SidePanel`,
  `ResizeHandle`, `HeaderActions`, `CopyButton`, `RelativeTime`, `ExternalLink`) come from
  `@caseai-connect/app-ui/compositions/<Name>`. Shared hooks sit in `src/hooks/` (`useAbortOnUnmount`,
  `useIsNewReleaseOut`, `useReloadWhenSafe`), and shared logic in `src/lib/`: `not-found.ts`,
  `agent-params.ts`, `field-text.ts`, `run-state.ts`, `is-record.ts`, `app-update.ts`. The hooks
  and helpers the Desk shares with Evaluation come from `@caseai-connect/frontend-lib`
  (`packages/frontend-lib`, whose `src/index.ts` lists them).
- A conversation keys its messages by position: a message keeps its element when its id changes
  (the local id, then the server's), which the message scroller would read as a new message to
  scroll to.
- The chat's logic, hooks and calls to the API come from `@caseai-connect/chat`
  (`packages/chat`). `src/features/conversation/chat.ts` creates the Desk's chat object with
  `createChat`: its routes (conversation and documents), the functions of its API client, and what
  the Desk refreshes when a tool runs (`onToolCalled`) and when a reply ends (`onReplySettled`).
  `src/routes/_authenticated.tsx` gives it to `<ChatProvider>`, and `renderWithQueryClient` does
  the same in the tests: a hook of the package throws outside a provider. A message keeps the
  results of its tool calls, in which the Desk reads the facts its memory saved
  (`savedMemoryIdsOf` of `features/memory`): the package knows no memory. The feature's `api/`
  keeps `mutations.ts` for `useStartConversation`, which only the Desk has.
- Evaluation (`apps/eval`) holds a copy of what is still in the Desk's
  `src/features/conversation/`: its components and the hooks and helpers that show a text, and
  `Markdown`, `HighlightedCodeBlock` and `InlineCode` of `src/components/shared/`. Its calls to the
  API are not among them. A change to one of these files goes to the copy too, in the same PR.
  `npm run check:desk-parity -w @caseai-connect/eval` compares the two, and fails on any
  difference not recorded in `apps/eval/scripts/desk-parity.json`. That file holds a fingerprint
  of each wanted difference, a file only one app has included (`ConversationMenu.tsx`,
  `api/mutations.ts`): record one with `-- --update`. `chat-parity.spec.tsx`, in both apps,
  renders one conversation to a snapshot the check compares too. The Desk's `check` does not run
  it: CI's `eval-tests` job does.
- The API client: `src/lib/api-client.ts`, which creates the client of
  `@caseai-connect/api-client` (`packages/api-client`) on the app's session. The query client:
  `src/app/query-client.ts`, with the retry rule of that package (`shouldRetryQuery`).
- The mocked API: `src/test/msw/handlers.ts` and `extraction-handlers.ts`, written with
  `mockRoute` and `mockStreamRoute` (`src/test/msw/mock-route.ts`) and fed by the factories of
  `src/test/factories/`, whose `desk-world.factory.ts` builds the worlds. `src/test/setup.ts` gives
  each test a fresh world, a signed-in session, empty storage and no new release; a spec overrides
  a route with `server.use(mockRoute(...))`. Its URLs come from `src/test/desk-urls.ts`.
- The stories, in three folders of Storybook under `Desk`: `General` (`src/stories/Desk.stories.tsx`:
  the home, the agents and projects, the terms, the failures around the pages), `Conversation`
  (`Conversation.stories.tsx`) and `Extraction` (`Extraction.stories.tsx`). They share the meta
  of `src/stories/desk-meta.tsx`. Each one sets its `desk` parameter with `desk()` (a world,
  handlers that win over it, a starting page), which `src/test/msw/story-api.ts` serves with ids
  that are the same on every load. A new state of the Desk is a new story in the file of its
  folder; a component's own story gets the i18n and query providers from
  `src/stories/StoryProviders.tsx`.
  `src/stories/Desk.stories.spec.tsx` renders every story in the tests.

## In production

The `app-runtime` image builds the Desk (the `desk-build` stage of `apps/api/Dockerfile`) and the
API serves it at `/app`, ahead of `apps/web` (`DESK_APP_DIST_DIR`, `registerWebApp` in
`apps/api/src/common/web-app`), with the same injected configuration as `apps/web` and the
install's theme mounted over `dist/theme` (`web.deskDistDir` in the Helm chart). Each install
registers `<origin>/app/auth/callback` and `<origin>/app/` with its identity provider.
The old Desk of `apps/web` is gone: `apps/web` only links to the Desk, through `DeskRoutes` in
`apps/web/src/common/routes/desk-routes.ts`.
