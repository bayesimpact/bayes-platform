# ADR 0011: Frontend Architecture — Routing, Features, Store, Hooks

* **Status**: Accepted
* **Date**: 2026-05-21
* **Deciders**: Alexis
* **Scope**: Everything under `apps/web/src/`. This ADR is the operating manual for the frontend — read it before changing routes, adding features, touching the Redux store, or writing components that talk to the API.

> **Companion ADRs**: [ADR 0009](0009-subroute-data-loading.md) (data loading), [ADR 0010](0010-factory-per-model-and-story-per-route.md) (factories and stories). They are not optional reading — the rules here assume you've read them.

---

## 1. Why this ADR exists

`apps/web` follows the same shape across every scope (studio, desk, eval, tester, reviewer, backoffice). When that shape is broken — even slightly — three classes of bug appear and they are always painful:

1. **Race conditions on SPA navigation** — children fetch before the parent has populated the URL-driven IDs in Redux.
2. **Missing slices at mount** — a child assumes its slice was injected, but no parent root route injected it.
3. **Route plumbing leaking into UI** — route wrappers and leaf components share folders and get imported the wrong way around.

The studio app is the canonical reference. Everything else (desk, eval, tester, reviewer, backoffice) follows the same template. **If you are touching the frontend and you can't tell where your code goes, your answer is: copy the studio.**

---

## 2. Bird's-eye view

```
apps/web/src/
├── common/                            ── shared building blocks (DO use, DON'T modify casually)
│   ├── hooks/                         use-init-store, use-mount, use-set-current-ids, use-value, use-get-path
│   ├── routes/                        Router.tsx, AsyncRoute, LoadingRoute, ErrorRoute, ProjectRoute, AgentRoute, helpers (defineRoute)
│   ├── features/                      me, organizations, projects, agents, agent-sessions, notifications, auth — used by every scope
│   ├── store/                         configureStore, root-slices, dynamic-middleware, types, async-data-status
│   └── components/                    RestrictedFeature, grid components, layout primitives
│
├── {scope}/                           studio | desk | eval | tester | reviewer | backoffice
│   ├── routes/                        <Scope>Routes.tsx registry, <Scope>Route root, sub-route wrappers (FooRoute.tsx)
│   ├── features/<domain>/             one feature module per domain (see §5)
│   ├── store/                         currentIds.slice, slices.ts (createSliceManager), types
│   └── components/                    scope-wide layout (e.g. StudioLayout)
│
├── di/services.ts                     Services type — the typed contract every thunk uses via `extra.services`
└── external/                          axios singleton, axios.services (concrete SPI wiring), auth0 client
```

The studio is the reference. Open [apps/web/src/studio/](../../apps/web/src/studio/) when you're unsure — `documents` is the canonical feature, `DocumentsRoute` is the canonical sub-route, `StudioRoute` + `StudioRoutes.tsx` are the canonical scope root.

---

## 3. The render flow (read this first)

Before any rules, understand what happens when a user lands on `/studio/o/:organizationId/p/:projectId/d`:

1. `Router.tsx` matches `studioRoutes` because the path starts with `/studio`.
2. `<StudioRoute />` mounts. It calls `useInitStore({ inject: injectStudioSlices, reset: resetStudioSlices })`. The studio's slices and listener middleware are now in the live store. `initDone` flips to `true`.
3. After `initDone`, `<StudioRoute>` renders an inner `<Route />` component that calls `useSetCurrentIds(currentIdsActions)`. This reads every URL param (`:organizationId`, `:projectId`, …) and dispatches one `setOrganizationId` / `setProjectId` action per param. The studio's `currentIds` slice is now populated.
4. `<Outlet />` renders the matched child. Shared wrappers `<OrganizationRoute>` and `<ProjectRoute>` block with `<LoadingRoute />` until their selectors return data; sibling listener middlewares pick up the `projectsActions.mount` (or `mount`/`unmount` from a sub-route) and fetch.
5. The leaf sub-route (e.g. `<DocumentsRoute />`) runs `useMount(...)` (if it owns data) and gates the page with `<AsyncRoute data={[…]}>` — its inner `<WithData />` only renders once every async slice is `Fulfilled`, then uses `useValue(...)` to read those values without null checks.

**Two-phase rendering is the entire trick.** Phase 1 (`initDone === false`) injects slices and sets IDs. Phase 2 (`initDone === true`) renders children that assume both are in place. If you skip phase 1, every selector below crashes on first navigation.

---

## 4. Routing

### 4.1 The single entry point

[Router.tsx](../../apps/web/src/common/routes/Router.tsx) is the only place that builds the `createBrowserRouter`. It mounts one route-tree object per scope, wrapped under `<ProtectedRoute>`:

```tsx
createBrowserRouter([
  { path: RouteNames.HOME, element: <HomeRoute /> },
  { path: RouteNames.LOGOUT, element: <LogoutRoute /> },
  {
    element: <ProtectedRoute><Outlet /></ProtectedRoute>,
    children: [onboardingRoute, studioRoutes, deskRoutes, evalRoutes, backofficeRoutes, testerRoutes, reviewerRoutes],
  },
  { path: "*", element: <NotFoundRoute /> },
])
```

