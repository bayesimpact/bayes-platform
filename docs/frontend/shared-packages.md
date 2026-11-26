# Shared packages

The packages no app owns, which the apps of the stack of
[ADR 0031](../adr/0031-frontend-stack-for-agent-built-apps.md) share. This file is the one list
of them: what each one holds, who imports it, what it may depend on, what it must not hold and
what to run after a change. The ADR keeps the reasons each one was shared, and
[the conventions](conventions.md) keep the rules of the apps. When another file and this one
disagree on a shared package, this one wins: fix the other.

Read the row of a package before you change it. A change to a shared package reaches every app
that imports it at once.

## The packages

| Package | Holds | Imported by |
|---|---|---|
| `packages/permissions` (`@caseai-connect/permissions`) | The RBAC permission catalog: the one place a permission string is declared | `api-contracts`, which re-exports it for the API and `apps/web`; the Desk and Evaluation contracts, which re-export the constants their apps read |
| `packages/schema-route` (`@caseai-connect/schema-route`) | `defineSchemaRoute`, `defineStreamRoute`, the types of a route and the body of an error response | The Desk and Evaluation contracts, which re-export it; the API's `src/common/schema-route/`; `api-client`; `chat-contracts` |
| `packages/chat-contracts` (`@caseai-connect/chat-contracts`) | The chat's Zod schemas (a conversation, its forms, the documents its replies cite), the params of a project's and an agent's routes, and the routes of a conversation and of its documents under an app's project path (`conversationRoutesAt`, `documentsRoutesAt`) | The Desk and Evaluation contracts, which re-export it and declare its routes under their `PROJECT_PATH`; `chat` |
| `packages/sign-in` (`@caseai-connect/sign-in`) | The OIDC client on the session every app of the origin shares, the guards against sign-in loops, the reading of the provider's and the API's sign-in refusals, the `login_hint` of an invitation's link | The `lib/auth/` of the Desk and of Evaluation, and nothing else of an app; `api-client` |
| `packages/api-client` (`@caseai-connect/api-client`) | `createApiClient` on the app's session, the reading of server-sent events, the retry rule of the queries | The `lib/api-client.ts` of the Desk and of Evaluation, and nothing else of an app |
| `packages/frontend-lib` (`@caseai-connect/frontend-lib`) | Hooks and helpers that hold nothing of an app: the loaders' `startQuery` and `loaderStaleTime`, `pollWhile`, `hasOwnKey`, dates and sizes on `Intl`, the safe URLs, the upload to a signed URL, the highlights of quoted passages, `useNow`, `useMediaQuery`, `useResizableWidth`, `useSpeechRecognition` (its `src/index.ts` lists them) | The Desk and Evaluation, directly, from any folder; `chat` |
| `packages/chat` (`@caseai-connect/chat`) | The chat's logic and hooks: its messages and the stream of a reply (`toChatMessages`, `applyReplyEvent`), the annotations and quoted passages, the task checks, the MCP Apps and the resources of a reply, the document of the message box, the form that reports a problem with a reply | The Desk and Evaluation, directly, from any folder |
| `packages/app-ui` (`@caseai-connect/app-ui`) | The shadcn components on Base UI, the `use-mobile` hook, `shadcn.css` and the stylesheet of the design tokens (`globals.css`); compositions written by hand that know no feature (`src/compositions/`: `SidePanel`, `HeaderActions`, `CopyButton`, `RelativeTime`, `ExternalLink`) and their catalog of translations (`src/locales/`) | The Desk and Evaluation: each component and each composition by its path, the catalog through `loadMessages` of `@caseai-connect/app-ui/locales`, and `globals.css` from the app's `global.css`. `npx shadcn@latest add`, run in an app, writes into `src/components/` |
| `packages/frontend-config` (`@caseai-connect/frontend-config`) | The Biome rules of the apps (`biome.app.json`), the GritQL plugins and the `check-component-files` check | The `biome.json` of the Desk, of Evaluation, of `frontend-lib`, of `chat` and of `app-ui`, which extend it; each app's `check:components` script |
| `packages/mcp-app-host` (`@caseai-connect/mcp-app-host`) | The sandbox of MCP Apps: the page of the outer frame, the transport between the frames, the Content Security Policy, the checks on what an app asks for | The Desk, Evaluation, `apps/web` and `apps/web-embed`; `chat` |

