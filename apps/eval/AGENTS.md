# AGENTS.md (apps/eval)

Evaluation: where project members evaluate their agents (datasets, runs) and manage review
campaigns. Testers and reviewers get frontends of their own. It follows the shared rules of
[docs/frontend/conventions.md](../../docs/frontend/conventions.md), and
[ADR 0031](../../docs/adr/0031-frontend-stack-for-agent-built-apps.md) keeps the reasons. This
file holds what is specific to Evaluation. It uses the same library versions as the Desk.

## Evaluation at a glance

- Served under `/eval/` (Vite's `base`, `appBasePath` in `src/app/config.ts`, the router's
  `basepath`), the path of the evaluation pages of apps/web, which this app replaces.
- Contracts: `@caseai-connect/eval-contracts` (`packages/eval-contracts`), one folder per area,
  with an `Eval{Area}Routes` object per area. It describes the API routes the app calls and the
  fields it reads; the API does not import it.
- Sign-in: `src/lib/auth/`, the only code that knows `oidc-client-ts`, used through
  `lib/auth/session.ts`. It comes back to `<origin>/eval/auth/callback` (`<origin>/eval/` after
  sign-out). Its storage prefix (`eval.oidc.`) and refresh lock are its own.
- The layout of every signed-in page (`src/routes/_authenticated.tsx`) waits for `GET me`
  (`features/account`), so a sign-in the API refuses shows before any page.
- Configuration: the API will inject `window.__CONFIG__` when it serves the app; in dev, the
  `VITE_*` values of `apps/eval/.env` stand in (see `.env-example`).

## Commands

Run them from the repository root.

| Command | What it does |
|---|---|
| `npm run dev -w @caseai-connect/eval` | Dev server on port 5179 at `/eval/`, forwarding `/api` to the local API |
| `npm run storybook -w @caseai-connect/eval` | Storybook on port 6010: the whole app on the MSW handlers, with no API and no sign-in |
| `npm run check -w @caseai-connect/eval` | Typecheck, Biome, dependency-cruiser, knip, translation checks and Vitest |
| `npm run test -w @caseai-connect/eval` | Vitest alone |
| `npm run i18n:extract -w @caseai-connect/eval` | Writes every message to `src/locales/en.po` and `fr.po` |
| `npm run build -w @caseai-connect/eval` | The production build, in `apps/eval/dist` |
| `npm run preview -w @caseai-connect/eval` | Serves that build on port 5180 at `/eval/` |

In a worktree with an environment, never start `dev` or Storybook on the host: the `eval` and
`storybook-eval` services of `infra/worktree/docker-compose.yaml` run them, at `<WT_ORIGIN>/eval/`
and `http://<name>-eval-storybook.connect.localhost:8800`.

## Where things are

- The home: `src/routes/_authenticated/index.tsx`, a blank page for now.
- The API client: `src/lib/api-client.ts`. The query client's retry rules:
  `src/app/query-client.ts`.
- The mocked API: `src/test/msw/handlers.ts`, written with `mockRoute`
  (`src/test/msw/mock-route.ts`) and fed by the factories of `src/test/factories/`.
- The stories: `src/stories/Eval.stories.tsx`, under `Evaluation/General`, with the meta of
  `src/stories/eval-meta.tsx`. `src/stories/Eval.stories.spec.tsx` renders every story in the
  tests.
