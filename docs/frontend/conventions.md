# Frontend conventions

These rules apply to every app built on the stack of
[ADR 0031](../adr/0031-frontend-stack-for-agent-built-apps.md), starting with the Desk
(`apps/desk`). The ADR keeps the reasons; this file keeps the rules. Each app adds what is specific
to it in its own `AGENTS.md`, and its `CLAUDE.md` imports both files. `apps/web` follows its own
rules (ADR 0010, 0011 and 0012) until each of its apps is rebuilt here.

A tool checks every rule it can. The app's `npm run check -w <app>` gives the verdict: the
typecheck, Biome with the app's GritQL plugins (`biome-plugins/`), the component files check,
dependency-cruiser, knip, the translation checks and Vitest. It passes after each significant
change, on top of the repository's completion criteria. A plugin's false positive is silenced
where it occurs, with `// biome-ignore lint/plugin/<plugin>: <why>`. What no tool sees goes to the
`frontend-conventions-reviewer` agent, which the `end-feature` skill runs before the PR.

## Before you write code

- Read the root `CLAUDE.md`, this file, the app's `AGENTS.md`, and `apps/api/CLAUDE.md` when the
  task touches the app's endpoints. These files win over habit.
- Follow the patterns already in the app. When in doubt, start from the reference file the app's
  `AGENTS.md` names for that kind of code and imitate it, then read the library's documentation.