The chat is shared in part. Its components, its calls to the API and the hooks and helpers that
show a text or call the API are still copied in the Desk and in Evaluation, and Evaluation's
`check:desk-parity` compares the copies.

`packages/desk-contracts` and `packages/eval-contracts` are not shared: each belongs to its app.
`packages/ui` and `packages/api-contracts` belong to `apps/web` and the API, and are out of
bounds for the apps of the stack.

## Limits

Every shared package follows these:

- No app owns it, and it holds nothing only one app needs. What differs by app stays in the app,
  which passes it in (a base path, a session, a project path) or keeps it around the package
  (its texts, its placeholder, its mock mode).
- It shows no text to people, unless it has a catalog of its own (`src/locales/`, as `app-ui`
  has). Each app's `lingui.config.ts` declares that catalog as a second one, so the app's
  `i18n:extract` writes it and its `i18n:check` checks it. Each app's `activateLocale` loads it,
  and the app's own messages win for a message both hold. A text that names an app stays in the
  app.
- It follows the TypeScript options of the stack (`erasableSyntaxOnly`, `verbatimModuleSyntax`).
- knip runs on no shared package, so no tool reports an export nobody imports any more. The
  `index.ts` of `frontend-lib` and of `chat` exports by name what the apps import: a change
  that removes the last use of an export removes the export too.

Each package adds its own. A dependency or an import beyond its list, test tooling aside, needs a
human's go, as a new shared package does.

| Package | May depend on | Must not hold |
|---|---|---|
| `permissions` | Nothing | A dependency, an import, an enum, a text shown to people. Strings, string unions and pure functions only |
| `schema-route` | Zod | A route, a schema of an app, React, an import of another workspace package |
| `chat-contracts` | Zod, `schema-route` | A route or a schema only one app reads, React |
| `sign-in` | `oidc-client-ts`, Zod | React, a component, a style, a contract, an import of another workspace package |
| `api-client` | Zod, `schema-route`, `sign-in` | A route, React, the app's session (it takes it from the app) |
| `frontend-lib` | React and TanStack Query, as peers | A component, a style, a contract, the app's configuration, a route beyond the library file link `toResourceUrl` checks, a network call beyond `putFileToSignedUrl`, an import of another workspace package |
| `chat` | React as a peer, Zod, `chat-contracts`, `frontend-lib`, `mcp-app-host` | A component, a style, a call to the API, the app's configuration, what only one app shows (the Desk's memory) |
| `app-ui` | Base UI, `cva`, `cn`, lucide-react, sonner, `cmdk`, `@shadcn/react`, tw-animate-css, `frontend-lib`, React and React DOM as peers, Lingui (`@lingui/core`, `@lingui/react`) as peers | In `src/components/`, a component the shadcn CLI did not generate; in `src/compositions/`, a component that knows a feature or that one app alone uses; business logic; a text outside its catalog; an import of another workspace package beyond `frontend-lib` |
| `frontend-config` | Nothing | A rule for one app only, a dependency |
| `mcp-app-host` | `@modelcontextprotocol/ext-apps`, `@modelcontextprotocol/sdk` | React, a component, a style, a contract, an import of another workspace package |

## Build and checks

The apps read every shared package as source, with no build: its `exports` point at `src/`, and
each app's Vite plugins, the React Compiler included, compile it with the app's code.
`frontend-config` holds no code of an app: its files are read by path.

The API requires the CommonJS build (`dist`) of `permissions`, `schema-route` and
`chat-contracts`, through the contracts packages. The API image, the `contracts` service of a
worktree environment and its `init.sh` build them before the contracts. In a worktree
environment, run `bayes wt up` after a change to one of them.