**Rule**: never add routes here outside of a scope registry. If you have a new scope, create `apps/web/src/<scope>/routes/<Scope>Routes.tsx`, export the tree, then add it to `Router.tsx`.

### 4.2 One `<Scope>Routes.tsx` per scope

Each scope MUST expose exactly one registry file at `apps/web/src/<scope>/routes/<Scope>Routes.tsx`. The default export is a React Router route-config object.

Reference: [StudioRoutes.tsx](../../apps/web/src/studio/routes/StudioRoutes.tsx).

```tsx
export const studioRoutes = {
  path: StudioRoutes.home.path,                    // /studio
  element: <StudioRoute />,                        // root: injects slices, sets currentIds
  children: [
    {
      path: StudioRoutes.project.path,             // /o/:organizationId/p/:projectId
      element: (
        <OrganizationRoute>                        // shared: gates on currentOrganizationId
          <ProjectRoute>                           // shared: gates on currentProjectId
            <RoutesBuilderProvider build={{ ... }}>// scope's flavour of useGetXxxRoute
              <StudioLayout><AgentList /></StudioLayout>
            </RoutesBuilderProvider>
          </ProjectRoute>
        </OrganizationRoute>
      ),
      children: [
        { path: StudioRoutes.documents.path,  element: <DocumentsRoute /> },
        { path: StudioRoutes.webSources.path, element: <RestrictedFeature feature="web-sources"><WebSourcesRoute /></RestrictedFeature> },
        // ...
      ],
    },
  ],
}
```

**Rules**:
- The outermost entry mounts the **scope root** (`<StudioRoute />`, `<TesterRoute />`, …) — see §4.4.
- The next layer is the **scope's shell** — `<OrganizationRoute>`, `<ProjectRoute>`, your layout, and any scope-wide context provider (e.g. `<RoutesBuilderProvider>`). This layer gates on common data so leaf routes can assume it's there.
- Children of the shell are the **leaf sub-routes**, one per page. Each leaf is a single `*Route.tsx` component (§4.5).
- Cross-cutting access guards go at the route layer with `<RestrictedAccess ability="...">` (auth) or `<RestrictedFeature feature="...">` (feature flag). Don't put them inside leaf components — the registry should make access boundaries obvious.

### 4.3 Define paths with `defineRoute`, never inline strings

[helpers.ts](../../apps/web/src/studio/routes/helpers.ts) builds the scope's path tree once and exports it as `<Scope>Routes`:

```ts
import { defineRoute } from "@/common/routes/helpers"

const home    = defineRoute("/studio")
const project = home.extend("/o/:organizationId").extend("/p/:projectId")
const agent   = project.extend("/a/:agentId")

export const StudioRoutes = { home, project, agent /* ... */ }
```

Every consumer uses `StudioRoutes.agent.path` (for the registry) or `StudioRoutes.agent.build({ organizationId, projectId, agentId })` (for navigation). **You MUST NOT hand-write a path string** — the URL params are typed from the path literal, so `build()` will not compile if you forget one. That's the type system catching bugs you'd otherwise discover via runtime "Cannot read property X of undefined" three navigations deep.

### 4.4 The scope root route — `<Scope>Route.tsx`

Each scope has exactly one root route component, named `<Scope>Route`, that does three things — IN THIS ORDER — and gates children behind `initDone`.

Reference: [StudioRoute.tsx](../../apps/web/src/studio/routes/StudioRoute.tsx).

```tsx
export function StudioRoute() {
  const { initDone } = useInitStore({
    inject: injectStudioSlices,
    reset: resetStudioSlices,
    condition: true,
  })

  if (initDone) return <Route />
  return <LoadingRoute />
}

function Route() {
  useSetCurrentIds(currentIdsActions)
  return (
    <RestrictedAccess ability="canAccessStudio">
      <Outlet />
    </RestrictedAccess>
  )
}
```

**Why the inner `<Route />` component?** `useSetCurrentIds` must run **after** the slice has been injected — otherwise the dispatched `setOrganizationId` lands in a non-existent reducer. Splitting into two components is what guarantees that.

**Rules**:
- The root MUST call `useInitStore` first, then `useSetCurrentIds`, then render `<Outlet />`.
- The root MUST NOT fetch data, render UI other than `<LoadingRoute />`, or read selectors before `initDone`.
- The scope-wide ability guard (`<RestrictedAccess ability="canAccess<Scope>">`) belongs here.

### 4.5 Sub-route wrappers — leaves named `*Route.tsx`

Every entry in `<Scope>Routes.tsx` points at a component whose name ends in `Route`. These components own one page each. They live in `apps/web/src/<scope>/routes/` (NEVER `features/`). The canonical shape is:

```tsx
// apps/web/src/studio/routes/DocumentsRoute.tsx
export function DocumentsRoute() {
  const documents     = useAppSelector(selectDocumentsData)
  const documentTags  = useAppSelector(selectDocumentTagsData)
  useMount({ actions: documentsActions })             // signals "load my data"
  return (
    <AsyncRoute data={[documents, documentTags]}>     // gates on Fulfilled
      <DocumentList />                                 // leaf UI, assumes data is ready
    </AsyncRoute>
  )
}
```

And when a leaf needs hooks that themselves require data (`useValue`, `useCurrentId`, `useGetXxxRoute`), split it into an outer gate and an inner `<WithData />`:

