# AGENTS.md (apps/desk)

The Desk: where project members use the published agents of their projects. It follows the shared
rules of [docs/frontend/conventions.md](../../docs/frontend/conventions.md), and
[ADR 0031](../../docs/adr/0031-frontend-stack-for-agent-built-apps.md) keeps the reasons. This file
holds what is specific to the Desk.

## The Desk at a glance

- Served under `/app/` (Vite's `base`, `appBasePath` in `src/app/config.ts`, the router's
  `basepath`). The URLs of today's Desk stay: `/app/o/$organizationId/p/$projectId` and the agent
  pages below it. `/app` is the home, and `/app/o/$organizationId` redirects to it.
- Contracts: `@caseai-connect/desk-contracts` (`packages/desk-contracts`), one folder per area
  (`account`, `agent-sessions`, `agents`, `conversations`, `documents`, `extractions`,
  `invitations`, `memories`, `organizations`, `projects`), with `common/` for the error body and
  the params every route extends (`AgentParamsDto`, `ConversationParamsDto`), and a
  `Desk{Area}Routes` object per area (`extractions` has two: documents and CSV files). It
  describes the API routes the Desk calls and the fields it reads; the API does not import it.
- Endpoints: in this first phase, the Desk reads the API's existing endpoints, and `apps/api`
  changes only in its usual way when one is missing (`docs/frontend/conventions.md`, Endpoints).
  The sidebar reads `me`, then `projects/mine`, `organizations/mine` and the agents of each project
  that grants `desk.ui.read`, as apps/web does, under one query (`deskAgentsQueryOptions` in
  `features/agents`), and the person's invitations every minute.
- Sign-in: `src/lib/auth/`, the only code that knows `oidc-client-ts`, used through
  `lib/auth/session.ts`. It signs in with the install's client and comes back to
  `<origin>/app/auth/callback` (`<origin>/app/` after sign-out). Its storage prefix (`desk.oidc.`)
  and refresh lock are its own, apart from apps/web's.
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

## Commands

Run them from the repository root.

| Command | What it does |
|---|---|
| `npm run dev -w @caseai-connect/desk` | Dev server on port 5177 at `/app/`, forwarding `/api` to the local API |
| `npm run storybook -w @caseai-connect/desk` | Storybook on port 6009: the whole Desk on the MSW handlers, with no API and no sign-in, one story per state of its world |
| `npm run check -w @caseai-connect/desk` | Typecheck, Biome, dependency-cruiser, knip, translation checks and Vitest |
| `npm run test -w @caseai-connect/desk` | Vitest alone; `npx vitest run <path>` in `apps/desk` runs one spec |
| `npm run i18n:extract -w @caseai-connect/desk` | Writes every message to `src/locales/en.po` and `fr.po`, without line numbers, to translate in the same change |
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
| A stream | `src/features/conversation/api/stream-reply.ts` |
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
  callback: `src/routes/auth/callback.tsx`, whose problems `lib/auth/sign-in-problems.ts` tells
  apart and `components/shared/SignInCallbackErrorPage.tsx` explains.
- An agent's pages: `src/routes/_authenticated/o/$organizationId/p/$projectId/a/$agentId/`, with
  a conversation (`features/conversation`) or, for an extraction agent, `extraction/` and its
  document runs, CSV setups and CSV runs (`features/extraction`). The sidebar's history is
  `features/history`, the agent switcher and the agents' guards (`requireAgentType`,
  `hasSourcesTool`) `features/agents`, what an agent remembers `features/memory`, the envelope of
  invitations `features/invitations`, the terms and the name `features/account`. Each feature's
  route loaders sit in its `load-*.ts`.
- The sidebar's colors, in `src/styles/global.css`: unlike the platform's other tokens, the
  `--sidebar-*` ones derive from `--primary` (mixed in `oklab`, which keeps its hue), so the
  sidebar takes each install's color from its `theme.css`.
- Shared compositions, in `src/components/shared/`: `SidePanel` for every panel docked beside a
  page (it makes the page behind inert where it covers it), `HeaderActions` for the actions of the
  bar above it, `DataTable` for every table, `ExternalLink` for a link to a new tab,
  `HighlightedCodeBlock` for code and JSON, `RunStateIcon` for where a run stands. Shared hooks sit
  in `src/hooks/` (`useNow`, `useMediaQuery`, `useAbortOnUnmount`), and shared logic in `src/lib/`:
  `polling.ts`, `not-found.ts`, `start-query.ts`, `agent-params.ts`, `field-text.ts`,
  `file-size.ts`, `format-time.ts`, `run-state.ts`, `has-own-key.ts`, `is-record.ts`.
- A conversation keys its messages by position: a message keeps its element when its id changes
  (the local id, then the server's), which the message scroller would read as a new message to
  scroll to.
- The API client: `src/lib/api-client.ts`. The query client's retry rules:
  `src/app/query-client.ts`.
- The mocked API: `src/test/msw/handlers.ts` and `extraction-handlers.ts`, written with
  `mockRoute` and `mockStreamRoute` (`src/test/msw/mock-route.ts`) and fed by the factories of
  `src/test/factories/`, whose `desk-world.factory.ts` builds the worlds. `src/test/setup.ts` gives
  each test a fresh world, a signed-in session and empty storage; a spec overrides a route with
  `server.use(mockRoute(...))`. Its URLs come from `src/test/desk-urls.ts`.
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