| After a change to | Run |
|---|---|
| `permissions` | The repository's completion criteria, and the `check-permission-matrix` skill |
| `schema-route`, `chat-contracts` | Their `typecheck`, the `check` of the Desk and of Evaluation, and in the API `src/common/schema-route/schema-route.spec.ts`, `src/domains/desk/routes.spec.ts` and `src/domains/eval/routes.spec.ts` |
| `sign-in`, `api-client`, `frontend-lib`, `chat` | The package's `test` (`npm run test -w @caseai-connect/chat`), then the `check` of the Desk and of Evaluation |
| `app-ui` | `npm run check -w @caseai-connect/app-ui` (it runs the package's specs), then the `check` and the `build` of the Desk and of Evaluation. After a change to a text, `npm run i18n:extract` in an app |
| `frontend-config` | `npm run biome:check`, then the `check` of the Desk and of Evaluation |
| `mcp-app-host` | Its `test`, then the `check` of the Desk and of Evaluation, and the tests of `apps/web` and `apps/web-embed` |

CI runs the specs of `sign-in`, `api-client`, `frontend-lib`, `chat` and `app-ui` in the Desk's job, and
those of `mcp-app-host` with the web tests. The path filters of `.github/workflows/ci.yml` start
the Desk's and Evaluation's jobs when a package they import changes.

## Adding a shared package

Sharing code between apps is a decision: it needs a human's go and an amendment of ADR 0031
that says why a copy in each app is worse. Code moves to a shared package when it has
one right answer for every app, or when a drift between the copies is unsafe. Code that an app
may want its own way stays in the app.

Then, in one change:

1. The package: `package.json` (its `exports` point at `src/`), `tsconfig.json`, a `biome.json`
   that extends `packages/frontend-config/biome.app.json` when it holds React code, and a
   `vitest.config.ts` with a `test` script when it has specs.
2. `package-lock.json`: the package's two entries and the dependency of each user, written in
   place. Never `npm install`.
3. For a package that shows text: a `src/locales/` catalog per language, which the package loads
   with `import.meta.glob` (`loadMessages`, as `app-ui` does, so only a Vite app loads it); a
   second catalog in each app's `lingui.config.ts`; the call of `loadMessages` in each app's
   `activateLocale`, with the app's messages last; and the two specs of each app's
   `src/app/i18n.spec.ts` (every language of the app is in the package's `LOCALES`, and a message
   both catalogs hold has one translation). A short message that both the package and an app's
   code show stays in both catalogs. A spec never uses a Lingui macro for a text of the package:
   the extraction would put the message back in the app's catalog.
4. Its users. An app that imports it: its `package.json`, and the allowlist of its
   `.dependency-cruiser.cjs` with the comment above it. A package the contracts re-export: the
   `package.json` and the `src/index.ts` of each contracts package, and no entry in an app's
   allowlist. A shared package that depends on it: its `package.json`.
5. `apps/api/Dockerfile`: the `desk-build` and `eval-build` stages and their comments, with every
   workspace package the new one depends on; every stage of the API when the API requires the
   package's build; the `web-build` stage and `apps/web-embed/Dockerfile` when `apps/web` or the
   embed imports it.
6. `.github/workflows/ci.yml`: the path filter of the Desk's and of Evaluation's job, with its
   comment and its skip message, for the package and every workspace package it depends on, and a
   step that runs the package's specs.
7. For a package the API requires: `"main": "./dist/index.js"`, a `require` entry in its
   `exports`, its `build` and `dev` scripts and its `tsconfig.build.json`, as
   `packages/schema-route` has them; then the module map of `apps/api/jest.config.js`,
   `infra/worktree/init.sh` and the `contracts` service of `infra/worktree/docker-compose.yaml`,
   the `API_PATHS` of the `Makefile`, and `dev:workers-main-windows` in `apps/api/package.json`.
8. When the code moved was under Evaluation's `check:desk-parity`: delete both copies, record the
   baseline again (`npm run check:desk-parity -w @caseai-connect/eval -- --update`) and update the
   header of the script.
9. The docs: a row in each table of this file and the package's name in the lists around them,
   its name in the line of the root `CLAUDE.md`, the amendment and the reasons in ADR 0031, and
   what is specific to an app in its `AGENTS.md`. `conventions.md` changes only when the apps
   import the package in a way of their own (through one file, or through their contracts).