```tsx
// apps/web/src/studio/routes/DocumentsRoute.tsx
export function DocumentsRoute() {
  const documents    = useAppSelector(selectDocumentsData)
  const documentTags = useAppSelector(selectDocumentTagsData)
  useMount({ actions: documentsActions })               // signals "load my data"
  return (
    <AsyncRoute data={[documents, documentTags]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const documents    = useValue(selectDocumentsData)    // safe: AsyncRoute already proved Fulfilled
  const documentTags = useValue(selectDocumentTagsData)
  const projectRoute = useGetProjectRoute()             // safe: currentIds are set
  // ...
}
```

**Rules**:
- File name: `<Name>Route.tsx`. Component name: `<Name>Route`. Always.
- Lives under `apps/web/src/<scope>/routes/` (or `common/routes/` for cross-scope wrappers).
- Each `*Route.tsx` MUST own its own `useMount` (if it owns data) and its own `<AsyncRoute>` gate.
- **A `*Route.tsx` component MUST NOT be imported anywhere except another `*Route.tsx` or `<Scope>Routes.tsx`.** If you find yourself importing one into `features/.../components/`, the route has leaked — extract the UI into a `*.tsx` (without `Route` suffix) and have the route render it.
- Leaf UI components live in `features/<domain>/components/` and NEVER end with `Route`. They never use `useMount`, never dispatch list/get thunks on mount, and read with `useValue` (assuming the parent route gated).

### 4.6 Shared route wrappers

`common/routes/` ships gating wrappers that every scope reuses. Use them; don't re-implement them.

| Wrapper | What it does | Where to use |
|---|---|---|
| [OrganizationRoute](../../apps/web/src/common/routes/OrganizationRoute.tsx) | Blocks until `selectCurrentOrganization` is `Fulfilled`. | Right under the scope shell, before anything reading the org. |
| [ProjectRoute](../../apps/web/src/common/routes/ProjectRoute.tsx) | Blocks until `selectCurrentProjectId` is set AND projects + agents are loaded. | After `OrganizationRoute`, before scoped features. |
| [AgentRoute](../../apps/web/src/common/routes/AgentRoute.tsx) | Blocks until `selectCurrentAgent` is `Fulfilled`. | Under any path that has `:agentId`. |
| [AsyncRoute](../../apps/web/src/common/routes/AsyncRoute.tsx) | Generic gate: renders `LoadingRoute` while any item in `data` is loading, `ErrorRoute` if any is error, children otherwise. | Inside every sub-route that owns async data. |
| [LoadingRoute](../../apps/web/src/common/routes/LoadingRoute.tsx) / [ErrorRoute](../../apps/web/src/common/routes/ErrorRoute.tsx) / [NotFoundRoute](../../apps/web/src/common/routes/NotFoundRoute.tsx) | Terminal states. | Returned from gates; never imported into leaf UI. |
| [ProtectedRoute](../../apps/web/src/common/routes/ProtectedRoute.tsx) | Auth boundary. | Already wired in `Router.tsx`; don't add again. |
| [RestrictedAccess](../../apps/web/src/studio/routes/RestrictedAccess.tsx) | Ability check against `useAbility()`. | Inside the scope root (whole scope) or as a registry element (sub-tree). |
| [RestrictedFeature](../../apps/web/src/common/components/RestrictedFeature.tsx) | Feature-flag check against the current project. | At the registry level when a route is gated by a feature flag. |

### 4.7 Navigation: `useGetXxxRoute`

To navigate, build paths via [use-get-path.ts](../../apps/web/src/common/hooks/use-get-path.ts):

```ts
const projectRoute = useGetProjectRoute()   // /studio/o/<orgId>/p/<projectId>
const agentRoute   = useGetAgentRoute()     // /studio/o/<orgId>/p/<projectId>/a/<agentId>
navigate(projectRoute)
```

These hooks read currentIds via `useCurrentId(...)` (which throws if missing — use them only inside a `<WithData />` that has gated on the ids) and delegate to the scope's `<RoutesBuilderProvider>` to build the URL.

**Rule**: never call `StudioRoutes.X.build({ ... })` directly inside a feature component. Use the hook, or pass the resulting path down as a prop. The hook + provider is what lets a feature live in `studio`, `tester`, AND `reviewer` without baking the scope's path layout into the component.

---

## 5. Feature modules

A "feature" is a domain (`documents`, `mcp-servers`, `agent-memberships`, …). One folder per feature: `apps/web/src/<scope>/features/<domain>/`. The folder MUST contain these eight files (plus components, locales, and tests as needed):

```
<domain>.models.ts        domain types
<domain>.spi.ts           the Service Provider Interface (transport-agnostic)
external/<domain>.api.ts  the SPI implementation (Axios + api-contracts)
<domain>.slice.ts         Redux slice (state + reducers)
<domain>.thunks.ts        createAsyncThunk wrappers calling extra.services
<domain>.middleware.ts    listenerMiddleware reacting to mount/fulfilled/etc.
<domain>.selectors.ts     selectors (the only API for reading state)
<domain>.factory.ts       fishery factory (see ADR 0010)
```

Reference: [studio/features/documents/](../../apps/web/src/studio/features/documents/). When in doubt, copy this folder.

### 5.1 `models.ts` — domain types, not DTOs

