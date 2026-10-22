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
  `invitations`, `memories`, `organizations`, `projects`), one `Desk{Area}Routes` object per
  area. It describes the API routes the Desk calls and the fields it reads; the API does not
  import it.
- Endpoints: in this first phase, the Desk reads the API's existing endpoints, and `apps/api`
  changes only in its usual way when one is missing (`docs/frontend/conventions.md`, Endpoints).
  The home reads `me`, `projects/mine` and `organizations/mine`, and keeps the projects that grant
  `desk.ui.read`, as apps/web does.
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
- Configuration: the API injects `window.__CONFIG__` when it serves the Desk; in dev, the
  `VITE_OIDC_*` values of `apps/desk/.env` stand in (see `.env-example`).

## Commands

Run them from the repository root.

| Command | What it does |
|---|---|
| `npm run dev -w @caseai-connect/desk` | Dev server on port 5177 at `/app/`, forwarding `/api` to the local API |
| `npm run storybook -w @caseai-connect/desk` | Storybook on port 6009: the whole Desk on the MSW handlers, with no API and no sign-in, one story per state of its world |
| `npm run check -w @caseai-connect/desk` | Typecheck, Biome, dependency-cruiser, knip, translation checks and Vitest |
| `npm run i18n:extract -w @caseai-connect/desk` | Writes every message to `src/locales/fr.po`, to translate in the same change |
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

## Where things are

- The home: `src/routes/_authenticated/index.tsx`, which opens the last agent the person used,
  through `features/agents`, whose `listDeskProjects` keeps the projects that open the Desk. The
  user menu reads the `me` query of `features/account`.
- The layout of every signed-in page, with the session check and the user menu:
  `src/routes/_authenticated.tsx`. The sign-in callback: `src/routes/auth/callback.tsx`.
- An agent's pages: `src/routes/_authenticated/o/$organizationId/p/$projectId/a/$agentId/`, with
  a conversation (`features/conversation`) or, for an extraction agent, `extraction/` and its
  document runs, CSV setups and CSV runs (`features/extraction`). The sidebar's history is
  `features/history`, the agent switcher `features/agents`, the envelope of invitations
  `features/invitations`, the terms and the name `features/account`.
- The sidebar's colors, in `src/styles/global.css`: unlike the platform's other tokens, the
  `--sidebar-*` ones derive from `--primary` (mixed in `oklab`, which keeps its hue), so the
  sidebar takes each install's color from its `theme.css`.
- Shared compositions, in `src/components/shared/`: `SidePanel` for every panel docked beside a
  page, `HeaderActions` for the actions of the bar above it, `DataTable` for every table.
- A conversation keys its messages by position: a message keeps its element when its id changes
  (the local id, then the server's), which the message scroller would read as a new message to
  scroll to.
- The API client: `src/lib/api-client.ts`. The query client's retry rules:
  `src/app/query-client.ts`.
- The mocked API: `src/test/msw/handlers.ts`, with the factories of `src/test/factories/`.
- The stories: `src/stories/Desk.stories.tsx`. Each one sets its `desk` parameter (a world, handlers
  that win over it, a starting page), which `src/test/msw/story-api.ts` serves with ids that are
  the same on every load. A new state of the Desk is a new story there.

## Until the cutover

The image does not serve the Desk yet: `apps/web` keeps serving `/app` in production until the Desk
matches today's screens (ADR 0031, section 2.14). Never change `apps/web/src/desk` for the Desk's
sake.
