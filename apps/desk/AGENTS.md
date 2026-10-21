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
  (`account`, `organizations`, `projects` so far), one `Desk{Area}Routes` object per area. It
  describes the API routes the Desk calls and the fields it reads; the API does not import it.
- Endpoints: in this first phase, the Desk reads the API's existing endpoints, and `apps/api`
  changes only in its usual way when one is missing (`docs/frontend/conventions.md`, Endpoints).
  The home reads `me`, `projects/mine` and `organizations/mine`, and keeps the projects that grant
  `desk.ui.read`, as apps/web does.
- Sign-in: `src/lib/auth/`, the only code that knows `oidc-client-ts`, used through
  `lib/auth/session.ts`. It signs in with the install's client and comes back to
  `<origin>/app/auth/callback` (`<origin>/app/` after sign-out). Its storage prefix (`desk.oidc.`)
  and refresh lock are its own, apart from apps/web's.
- Configuration: the API injects `window.__CONFIG__` when it serves the Desk; in dev, the
  `VITE_OIDC_*` values of `apps/desk/.env` stand in (see `.env-example`).

## Commands

Run them from the repository root.

| Command | What it does |
|---|---|
| `npm run dev -w @caseai-connect/desk` | Dev server on port 5177 at `/app/`, forwarding `/api` to the local API |
| `npm run dev:mock -w @caseai-connect/desk` | The Desk on the MSW handlers, with no API and no sign-in; `?mock=empty`, `?mock=error`, `?mock=loading` show the other states |
| `npm run check -w @caseai-connect/desk` | Typecheck, Biome, dependency-cruiser, knip, translation checks and Vitest |
| `npm run i18n:extract -w @caseai-connect/desk` | Writes every message to `src/locales/fr.po`, to translate in the same change |
| `npm run build -w @caseai-connect/desk` | The production build, in `apps/desk/dist` |
| `npm run preview -w @caseai-connect/desk` | Serves that build on port 5178 at `/app/` |

In a worktree with an environment, never start `dev` on the host: the environment's `desk` service
runs it, under the `desk` profile (`bayes wt up --with desk`), at `<WT_ORIGIN>/app/`. The mock mode
is not part of the environment and runs on the host.

## Where things are

- The home: `src/routes/_authenticated/index.tsx`, composing `features/home`, whose
  `listDeskProjects` keeps the projects that open the Desk. The user menu reads the `me` query of
  `features/account`.
- The layout of every signed-in page, with the session check and the user menu:
  `src/routes/_authenticated.tsx`. The sign-in callback: `src/routes/auth/callback.tsx`.
- The API client: `src/lib/api-client.ts`. The query client's retry rules:
  `src/app/query-client.ts`.
- The mocked API: `src/test/msw/handlers.ts`, with the factories of `src/test/factories/`.

## Until the cutover

The image does not serve the Desk yet: `apps/web` keeps serving `/app` in production until the Desk
matches today's screens (ADR 0031, section 2.14). Never change `apps/web/src/desk` for the Desk's
sake.