```ts
import type { DocumentDto } from "@caseai-connect/api-contracts"
export type Document = DocumentDto
```

**Rules**:
- Components, slices, selectors, factories ALL use the domain type, never the raw `*Dto`.
- If the domain type diverges from the DTO (renamed fields, computed values, narrower union), `models.ts` is where the shape is declared. The mapping happens in `external/<domain>.api.ts` (`fromDto` / `toDto`).
- Even when the type is identical to the DTO, alias it. This is what lets the codebase shift the DTO later without touching every component.

### 5.2 `spi.ts` — the Service Provider Interface

```ts
export interface IDocumentsSpi {
  getAll(params: { organizationId: string; projectId: string }): Promise<Document[]>
  createOne(params: { organizationId: string; projectId: string }, payload: Pick<Document, "name">): Promise<Document>
  updateOne(params: { organizationId: string; projectId: string; documentId: string }, payload: Partial<Pick<Document, "name">>): Promise<void>
  deleteOne(params: { organizationId: string; projectId: string; documentId: string }): Promise<void>
}
```

**Rules**:
- Methods return **domain models**, never DTOs.
- For resource CRUD, method names MUST be `getAll` / `getOne` / `createOne` / `updateOne` / `deleteOne` and MUST match the corresponding `{Domain}Routes` keys in api-contracts.
- IDs (path params) ALWAYS go in the first argument as a plain object — even when the method only needs one ID. This is what lets thunks pass `{ organizationId, projectId }` uniformly and what makes mock services trivial.
- The payload (request body) is the second argument. Don't merge them.
- The SPI lives in the feature folder. Storybook mocks satisfy the same interface; that's how the studio stories swap real API for fixtures.

### 5.3 `external/<domain>.api.ts` — the implementation

```ts
export default {
  getAll: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof DocumentsRoutes.getAll.response>(
      DocumentsRoutes.getAll.getPath({ organizationId, projectId }),
    )
    return response.data.data.documents.map(fromDto)
  },
  // ...
} satisfies IDocumentsSpi

const fromDto = (dto: DocumentDto): Document => ({ /* ... */ })
```

**Rules**:
- Default export, `satisfies IDocumentsSpi`. Don't annotate the object type directly — `satisfies` keeps each method's inference tight.
- Route paths and DTO types come from `@caseai-connect/api-contracts`. Never hand-build a URL.
- DTO ↔ model mapping (`fromDto` / `toCreateDto` / `toUpdateDto`) lives here. The slice / thunks / selectors never see a DTO.
- Then wire the implementation in [external/axios.services.ts](../../apps/web/src/external/axios.services.ts) and add the SPI to the typed [di/services.ts](../../apps/web/src/di/services.ts) `Services` object. Forgetting either step is a typecheck error.

### 5.4 `slice.ts` — state, reducers, no fetch logic

```ts
interface State {
  data: AsyncData<Document[]>
}

const initialState: State = { data: defaultAsyncData }

const slice = createSlice({
  name: "documents",
  initialState,
  reducers: {
    mount: () => {},          // marker action; middleware reacts to it
    unmount: () => {},        // marker action
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(listDocuments.pending,   (state) => { if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading; state.data.error = null })
      .addCase(listDocuments.fulfilled, (state, action) => { state.data = { status: ADS.Fulfilled, error: null, value: action.payload } })
      .addCase(listDocuments.rejected,  (state, action) => { state.data.status = ADS.Error; state.data.error = action.error.message || "Failed to list documents" })
  },
})

export const documentsActions = { ...slice.actions }   // optionally + thunks (§5.7)
export const documentsSlice = slice
```

**Rules**:
- Every async value in state is wrapped in `AsyncData<T>` (`{ status, value, error }`). Initialise with `defaultAsyncData`. Read via `ADS.isFulfilled(...)`. Never store a bare value.
- Slices declare three "lifecycle" reducers — `mount`, `unmount`, `reset` — even when the bodies are empty. The middleware listens to `mount`/`unmount`. `reset` is dispatched by `resetSlices`; it MUST return `initialState`.
- The slice handles `*.pending` / `*.fulfilled` / `*.rejected` in `extraReducers`. Keep the pending guard pattern (`if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading`) — it prevents Loading from blanking already-displayed data during a re-fetch.
- Export `<domain>Actions` and `<domain>Slice`. The actions bundle is what `useMount({ actions })` consumes.

### 5.5 `thunks.ts` — call the SPI, never read IDs from props

```ts
type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listDocuments = createAsyncThunk<Document[], void, ThunkConfig>(
  "documents/list",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    hasFeatureOrThrow({ state, feature: "web-sources" })           // if the feature is flag-gated
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId      = getCurrentId({ state, name: "projectId" })
    return await services.documents.getAll({ organizationId, projectId })
  },
)
```

**Rules**:
- Action type prefix is `<domain>/<verb>` (`documents/list`, `documents/create`). Be consistent — Redux DevTools is unusable otherwise.
- Generics ALWAYS in this order: `<ReturnType, ArgType, ThunkConfig>` with `ThunkConfig = { state: RootState; extra: ThunkExtraArg }`.
- Read URL-derived IDs via [`getCurrentId({ state, name })`](../../apps/web/src/common/features/helpers.ts) — NEVER accept them as thunk arguments. The thunk runs in the context of `state.currentIds`, which the root route already populated. Passing IDs as args means callers (components) handle them — that's how out-of-sync IDs sneak in.
- The thunk argument is for the **payload** of the operation (the body to send), not for IDs.
- Call the API through `extra.services.<domain>` only. Never import Axios directly into a thunk.

