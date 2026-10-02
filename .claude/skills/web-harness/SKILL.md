---
name: web-harness
description: Run the real web app without the identity provider or the API, with mocked services and controllable latency, then drive it with headless Chromium. Use to reproduce a front-end crash, race condition or loading bug (for example "only on hard reload", "only in production", "hidden by StrictMode"), to check a fix before and after, or to screenshot a page state that needs specific data.
---

# Web harness

`apps/web/harness/` mounts the real `App`: store, router, listener middleware, route wrappers and components. Two modules are swapped at build time in `harness/vite.config.ts`:

- `react-oidc-context` becomes `auth-stub.tsx` and `@/external/oidcClient` becomes `oidc-client-stub.ts`, so the user is always signed in and no provider is contacted.
- `@/external/axios.services` becomes `mock-services.ts`. Every service call resolves to a scenario fixture after a delay you control.

Everything above the services runs unchanged, so timing bugs between thunks, listeners and `AsyncRoute` gates behave as they do in production. StrictMode is off by default, because its double mount hides those bugs.

Use Storybook instead when you only need a component in a given state. Stories seed Redux directly and do not run the listener middleware, so they cannot reproduce a loading race.

## Run it

From `apps/web`:

```bash
npm run harness &                # dev server on http://localhost:5198, readable stacks
npm run harness:probe -- --query "delays=agentSettings.getAll:1500"
```

`/harness` opens the scenario's own page. To match a production report (minified names such as "Value for o is not available"), use the build instead:

```bash
npm run harness:build && npm run harness:preview &   # http://localhost:5199
npm run harness:probe -- --base http://localhost:5199
```

Stop the servers when done (`pkill -f "[h]arness/vite.config.ts"`; the brackets keep `pkill` from matching its own shell). The ports are fixed (`strictPort`), so a leftover server makes the next start fail.

## Page parameters

Pass them in the URL or with `--query`:

| Parameter | Effect |
|---|---|
| `scenario=<key>` | Fixtures to serve, from `harness/scenarios/index.ts` (default `eval-extraction-dataset`) |
| `min=20&max=400` | Random delay range in ms applied to every call |
| `delays=agents.getAll:900,agentSettings.getAll:1500` | Fixed delay for some calls |
| `fail=agentSettings.getAll` | Calls that reject, to see error states |
| `strict=1` | Wrap the app in StrictMode, to compare with dev behavior |

Call keys are `<service>.<method>`, as named in `src/di/services.ts` and the feature `*.spi.ts` files.

## Probe options

`harness/probe.mjs` loads the page in headless Chromium, waits, and prints JSON per run: whether React Router's error page appeared, console and page errors, page text, and the service calls that had no fixture. It exits 1 when any run crashed.

| Option | Use |
|---|---|
| `--runs 10` | Repeat cold loads, useful with random delays |
| `--at 900` | Extra snapshot before the final one, to see a loading state |
| `--wait 3000` | Time before the final snapshot |
| `--selector "tbody tr"` | Print the text of matching elements at each snapshot |
| `--screenshot <dir>` | Save a full-page PNG per snapshot (Tailwind is loaded, so it matches the app). Read the PNG to inspect it |
| `--calls` | Print the call and resolve timeline |
| `--tree` | Print the React component tree, to find which component renders nothing (dev server only) |
| `--path /eval/...` | Open another page than the scenario default |

Playwright is not a repo dependency. The probe uses `PLAYWRIGHT_CORE` if set, a local `playwright-core` install, or one from the npx cache, and keeps the first one whose Chromium launches. If none works, run `npx -y playwright-core@1.56.0 install chromium`.

## Reproduce a bug

Start from the report's URL and add a scenario if none serves that page. Make the suspected call slow (`delays=`) and check that the probe crashes. Then make it fast and check that it does not: a crash that follows the latency of one call points at the component that reads that data before anything waits for it. Use `--calls` to see the order of calls and `--tree` or the dev stack trace to find the component.

To check a fix, run the same probe on the fixed code and on the old code (`git show main:<file> > <file>`, then `git checkout -- <file>`). Report both results.

## Add a scenario

Create `harness/scenarios/<name>.ts` exporting a `Scenario` and register it in `scenarios/index.ts`:

- `buildWorkspace({ featureFlags })` gives the logged-in user, the organization `org-1`, the project `proj-1` and their fixtures. Spread its `fixtures` first.
- Build data with the feature factories (`*.factory.ts`), never with inline literals, and keep sample data domain-neutral.
- A fixture is either the resolved value or a function of the call arguments, for example `"agentSettings.getAll": ({ agentId }) => settingsByAgentId[agentId]`.
- Set `path` with the route helpers (`EvalRoutes.extractionDataset.build(...)`).

Run the probe once and fill in the keys listed in `missingFixtures`. Unknown calls resolve to `[]` for `getAll` and `list`, and to `undefined` otherwise, which can produce misleading errors. A blank page under `ProtectedRoute` usually means `me.getMe` does not return `{ user, currentTerms }` with `termsAccepted: true`.

## Limits

- No network layer runs, so axios interceptors, auth headers and real response mapping in `external/*.api.ts` are not exercised. Fixtures must already be domain models.
- Server-sent event streams resolve like any other call and never push events.
- `npm run typecheck` and `biome:check` cover `harness/`, so keep it compiling when a service or factory changes.