- Never guess an API. A signature comes from the types in `node_modules` (at the root, or in the
  app's own when it pins another version): they describe the exact version installed, where the
  documentation and memory may describe another. How and why come from the official
  documentation, starting with the pages the rules below link. Most of them serve Markdown for
  agents, which costs the fewest tokens: a TanStack, react.dev, shadcn or Base UI page with `.md`
  added, and `llms.txt` elsewhere (`https://zod.dev/llms.txt`, `https://vitest.dev/llms.txt`,
  `https://storybook.js.org/llms.txt`). TanStack Table is read under `/table/v8/`, the version
  installed. When the documentation contradicts these rules, stop, explain, propose a change and
  wait for a human's go.
- Reading `apps/web` to learn what a screen does today is fine. Its code is never imported, copied
  or taken as a model. Two exceptions were copied once, each with a human's go: the sign-in
  module at the start, and the Desk's dictation, on the browser's speech recognition.
- Ask a human before an architecture decision, a new dependency, a version change or an action on a
  shared or remote system. A human types every secret.
- One way to do each thing, little magic, small verified changes, and no unrequested refactor
  alongside a feature.

## Stack

| Layer | Choice |
|---|---|
| App | React 19 with the React Compiler, Vite, TypeScript in strict mode |
| Routing | TanStack Router, file-based through its Vite plugin |
| Server state | TanStack Query |
| API client | `lib/api-client.ts`, one `fetch` wrapper driven by the route objects and their schemas |
| Validation | Zod 4, in the app's contracts package: the schemas of what it sends and reads |
| Forms | React Hook Form, `zodResolver`, shadcn `Field` components |
| Tables | TanStack Table v8, rendered with the shadcn `Table` |
| Text | Lingui: English in the components, French in a PO catalog |
| UI | Tailwind CSS v4, shadcn/ui on Base UI generated into the app, `cva`, `cn()` from `cn`, lucide-react, sonner |
| Chat and content | `@shadcn/react` for the message scroller, streamdown and shiki for Markdown and code, `@modelcontextprotocol/ext-apps` and `sdk` for MCP Apps, Tiptap for the message box (document, paragraph, text, code and hard break only: any other extension waits for a human's go) |
| Sign-in | `oidc-client-ts`, in the app's `lib/auth/` |
| Tests | Vitest with Testing Library and happy-dom, MSW 2, Storybook 10, Playwright |
| Quality | Biome, dependency-cruiser, knip |

No Redux, react-router, axios, i18next or Radix. Zustand is the only client store
allowed, for real global client state and with a human's go. A library enters with its first use,
at its latest stable version, in one deliberate update of the root `package-lock.json`: shared
libraries keep the version the monorepo resolves, so the bundle holds one React and one Zod. The
app is an npm workspace: npm is the only package manager, there is no git hook, and CI is the gate.

## Folders and boundaries

```text
apps/<app>/
  AGENTS.md, CLAUDE.md
  .storybook/               Storybook's config: the app on the MSW handlers, in the mock mode
  public/theme/             default theme files, replaced by each install's own
  src/
    app/                    config, query client, router, providers, i18n
    routes/                 thin file-based routes; routeTree.gen.ts is generated and committed
    features/<feature>/
      api/                  keys.ts, queries.ts, mutations.ts
      components/           components of the feature, skeletons included
      hooks/                hooks that do not touch the network
      schemas.ts            schemas of the app only: a form with no endpoint, a .refine, the
                            search params of a route
      load-*.ts             the loaders of the feature's routes
      index.ts              what the rest of the app may import, and nothing more
    components/ui/          shadcn components, generated by its CLI
    components/shared/      compositions shared by features
    hooks/                  hooks shared by features, such as `useNow`
    lib/                    api-client.ts, auth/, and code shared by features: `polling.ts`,
                            `not-found.ts`, `start-query.ts`, `agent-params.ts`, `has-own-key.ts`
    locales/                en.po (source), fr.po
    stories/                stories of the whole app, one per state of its mocked world
    styles/global.css       Tailwind and the design tokens; shadcn.css, which shadcn needs
    test/                   setup, MSW handlers, fixture factories, render helpers
```

dependency-cruiser (`.dependency-cruiser.cjs`) enforces these, and knip reports unused files,
exports and dependencies:

- `routes/` imports feature `index.ts` files, `components/`, `lib/` and `app/`.
- A feature imports another feature through its `index.ts` only, and preferably not at all: shared
  code moves to `lib/` or `components/shared/`.
- `components/` and `lib/` import neither `features/` nor `routes/`.
- The app imports nothing from another app or from a package another app owns. Its only workspace
  dependency is its contracts package. Only `lib/auth/` imports `oidc-client-ts`.
- `src/test/` serves the tests and the stories only: no app code imports it.
- No cycles.

Both tools only see imports. Never bring another app's code in by copying a file, importing its CSS
or editing the boundaries' configuration.

## Code

- **TypeScript.** No `any`, `@ts-ignore` or `!` assertion. An `as` carries a comment that proves it
  safe, and a `@ts-expect-error` a comment that explains it. Types are derived (`z.input`,
  `z.output`, router inference) and never redeclared. `type` by default, `interface` only to extend
  another interface, `import type` for types, and string unions or `as const` objects instead of
  enums. Parameter properties and other syntax `erasableSyntaxOnly` refuses are out.
- **Exhaustive by construction.** A value per member of a union of the contracts is a map typed
  `satisfies Record<XxxDto, …>` (`CSV_RUN_STATES`), never `Record<string, …>` with a fallback, and
  a `switch` over a union ends with `default: return value satisfies never`. A key read from data
  indexes an object only through `hasOwnKey` (`lib/has-own-key.ts`): `in` and a plain lookup also
  match inherited keys such as `constructor`.
- **Components.** One exported component per file, named like the file (`ProjectCard.tsx` exports
  `ProjectCard`), with named exports only; a default export is for config files
  (`scripts/check-component-files.mjs` checks the files in `PascalCase.tsx`). A function stays
  under 200 lines, blank lines aside (Biome's `noExcessiveLinesPerFunction`, specs excepted): a
  component beyond splits into sub-components or hooks. Presentational
  components take props and return JSX, and their logic lives in hooks. Props are typed by a
  `ProjectCardProps` type declared just above the component. No `useEffect` to derive state, to
  sync server data or to pass data up to a parent: compute it, let TanStack Query hold it, or call
  the parent's callback where the data arrives. An effect subscribes to something outside React
  (a DOM event, the router, a timer); a callback it reads goes through `useEffectEvent`, never a
  ref written during render. The `no-effect-setting-state` plugin catches an effect that only sets
  a state. Docs: [You might not need an
  effect](https://react.dev/learn/you-might-not-need-an-effect.md),
  [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent.md).
- **React Compiler.** A component or hook the compiler gives up on fails the dev server, Storybook
  and the tests, with the compiler's reason (`panicThreshold` in `vite.config.ts`). Rewrite the
  code it names, whether it breaks a rule of React or uses a syntax the compiler does not handle
  yet (`??=`, an optional call inside a `try`). `"use no memo"` is kept for a library the compiler
  cannot follow, such as TanStack Table v8, with a comment. Docs: [React
  Compiler](https://react.dev/learn/react-compiler.md),
  [`"use no memo"`](https://react.dev/reference/react-compiler/directives/use-no-memo.md).
- **Naming.** Component files in `PascalCase.tsx`, other files in `kebab-case.ts(x)`. Hooks are
  `useXxx`, internal handlers `handleXxx`, handler props `onXxx`, booleans `isXxx`, `hasXxx` or
  `canXxx`. Loop variables get descriptive names.
- **Logs.** No `console.log`; `console.error` only for real errors.
- **Configuration.** `src/app/config.ts` is the only file that reads `import.meta.env`. It reads
  `window.__CONFIG__` first, then the build's `VITE_*` values, validates them with Zod at startup,
  and holds nothing secret. The client calls `/api` on the page's origin and reads no API URL.

## Routing and data loading

- A route file's path is its URL. Route files compose features and hold no business logic. A
  route's tests sit next to it as `*.spec.tsx`, which the router plugin ignores.
- Search params are validated by Zod schemas given directly to `validateSearch`, kept in the
  feature's `schemas.ts`, and path params through `params.parse`: `uuidParams("agentSessionId")`
  (`lib/not-found.ts`) makes a page whose id is not a UUID not found, before any request. The URL
  holds filters, pagination, sorting and tabs, and a loader that reads search params declares them
  in `loaderDeps`. Docs: [search params](https://tanstack.com/router/latest/docs/framework/react/guide/search-params.md), [path params](https://tanstack.com/router/latest/docs/framework/react/guide/path-params.md).
- A loader starts every query its screen needs, in parallel, through the router context:
  `context.queryClient.query({ ...xxxQueryOptions(...), staleTime: loaderStaleTime })`
  (`lib/start-query.ts`): the cached data as it is, unless a mutation invalidated it, which a plain
  `"static"` would ignore for a query no component observes. Loaders live in
  the feature's `load-*.ts` as `loadX(queryClient, params, deps?)`, where `params` are the route's,
  and wrap their reads in `orNotFound` (`lib/not-found.ts`), which turns the API's 403, 404 and 422
  into the not-found page. A guard shared by routes, such as `requireAgentType`, lives in a
  feature, never repeated in each route. Docs: [data loading](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading.md), [with TanStack
  Query](https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading.md).
- Components read with `useSuspenseQuery` or `useSuspenseQueries`, so data is always defined: no
  `isLoading`, no `data?.`, no `if (!data)`. A component never chains `useSuspenseQuery` calls on
  queries its loader did not start. Docs: [Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense.md).
- Each route that loads data has a `pendingComponent` shaped like the page (skeletons, never a
  full-page spinner), which the router shows after 200 ms and keeps at least 300 ms
  (`defaultPendingMs`, `defaultPendingMinMs`), so a fast page shows none and a slow one does not
  flash it, and an `errorComponent` whose retry resets the query (`RouteErrorState` in
  `components/shared/`). A section that must not block its page starts its query unawaited in the
  loader with `startQuery` (`lib/start-query.ts`; `prefetchQuery` is deprecated) and waits in a
  local `Suspense` with its own skeleton, as the Desk's sidebar history does. `__root.tsx` holds the
  global error boundary and the not-found page.
- `useQuery` is an exception, justified in a `// useQuery: <why>` comment in the same function,
  which the `use-query-justified` plugin requires: a conditional query, optional data such as a
  badge, or live search with `placeholderData: keepPreviousData` (docs: [placeholder
  data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data.md)).
- Each feature has a query key factory in `api/keys.ts` (`accountKeys.me()`), and each query is a
  `queryOptions` factory in `api/queries.ts`, shared by loaders and components. The cache is read
  and written through `xxxQueryOptions(...).queryKey`, which carries the data's type, never through
  a bare key and a type argument (`setQueryData<T>`). The router's
  `defaultPreloadStaleTime` is 0. Queries never retry a 4xx, a broken contract or an ended
  session, and mutations never retry. Docs: [query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys.md), [query
  options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options.md).

## Network code, mutations, forms and tables

- Every network call lives in `features/<feature>/api` on top of `lib/api-client.ts`, streams and
  signed-URL uploads included, and takes its types from the route's schemas. No component calls
  `fetch`. An upload is one mutation that presigns, sends the bytes and confirms.
- `apiRequest(route, { params, query, body, signal })` takes the params and the query as their
  schemas output them, encodes them with `z.encode`, parses the body with its schema and sends it in
  `{ payload }`, and returns the response's `data` parsed with the route's schema. It keeps the
  params the route declares, so a caller passes the params it holds as they are (a conversation's to
  a route of its agent); their types come from the contracts (`AgentParamsDto`), never written by
  hand. Only the router needs them exact: `agentParamsOf` (`lib/agent-params.ts`). A request the
  schemas refuse is an `InvalidRequestError`, never retried. A 401 refreshes the token once, then
  starts a new sign-in. An error answer becomes an `ApiError` with its parsed body, and a response
  the schema rejects a `ContractMismatchError`, whose error page offers to reload.
- Mutation hooks call the client and refresh the cache one way: `onSuccess` writes data the
  answer gives with `setQueryData`, and `onSettled` returns the invalidation of exactly what
  changed, on a 500 too, so the mutation settles once the data is fresh and its caller's next page
  reads it. A deletion removes the entity's own queries (`removeQueries`), or a step back in the
  browser would show it again. Mutations never suspend: the UI reads `isPending`. Optimistic
  updates are kept for the places whose UX needs them, starting with the chat. Docs:
  [invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations.md), [updates from a
  response](https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses.md).
- Feedback: a toast at the call site, through `mutate`'s callbacks; at hook level only when the
  caller may unmount before the answer, with a comment saying so; an inline error only inside a
  dialog.
- Forms use React Hook Form with `zodResolver(schema)`, where the schema is the route's input
  schema in the contracts package, the same rules as the API's `ZodValidationPipe`. A form may add
  a `.refine` for a UX rule the server does not need. Fields are `Field`, `FieldLabel` and
  `FieldError` bound through `Controller`, with no `Form` wrapper. `useWatch` replaces `watch()`.
  `zodResolver` infers the form's types (no `useForm<XxxDto>` argument). The resolver shows field
  errors before the form is sent; a failure from the API becomes a toast. The form submits one
  way, `form.handleSubmit((values) => mutation.mutate(values, { onSuccess, onError }))`, never
  `mutateAsync`, which React Hook Form rethrows as an unhandled rejection. The submit button is
  disabled while `isPending`, and a submitted form confirms its outcome with a toast. A limit the
  text names (a size, a length) comes from the contracts and reads through `Intl`. Docs: [shadcn's
  forms](https://ui.shadcn.com/docs/forms/react-hook-form.md),
  [`useWatch`](https://react-hook-form.com/docs/usewatch.md).
- Every data table goes through one `DataTable` in `components/shared/`, with its column
  definitions in `features/<feature>/components/<entity>-columns.tsx`. A server-paginated table
  keeps its state in validated search params and uses TanStack Table's manual pagination, sorting
  and filtering. A small list loaded whole sorts and filters on the client. Every table has an
  empty state and a skeleton. TanStack Table v8 changes its table in place, which the React
  Compiler cannot memoize: a component that calls `useReactTable` opens with the `"use no memo"`
  directive and a comment that says why, which the `table-without-memo` plugin checks. Docs:
  [pagination](https://tanstack.com/table/v8/docs/guide/pagination.md),
  [sorting](https://tanstack.com/table/v8/docs/guide/sorting.md).
- State, in order of preference: a derived value, `useState`, the URL, TanStack Query. Server data
  is never copied into a client store; seeding a form from a query is fine. No empty `catch`.

## Streams

- A stream is read with `fetch` and a reader that also accepts Nest's `id:` lines, never with
  `EventSource`, which cannot send the bearer token. Every event is parsed with the route's event
  schema.
- A chat reply is a mutation that writes into the conversation's query cache with `setQueryData`.
  A stream that closes with no `end` or `error` event fails the reply, and leaving the page aborts
  it. A reader that stops early cancels the response, so the connection closes too.
  `experimental_streamedQuery` is not used.
- Work the API runs in the background with no stream, such as an extraction, is polled: its query
  sets a `refetchInterval` while its status is pending, and returns `false` once it settles.

## UI and styling

- The shadcn CLI generates the components into `src/components/ui/` from the app's
  `components.json`, on Base UI (`"style": "base-nova"`). Add one with `npx shadcn@latest add
  <name>`, and update one by generating it again (`add <name> --overwrite`). Never write one by hand
  or copy it from `packages/ui`. Change a generated component only when composition falls short,
  minimally and with no business logic. Extend components with `cva`.
- Base UI composes with a `render` prop where Radix used `asChild`. A link styled as a button is a
  `Link` with `buttonVariants()`, so it keeps its link role. Docs:
  [composition](https://base-ui.com/react/handbook/composition.md).
- Tailwind only: no stylesheet, CSS module or inline style beyond `src/styles/global.css`, which
  loads Tailwind, the stylesheets shadcn relies on and the design tokens. The token values are the
  platform's (`packages/ui/src/global.css`). Conditional classes go through `cn()`, colors and
  spacing come from the tokens, with no arbitrary values.
- The install's theme (`theme.css`, logo, favicon) is read at runtime from `<base>/theme/`, where
  each install mounts its files over the defaults of `public/theme/`.
- Semantic elements, a label on every field, keyboard navigation and a meaningful `alt` on every
  image are required. `<html translate="no">` stays, because browser translation breaks streamed
  text.

## Text and translations

- Components hold their English text through Lingui's macros: `<Trans>` in JSX, `t` from
  `useLingui()` in attributes and toasts, `<Plural>` and `plural` for counts, `msg` for text
  defined outside a component. Variables and inline components go inside the message
  (`<Trans>Delete {title}?</Trans>`). Name a variable before you put it in a message, so the
  catalog says `{count}` rather than `{0}`. Docs: [macros](https://lingui.dev/ref/macro.md),
  [`useLingui`](https://lingui.dev/ref/react.md).
- The same English with two meanings gets a `context`, and a `comment` tells the translator what a
  short text refers to. Zod messages shown in forms go through Lingui too.
- After a text changes, run `npm run i18n:extract -w <app>` and write the new French entries of
  `src/locales/fr.po` in the same change. The catalogs record each message's file and line, so a
  change that only moves code needs an extract too. `i18n:check` (`lingui check sync` and
  `lingui check missing`) fails the PR on a stale catalog or a missing French translation.
- Lingui's agent skills (the `lingui` plugin of the `lingui/skills` marketplace, declared in
  `.claude/settings.json`) cover the macros, translator comments and text left outside a macro.
  When a skill and these rules disagree, these rules win.
- Dates and numbers go through `Intl`. The app keeps its own language: the person's pick in the
  user menu, else the browser's language. Code, identifiers, commits and source texts are in
  English.

## Tests

- Tests and stories are part of every change, never a follow-up. A new behaviour comes with the
  spec that checks it, a new state of a screen (empty, loading, error, a role, a long list) with
  its story, and a changed screen updates its specs and stories in the same change. They show what
  a change breaks, on purpose or not, so a change without them is not done.
- Vitest runs two projects: `*.spec.ts` in node for pure logic (the client, the sign-in, schemas),
  and `*.spec.tsx` in happy-dom for components and routes. A test checks what a person sees,
  queries by role and label in English, and uses `data-testid` as a last resort.
- The network is mocked with MSW only, never by mocking TanStack Query, `fetch` or the client.
  Handlers live in `src/test/msw/` and are written with `mockRoute(route, resolver)` and
  `mockStreamRoute` (`src/test/msw/mock-route.ts`), from the contracts' routes: they never write a
  path, and the route's schemas check what they read and answer. Their fixtures come from
  factories in `src/test/factories/` whose output goes through the response schemas.
- `src/test/setup.ts` gives every test a fresh mocked world, a signed-in session and empty
  storage, so a spec holds none of that setup. `renderApp(url)` renders the whole app at a URL on
  the mocked API, with the app's query client (`createQueryClient({ isRetrying: false })`);
  `renderWithI18n(ui)` renders a component with the active locale, and `writeMessage(box, text)`
  (`src/test/message-box.ts`) writes in the message box as a paste does: the tests' DOM drops
  letters typed one key at a time into its editor. URLs come from
  `src/test/desk-urls.ts`, whose helpers throw when the world lacks what they name.
- Storybook (`npm run storybook -w <app>`) serves the app on the same handlers, without the API
  or a sign-in, in Vite's `mock` mode. A story of the whole app builds its own world of the
  handlers and opens a page of it, from which the person goes anywhere, as in the app: one story
  per state of the world (several projects, no agent, terms to accept, a failure, a long load),
  and one per page worth showing. A component with states of its own may add stories next to it.
  The stories answer the app's `fetch` calls with MSW's `getResponse` rather than a Service
  Worker, which the browser of Claude Desktop cannot register. `src/stories/Desk.stories.spec.tsx`
  renders every story in the tests, so `check` covers them. Nothing of the mock mode reaches the
  production build.
- Playwright covers the critical journeys against a worktree environment, once they exist.
- Every bug fix comes with the test that would have caught it. Ids in tests come from
  `crypto.randomUUID()`.

## The contract

Each app keeps, in a contracts package of its own (the Desk's is `packages/desk-contracts`), the
routes of the API it calls and the Zod schemas of what it sends and reads. The package depends on
Zod alone and imports nothing from `packages/api-contracts`, and the API does not import it during
the first phase (see Endpoints). One folder per area holds `{area}.dto.ts` and `{area}.routes.ts`.

- A route is declared with `defineSchemaRoute({ method, path, params, query, body, response })`.
  It returns the shape of `defineRoute` plus its `schemas`, refuses at compile time a `params`
  schema whose keys differ from the path's `:name` segments, and adds the `{ payload }` and
  `{ data }` envelopes.
- A response schema declares the fields the app reads, and only those: `z.object` strips the
  others, so the app never depends on a field it does not declare. A response the schema rejects
  raises a `ContractMismatchError`.
- Schemas are named by role (`createConversationInputSchema`, `meOutputSchema`), and their types
  take the `Dto` suffix: `z.input` for what a client sends, `z.output` for what it gets. A DTO is
  never written by hand.
- The package defines its own enums and constants with `z.enum` and `as const` objects
  (`DESK_UI_READ_PERMISSION`).
- Response schemas use JSON types only, with no transform, pipe or codec. Dates are epoch
  milliseconds, as the API sends them. Ids are `z.uuid()`, enums `z.enum`, input objects
  `z.strictObject`. A field that may have no value is `.nullable()`.
- Query values travel as strings: numbers use `z.coerce.number<string>()`, flags `z.stringbool()`,
  a sort key is a `z.enum`, and nested filters travel as one JSON parameter through a `z.codec`.
  The client builds the query string with `z.encode`. Docs: [codecs](https://zod.dev/codecs).
- Lists keep the API's offset pagination (`items`, `total`, `page`, `limit`, a 0-based page and a
  limit of 100 at most).

## Endpoints

In their first phase, the apps of this stack are built on the API as it is. `apps/api` changes as
little as possible, and only in its usual way: its backend is rebuilt once the app's screens are
right.

- An app reads the existing endpoints when they hold what a screen needs, even if that takes
  several queries: the Desk's home reads `me`, `projects/mine` and `organizations/mine`. It
  filters on the client what the API returns for every app, as apps/web does: the Desk keeps the
  projects that grant `desk.ui.read`.
- A missing endpoint is written like the other routes and controllers of `apps/api`, as
  `apps/api/CLAUDE.md` asks: a `defineRoute` route and its DTOs in `packages/api-contracts`, a
  controller with the usual guards and `@CheckPermission`, and a body checked with
  `@UsePipes(new ZodValidationPipe(schema))`, as `AgentsController` does. The app then declares
  the same route in its contracts package, with the schemas of what it reads.
- A 400 from `ZodValidationPipe` carries the Zod errors in its `message`, as one string.

## Recipes

**An endpoint the app reads**: when an existing one holds the data, its route in the app's
contracts package with the schemas of what the app reads. When none does, the route, the
controller and the e2e specs in `apps/api` first, written as `apps/api/CLAUDE.md` asks. Then the
MSW handler and its factory, the repository's checks, and the app's `check`, whose typecheck proves
the app reads the new types.

**A feature**: its endpoint first when it is missing or must change, then keys, queries and
mutations, components with their skeletons and their English text, `index.ts` with the strict
minimum, the route with its loader, pending and error components, the French translations after
`i18n:extract`, tests and `check`. Last comes a look in the browser, in Storybook or the
worktree environment, at desktop and phone widths, in French and English, with the loading, error
and empty states.

## Definition of done

- `check` passes with no ignored warning, `npm run build -w <app>` works, and the build served under
  its base by `vite preview` loads and reloads a deep link.
- Screens load through their loader and `useSuspenseQuery` with skeletons, each `useQuery` carries
  its justification, error states offer a retry, empty states exist, every new text has its French
  translation, every new behaviour has its spec and every new state its story, and the screen was
  checked at desktop and phone widths.
- No API type is written by hand, and there is no dead code, `console.log`, unflagged TODO or
  unjustified dependency.
- The work ends with a summary of what was done, what remains, the decisions these rules did not
  cover, and the actions left to a human, such as registering a redirect URI with an install's
  identity provider.

## Forbidden

- Redux, a store other than Zustand, or Zustand without a human's go.
- `fetch` in a component; a text shown to people outside a Lingui macro.
- `any`, `@ts-ignore`, a `!` assertion, or an `as` without a comment proving it safe.
- A secret in code, the configuration, a `VITE_*` value, a log or a commit, and a committed local
  `.env` file.
- Code copied from one feature into another instead of moved to `lib/` or `components/shared/`.
- An import from another app or from a package another app owns.
- A Tiptap extension or plugin beyond those of the stack without a human's go, given before it is
  installed. An extension reads what the person pastes or drops and decides what the editor turns
  into HTML: links, images, embeds or raw HTML open a way for injected content and data leaks.
- Editing an `AGENTS.md`, this file, a tsconfig, the app's `biome.json`, or the dependency-cruiser,
  knip, Lingui, Vitest or Playwright configuration without a human's go.
- Disabling a lint rule, a type check, a translation check or a test to make `check` pass.