### 5.6 `middleware.ts` — listener middleware, registered via `createSliceManager`

```ts
const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: documentsActions.mount,                       // page mounted → fetch
    effect: async (_, api) => { await api.dispatch(listDocuments()) },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(createDocument.fulfilled, updateDocument.fulfilled, deleteDocument.fulfilled),
    effect: async (_, api) => { await api.dispatch(listDocuments()) },   // refresh on mutation
  })

  listenerMiddleware.startListening({
    actionCreator: createDocument.fulfilled,
    effect: async (_, api) => api.dispatch(notificationsActions.show({ title: "Created", type: "success" })),
  })
  // ...one rejected listener per mutation → notification (red)
}

export const documentsMiddleware = { listenerMiddleware, registerListeners }
```

**Rules**:
- Each feature exports `{ listenerMiddleware, registerListeners }`. `createSliceManager` (§6.2) calls `registerListeners()` once at scope injection.
- Mount/unmount handlers belong here. A component that wants data calls `useMount({ actions })` — the middleware translates that into the actual `dispatch(listXxx())`. **Never call `dispatch(listXxx())` from a `useEffect` in a component.** That separation is the whole point of this layer.
- Mutations (create / update / delete) trigger a re-list via `isAnyOf(...).fulfilled`. Don't refresh state by manually splicing it in the slice — re-fetching is the only thing that handles "the server changed it underneath us."
- Each mutation needs paired success / error toasts. `notificationsActions.show({ title, type })` is the standard.
- If a sub-route needs its own fetch lifecycle (e.g. `CampaignRoute` vs `SessionRoute`), give it its own pair of mount/unmount actions (`campaignMount`/`campaignUnmount`, `sessionMount`/`sessionUnmount`) and a dedicated listener. **Don't overload a single `mount` action** — different routes have different data needs.

### 5.7 The combined actions export

Two patterns exist for the actions bundle:

**Pattern A — only `slice.actions`** (default; use this unless you have a reason):

```ts
export const documentsActions = { ...slice.actions }
// thunks are exported separately: export const listDocuments = createAsyncThunk(...)
```

**Pattern B — slice actions + thunks bundled** (when a sub-route's `useMount` action is itself a thunk):

```ts
// thunks.ts
export const agentMembershipsThunks = {
  list:   createAsyncThunk(...),
  remove: createAsyncThunk(...),
}
// slice.ts
export const agentMembershipsActions = { ...slice.actions, ...agentMembershipsThunks }
```

Pattern B is what powers `agentMembershipsActions.list` (a thunk) being treated identically to `agentMembershipsActions.mount` (a slice action) inside `useMount({ actions })`. Use it when the component-facing actions naturally include thunks.

### 5.8 `selectors.ts` — the only way to read state

```ts
export const selectDocumentsData   = (state: RootState) => state.documents.data         // AsyncData<Document[]>
export const selectDocumentsStatus = (state: RootState) => state.documents.data.status
export const selectDocumentsError  = (state: RootState) => state.documents.data.error
```

**Rules**:
- Selectors return `AsyncData<T>` for fetched values — components decide how to unwrap (via `useValue` after `AsyncRoute`, or `useAppSelector` for the raw envelope when gating).
- Components MUST NOT do `state.documents.data.value` directly — always go through a selector. That's what makes slice-shape refactors local.
- Use `createSelector` only when you actually need memoised derived values. For a `(state) => state.X.Y` selector, plain functions are cheaper and clearer.
- The `useValue(selectXxxData)` helper is the standard read inside a `<WithData />` (gated by `AsyncRoute`) — it returns the unwrapped value and throws if not `Fulfilled`. The throw is intentional: it's a programming error to use `useValue` outside a gate.

### 5.9 `factory.ts` — see ADR 0010

Required. Every model has a sibling factory. Use `fishery`, `faker`, and transient params carrying the parent scope. See [ADR 0010](0010-factory-per-model-and-story-per-route.md).

---

## 6. Store & DI

### 6.1 Root slices (always-on) vs scope slices (lazy)

[root-slices.ts](../../apps/web/src/common/store/root-slices.ts) lists slices that EVERY interface needs — `auth`, `me`, `notifications`, `organizations`. They're combined eagerly into the root reducer.

Everything else is scope-specific and lives in `apps/web/src/<scope>/store/slices.ts`. These slices are injected lazily when the scope's root route mounts. This is what keeps the studio bundle from carrying the tester bundle.

### 6.2 `createSliceManager` — one per scope

[dynamic-middleware.ts](../../apps/web/src/common/store/dynamic-middleware.ts) exposes `createSliceManager({ middlewares, slices })`. Each scope's `store/slices.ts` calls it:

```ts
const studioMiddlewareList = [documentsMiddleware, mcpServersMiddleware, /* ... */]
export const studioSliceList = [documentsSlice, mcpServersSlice, /* ... */, currentIdsSlice]

export const { injectSlices: injectStudioSlices, resetSlices: resetStudioSlices } =
  createSliceManager({ middlewares: studioMiddlewareList, slices: studioSliceList })
```

**Rules**:
- When you add a feature, add its slice to the scope's `studioSliceList` (or `testerSliceList`, …) AND its middleware to the scope's middleware list. Two registrations, one for state, one for side effects.
- `currentIdsSlice` is part of every scope's slice list (§6.3). Don't forget it.
- The manager guarantees middleware is only added once per scope-injection cycle (a deduplication that you'd otherwise have to hand-roll and forget).

### 6.3 One `currentIds` slice per scope

[apps/web/src/studio/store/currentIds.slice.ts](../../apps/web/src/studio/store/currentIds.slice.ts) is the studio's version:

```ts
interface State {
  organizationId: string | null
  projectId:      string | null
  agentId:        string | null
  agentSessionId: string | null
  membershipId:   string | null
  reviewCampaignId: string | null
}

const slice = createSlice({
  name: "currentIds",
  initialState: { /* all null */ },
  reducers: {
    reset: () => initialState,
    setOrganizationId: setId("organizationId"),
    setProjectId:      setId("projectId"),
    setAgentId:        setId("agentId"),
    setAgentSessionId: setId("agentSessionId"),
    setMembershipId:   setId("membershipId"),
    setReviewCampaignId: setId("reviewCampaignId"),
  },
})

function setId(id: keyof State) {
  return (state: State, { payload }: { payload: string | null }) => { state[id] = payload }
}
```

**Rules**:
- The slice name is **always** `"currentIds"`. Each scope has its own version with the IDs it cares about — studio has `agentId` + `membershipId`, eval has `datasetId` + `runId` + `fileId`, etc.
- Field names match URL param names exactly (`organizationId` → `:organizationId`). This is what `useSetCurrentIds` relies on: it strips `set` and the `Id` suffix, lowercases the leading char, and matches the result against `useParams()`.
- Read via the selectors in the feature files (`selectCurrentOrganizationId`, `selectCurrentProjectId`, …). Inside a thunk, use `getCurrentId({ state, name: "organizationId" })`.
- All current-ID writes happen in **one place**: `useSetCurrentIds(currentIdsActions)` called inside the scope root after slice injection. Don't dispatch `setOrganizationId` from a component.

### 6.4 Dependency injection — `Services`

Every thunk reads `extra.services` (typed as the `Services` interface in [di/services.ts](../../apps/web/src/di/services.ts)). To add a feature's API:

1. Define `I<Domain>Spi` in `features/<domain>/<domain>.spi.ts`.
2. Implement it in `features/<domain>/external/<domain>.api.ts` (`satisfies I<Domain>Spi`).
3. Register the implementation in [external/axios.services.ts](../../apps/web/src/external/axios.services.ts) (`<domain>: <domain>Api`).
4. Add the SPI type to the `Services` type in [di/services.ts](../../apps/web/src/di/services.ts).

Forgetting steps 3 or 4 is a typecheck error; that's by design.

---

## 7. Hooks & helpers cheat-sheet

### 7.1 Hooks

| Hook | Use when | Notes |
|---|---|---|
| [useInitStore](../../apps/web/src/common/hooks/use-init-store.ts) | Scope root only. Injects slices + middleware, returns `initDone`. | Cleanup calls `resetSlices` on unmount. |
| [useSetCurrentIds](../../apps/web/src/common/hooks/use-set-current-ids.ts) | Scope root only, AFTER `initDone`. Maps URL params → `currentIds` slice. | Pass `currentIdsActions` of the scope. Param key derives from the action name (`setFooId` → `:fooId`). |
| [useMount](../../apps/web/src/common/hooks/use-mount.ts) | Inside every sub-route that owns data. Dispatches `actions.mount` on mount, `actions.unmount` on unmount. | Pass `{ actions, condition?, refreshOn? }`. Use `condition` for dependent loads (e.g. only mount when `:reviewCampaignId` is set). Use `refreshOn` (a `(string \| null)[]`) to re-run the mount/unmount cycle — i.e. re-fetch — when a current ID changes without the component unmounting (e.g. `refreshOn: [agentSessionId]` to reload when switching sessions in place). |
| [useValue](../../apps/web/src/common/hooks/use-value.ts) | Inside a `<WithData />` that has gated on `<AsyncRoute>`. Returns the unwrapped value. | Throws if the data isn't `Fulfilled`. The throw is the contract — it catches "I forgot to gate." |
| `useCurrentId` (in [use-value.ts](../../apps/web/src/common/hooks/use-value.ts)) | When you need an ID known to be set (after the scope root populated it). | Throws on `null`. Use `useAppSelector` directly if you want to handle the `null` case. |
| [useGetProjectRoute / useGetAgentRoute / useGetAgentSessionRoute](../../apps/web/src/common/hooks/use-get-path.ts) | Building navigation paths. | Reads `currentIds` + the scope's `RoutesBuilderProvider`. Components stay scope-agnostic. |
| [useAppDispatch / useAppSelector](../../apps/web/src/common/store/hooks.ts) | Default Redux hooks (typed). | Never use plain `useDispatch` / `useSelector`. |
| [useAbility](../../apps/web/src/common/hooks/use-ability.ts) | Reading the current user's abilities. | `RestrictedAccess` already wraps this — only call it directly for in-page checks (e.g. show/hide a button). |
| [useFeatureFlags](../../apps/web/src/common/hooks/use-feature-flags.ts) | Reading the project's feature flags. | `RestrictedFeature` already wraps this. `hasFeatureOrThrow({ state, feature })` is the thunk-side equivalent. |

### 7.2 Helpers

| Helper | Lives in | Use for |
|---|---|---|
| `defineRoute(path).extend(suffix).build({ ... })` | [common/routes/helpers.ts](../../apps/web/src/common/routes/helpers.ts) | Defining the scope's path tree. Type-checks params. |
| `getCurrentId({ state, name })` | [common/features/helpers.ts](../../apps/web/src/common/features/helpers.ts) | Thunk-side ID lookup. Throws if null. |
| `assert(value, msg)` | [common/utils/assert.ts](../../apps/web/src/common/utils/assert.ts) | Narrowing nullable values in helpers (used inside `getCurrentId` / `useCurrentId`). |
| `ADS.isFulfilled / isLoading / isError / isUninitialized` | [common/store/async-data-status.ts](../../apps/web/src/common/store/async-data-status.ts) | Discriminating `AsyncData<T>` in reducers and selectors. |
| `defaultAsyncData` | same file | Initial `AsyncData<T>` value for slice `initialState`. |
| `createSliceManager({ middlewares, slices })` | [common/store/dynamic-middleware.ts](../../apps/web/src/common/store/dynamic-middleware.ts) | Per-scope slice injection. One call per scope. |
| `<AsyncRoute data={[...]}>` | [common/routes/AsyncRoute.tsx](../../apps/web/src/common/routes/AsyncRoute.tsx) | Gating a sub-route on multiple async values. |
| `<LoadingRoute />` / `<ErrorRoute />` / `<NotFoundRoute />` | `common/routes/` | Terminal states. Don't render manually — return them from gates. |
| `<RestrictedAccess ability="..." />` | [studio/routes/RestrictedAccess.tsx](../../apps/web/src/studio/routes/RestrictedAccess.tsx) | Ability gating in the registry. |
| `<RestrictedFeature feature="..." returnNull={false} />` | [common/components/RestrictedFeature.tsx](../../apps/web/src/common/components/RestrictedFeature.tsx) | Feature-flag gating in the registry (or inline for UI toggles). |

---

## 8. End-to-end render flow, annotated

Walk through `GET /studio/o/<orgId>/p/<projectId>/d`:

1. **`Router.tsx`** matches `studioRoutes` (path starts with `/studio`).
2. **`<StudioRoute />` mounts.**
   - `useInitStore({ inject: injectStudioSlices, reset: resetStudioSlices, condition: true })` runs.
   - `injectStudioSlices()` adds `documents`, `mcpServers`, …, `currentIds` to the reducer; adds each feature's listener middleware; calls each feature's `registerListeners()`.
   - `initDone` flips to `true`.
   - The inner `<Route />` mounts.
3. **`useSetCurrentIds(currentIdsActions)`** reads `useParams()`. Sees `:organizationId` and `:projectId`. Dispatches `setOrganizationId(orgId)` and `setProjectId(projectId)`. `state.currentIds` is now populated.
4. **`<RestrictedAccess ability="canAccessStudio">`** reads `useAbility().abilities.canAccessStudio({ projectId })`. Returns children.
5. **`<Outlet />`** renders the matched child: the `StudioRoutes.project` element.
6. **`<OrganizationRoute>`** gates on `selectCurrentOrganization`. The organization is on `me` (already fetched at app boot), so it's `Fulfilled` immediately. Renders children.
7. **`<ProjectRoute>`** gates on `selectCurrentProjectData` + `selectAgentsData`. The `projectsActions.mount` listener (registered by step 2) sees the slice arrive, dispatches `listProjects`. Project becomes `Fulfilled`. Agents follow. Renders children.
8. **`<StudioLayout>`** + `<RoutesBuilderProvider>` render. The leaf `<Outlet />` resolves to `StudioRoutes.documents`. (For flag-gated routes like `StudioRoutes.webSources`, a `<RestrictedFeature feature="...">` wrapper checks the project's feature flags here and renders `<NotFoundRoute />` when the flag is missing.)
9. **`<DocumentsRoute />`** reads `selectDocumentsData` + `selectDocumentTagsData` from Redux. Neither has been fetched. Renders `<AsyncRoute data={[documents, documentTags]}>`.
10. `<AsyncRoute>` sees both are `Uninitialized`/`Loading`, renders `<LoadingRoute />`. Meanwhile the route's `useMount({ actions })` has dispatched the mount action; the `documentsMiddleware` listener translates it into the fetch.
11. `listDocuments` runs, dispatches `pending` → `fulfilled`. The slice transitions `data.status` to `Fulfilled`.
12. `<AsyncRoute>` re-renders with everything `Fulfilled`, mounts `<WithData />`.
13. **`<WithData />`** calls `useValue(selectDocumentsData)` — safe now. Renders the page.

If at any step the data fails, `<AsyncRoute>` renders `<ErrorRoute>` instead. If `currentIds.projectId` was never set, every `useCurrentId` call would throw, which is the loud signal you forgot the scope root. **The pattern is designed to fail loud and early.**

---

## 9. Anti-patterns (do not do these)

- **`dispatch(listXxx())` inside a component's `useEffect`.** Use `useMount({ actions })` instead; let the middleware do the fetch. The route layer is the only place mount/unmount belongs.
- **`useParams()` inside a leaf component.** URL → state is the scope root's job. Inside a feature, read from `currentIds` selectors. (Exceptions: `useSetCurrentIds` itself, and `<Navigate>`-style components that translate params to redirects.)
- **`useEffect(() => dispatch(setCurrentXxxId(params.xxxId)))`.** That's what `useSetCurrentIds` exists for. If you find yourself writing this in a sub-route, you missed Rule 4.4.
- **Storing a bare value in a slice (`state.documents: Document[]`)**. Wrap in `AsyncData<T>`. Otherwise components can't tell "loading" from "empty list."
- **A thunk argument that's an ID.** `createAsyncThunk<X, { projectId, ...}>` is wrong. The thunk reads IDs from `currentIds` via `getCurrentId(...)`. Args are payloads.
- **Importing `getAxiosInstance` inside a thunk or component.** Axios only appears in `external/<domain>.api.ts`. Thunks call `extra.services.<domain>`; components dispatch thunks.
- **A `*Route.tsx` imported from a `features/.../components/` file.** Route wrappers are not reusable UI. If you need the rendered tree, extract a UI component (without the `Route` suffix) and import that.
- **A leaf component that uses `<Outlet />`.** Outlets only appear in `*Route.tsx` (or scope shell wrappers). A component that needs to render children should take `children: ReactNode`.
- **Manually combining slices in stories.** The mock store in [stories/decorators.tsx](../../apps/web/src/stories/decorators.tsx) already flattens every scope's slices into the `RootState` shape. Use `seed.*` helpers from [stories/seed.ts](../../apps/web/src/stories/seed.ts) — if a helper is missing, add it there (don't reach into slice shape from a story).
- **Hand-built URL strings.** Always `StudioRoutes.X.build({ ... })` or `useGetXxxRoute()`.
- **A new feature without a `*.factory.ts`.** ADR 0010 makes this a hard rule. Stories will fail to render, and the audit skill ([check-factories-and-stories](../../apps/web/CLAUDE.md)) will flag it.

---

## 10. Checklist when adding a new feature

When you add `apps/web/src/<scope>/features/<new-domain>/`:

- [ ] `<new-domain>.models.ts` — domain types, aliased from `*Dto`.
- [ ] `<new-domain>.spi.ts` — `I<NewDomain>Spi` interface.
- [ ] `external/<new-domain>.api.ts` — `satisfies I<NewDomain>Spi`, `fromDto`/`toDto` mappers.
- [ ] Add SPI to `Services` type in [di/services.ts](../../apps/web/src/di/services.ts).
- [ ] Register implementation in [external/axios.services.ts](../../apps/web/src/external/axios.services.ts).
- [ ] `<new-domain>.slice.ts` — state with `AsyncData<T>`, `mount`/`unmount`/`reset` reducers, `extraReducers` for thunks.
- [ ] `<new-domain>.thunks.ts` — `createAsyncThunk` per operation, IDs via `getCurrentId`.
- [ ] `<new-domain>.middleware.ts` — `{ listenerMiddleware, registerListeners }`. Listen to mount + mutation `fulfilled` events. Add success/error notifications.
- [ ] `<new-domain>.selectors.ts` — at minimum `selectXxxData` returning `AsyncData<T>`.
- [ ] `<new-domain>.factory.ts` — fishery factory with transient parent scope (ADR 0010).
- [ ] Register the slice and middleware in `<scope>/store/slices.ts` (`studioSliceList` and `studioMiddlewareList`).
- [ ] If the feature has a page: add a `<NewDomain>Route.tsx` in `<scope>/routes/`, add an entry to `<Scope>Routes.tsx`, add a story under `stories/routes/<scope>/<NewDomain>Route.stories.tsx` (ADR 0010).

When you add a new URL parameter (e.g. `:datasetId`):

- [ ] Add a field to the scope's `currentIds.slice.ts` (`datasetId: string | null`).
- [ ] Add a `setDatasetId` reducer following the `setId("datasetId")` pattern.
- [ ] Add a `selectCurrentDatasetId` selector wherever it belongs (typically a `current-<thing>-id/` folder, or in the feature's `selectors.ts`).
- [ ] The next time `<Scope>Route` renders, `useSetCurrentIds(currentIdsActions)` picks it up automatically — no changes needed to the hook.

---

## 11. Consequences

- **Positive**: a new scope or feature is a copy-paste with renames. Race conditions covered by ADR 0009 cannot reappear when Rules 4.4 + 4.5 are followed. Storybook stories work out of the box because `seed.*` writes the same shape selectors read. Mock APIs are trivial — they implement an SPI interface.
- **Negative**: upfront ceremony per feature (eight files + slice/middleware registration). Worth it once you've debugged your second "missing slice" or "stale ID" issue.
- **Migration**: the studio is fully compliant. `tester`, `reviewer`, `eval`, `desk`, `backoffice` are aligned post the `refactor-store` work. New features in any scope MUST follow this ADR; legacy code drifts are flagged in code review.
