# Web Rules (Next.js — apps/web)

## Redux & Feature Architecture

### API Calls Must Go Through Redux + Services

**Rule**: All API calls MUST go through Redux thunks, which call the shared `services` object. Components MUST NOT call the API client (Axios, `fetch`) directly.

- All API calls use `createAsyncThunk`
- Thunks call `extra.services.{feature}` methods only
- Components dispatch thunks, never call API directly
- API routes and DTOs come from `@caseai-connect/api-contracts`

**Structure**:
```
features/{domain}/{domain}.slice.ts
features/{domain}/{domain}.thunks.ts
features/{domain}/{domain}.selectors.ts
external/axios.ts            # Singleton Axios with auth interceptors
external/axios.services.ts   # Builds concrete services
di/services.ts               # Typed Services + getServices()
```

**Store wiring** (`store/index.ts`):
- Registers feature reducers under domain keys
- Configures `thunk.extraArgument` with `{ services: getServices() }` (typed as `ThunkExtraArg`)

```typescript
// ✅ Correct
dispatch(fetchMe())

// ❌ Wrong
const response = await fetch('/me')
```

### Feature Service Pattern (SPI + External API + Models)

Each feature MUST follow this canonical pattern (the "me" feature is the reference):

| File | Purpose |
|------|---------|
| `features/{domain}/{domain}.models.ts` | Domain types (not raw DTOs) |
| `features/{domain}/{domain}.spi.ts` | Service Provider Interface (`I{Domain}Spi`) |
| `features/{domain}/external/{domain}.api.ts` | Concrete SPI implementation using Axios + `api-contracts` |
| `external/axios.services.ts` | Wires implementation: `{domain}: {domain}Api` |
| `di/services.ts` | `Services` type + `getServices()` |
| `features/{domain}/{domain}.thunks.ts` | `createAsyncThunk` calling `extra.services.{domain}` |
| `features/{domain}/{domain}.slice.ts` | State typed on domain models |
| `features/{domain}/{domain}.selectors.ts` | Selectors returning domain models |

**Requirements for new/refactored features**:
- Define domain models in `*.models.ts` — components and slices use these, not raw DTOs
- Define SPI in `*.spi.ts` — hides transport details, exposes domain models
- Implement SPI in `external/*.api.ts` — use `satisfies I{Domain}Spi`, map DTOs → domain models
- Register in `external/axios.services.ts` and update `di/services.ts`
- Thunks use `createAsyncThunk<DomainModel, ...>` and call `extra.services.{domain}`

**Migration note**: Legacy features (`projects`, `organizations`, `agents`, etc.) that use `services/{domain}.ts` and return DTOs directly SHOULD be refactored over time to follow this pattern.

### Data Loading: Route-Level `useMount` + Middleware + `AsyncRoute` Gate

**Rule**: page components MUST NOT dispatch fetch thunks from `useEffect`. Data loading is handled by **route wrapper components** using `useMount` + listener middleware + `AsyncRoute`. See [ADR 0009](../../docs/adr/0009-subroute-data-loading.md) for full rationale.

**Three-layer pattern** (reference: `apps/web/src/eval/routes/EvalRoutes.tsx`):

#### Layer 1 — Root route: `useInitStore` + `useSetCurrentIds` + `initDone` gate

The root route (e.g. `TesterRoute`, eval's `ProjectRouteHandler`) injects dynamic slices and sets ALL URL-driven IDs at the **same component level**. The `initDone` gate creates two-phase rendering: effects fire in phase 1 (slices injected + IDs set), children mount in phase 2 with correct state.

```ts
// Local to the route file — sets only the IDs this feature needs.
const useSetCurrentIds = () => {
  const dispatch = useAppDispatch()
  const params = useParams()
  useEffect(() => {
    const { organizationId, projectId, reviewCampaignId, agentSessionId } = params
    dispatch(organizationsActions.setCurrentOrganizationId({ organizationId: organizationId || null }))
    dispatch(projectsActions.setCurrentProjectId({ projectId: projectId || null }))
    // ... all IDs for this feature scope
  }, [dispatch, params])
}

function FeatureRoute() {
  const { initDone } = useInitStore({ inject, reset, condition: true })
  useSetCurrentIds()
  if (!initDone) return <LoadingRoute />
  return <AsyncRoute data={[me]}>{() => <Outlet />}</AsyncRoute>
}
```

#### Layer 2+ — Sub-routes: `useMount` + `condition` + `AsyncRoute`

Each nested route wrapper reads its condition from a **Redux selector** (not `useParams`), calls `useMount`, and blocks with `AsyncRoute` until its data is loaded.

```ts
function CampaignRoute() {
  const campaignId = useAppSelector(selectCurrentReviewCampaignId)
  const context = useAppSelector(selectTesterContext)

  useMount({ actions: featureActions, condition: !!campaignId })

  if (!campaignId) return <LoadingRoute />
  return <AsyncRoute data={[context]}>{() => <Outlet />}</AsyncRoute>
}
```

Each sub-route level that needs its own data MUST have its own `mount`/`unmount` actions and a dedicated middleware listener:

```ts
function SessionRoute() {
  const sessionId = useAppSelector(selectCurrentAgentSessionId)
  const messages = useAppSelector(selectCurrentMessagesData)

  useMount({
    actions: { mount: featureActions.sessionMount, unmount: featureActions.sessionUnmount },
    condition: !!sessionId,
  })

  if (!sessionId) return <LoadingRoute />
  return <AsyncRoute data={[messages]}>{() => <Outlet />}</AsyncRoute>
}
```

#### Middleware: one listener per mount action

```ts
listenerMiddleware.startListening({
  actionCreator: featureActions.mount,
  effect: async (_, listenerApi) => {
    const id = selectCurrentXxxId(listenerApi.getState())
    if (id) listenerApi.dispatch(loadXxx(id))
  },
})
```

#### Key constraints

- **`useSetCurrentIds` MUST be at the same level as `useInitStore`** — the `initDone` gate ensures IDs are set before children mount. Putting `useSetCurrentIds` in a child creates a race condition (React fires child effects before parent effects).
- **Page/leaf components MUST NOT dispatch data loading** — all loading is in route wrappers + middleware. Leaf components assume data is available.
- **Use `useMount` hook, not raw `useEffect`** for mount/unmount — `useMount` standardizes the pattern and prevents mistakes.
- **Conditions come from Redux selectors, not `useParams`** — the route reads `useAppSelector(selectCurrentXxxId)` to match the eval pattern.
- **Each sub-route level needing its own data gets its own `mount`/`unmount` actions** — allows dedicated middleware listeners and avoids overloading a single `mount` action.

**Exceptions where `useEffect` is fine**: dynamic slice injection lifecycle (`use-init-store.ts`), the local `useSetCurrentIds` in the root route, DOM subscriptions, focus/scroll, third-party widget mount/unmount.

---

## Form Component Architecture

### Separation of Create and Update Forms

**Rule**: A `CreateXXXForm` MUST NEVER handle both creating and updating. Always use separate components and extract shared logic into a base form.

```
components/{domain}/{Domain}Form.tsx       # Shared presentational form
components/{domain}/Create{Domain}Form.tsx # Create logic only
components/{domain}/Update{Domain}Form.tsx # Update logic only
```

```typescript
// ✅ Correct - shared form component
export function ProjectForm({ defaultName, isLoading, onSubmit, submitLabelIdle, ... }: ProjectFormProps) {
  // Shared fields, validation, layout
}

// ✅ Correct - create only
export function CreateProjectForm({ organizationId, onSuccess }: CreateProjectFormProps) {
  const dispatch = useAppDispatch()
  const handleSubmit = async (data) => {
    await dispatch(createProject({ name: data.name, organizationId })).unwrap()
    onSuccess?.()
  }
  return <ProjectForm onSubmit={handleSubmit} submitLabelIdle="Create Project" ... />
}

// ✅ Correct - update only
export function UpdateProjectForm({ project, onSuccess }: UpdateProjectFormProps) {
  const dispatch = useAppDispatch()
  const handleSubmit = async (data) => {
    await dispatch(updateProject({ projectId: project.id, payload: { name: data.name } })).unwrap()
    onSuccess?.()
  }
  return <ProjectForm defaultName={project.name} onSubmit={handleSubmit} submitLabelIdle="Update Project" ... />
}

// ❌ Wrong - single form with if/else for create vs update
```

---

## TypeScript Type Safety

### Never Use `any` to Fix TypeScript Errors

**Rule**: NEVER use `any`, `as any`, `// @ts-ignore`, or `// @ts-expect-error` to suppress type errors.

```typescript
// ❌ Wrong
const result = someFunction() as any
dispatch(action as any)

// ✅ Correct - use proper types
const result: ExpectedType = someFunction()

// ✅ Correct - use type guards for unknown types
function isExpectedType(value: unknown): value is ExpectedType {
  return typeof value === 'object' && value !== null && 'property' in value
}
```

---

## Factories Mirror Models, Stories Mirror Routes

See [ADR 0010](../../docs/adr/0010-factory-per-model-and-story-per-route.md) for full rationale.

### Every domain model MUST have a sibling factory

**Rule**: when you create or rename `features/{domain}/{domain}.models.ts`, you MUST create the sibling factory file `features/{domain}/{domain}.factory.ts` (or `{domain}/{singular}.factory.ts` — match the existing siblings in the same folder) in the same commit. No model ships without a factory.

- Pattern: [evaluations.factory.ts](src/studio/features/evaluations/evaluations.factory.ts) and [documents.factory.ts](src/studio/features/documents/documents.factory.ts) are canonical references.
- Use `fishery`'s `Factory.define`. Transient params carry the parent scope (e.g. `{ project: Project }`, `{ evaluation: Evaluation, agent: Agent }`). Throw if a required transient param is missing — silent fallback defaults make seeded stories drift from real shapes.
- Use `faker` for values. Keep samples **domain-neutral** (see the root CLAUDE.md "Neutral Sample Data" rule) — `faker.lorem.sentence()`, `faker.commerce.productName()`, never a vertical-specific term unless asked.
- Every field on the model MUST be defaulted in the factory, with `params.X ?? <default>` so callers can override.

### Every router route MUST have a sibling story

**Rule**: when you add an entry to `{scope}/routes/{Scope}Routes.tsx` (e.g. `studioRoutes`, `testerRoutes`), you MUST create a matching story under `apps/web/src/stories/routes/{scope}/{RouteName}.stories.tsx` in the same commit. Pure redirects/aliases are exempt; anything that renders UI is not.

- Pattern: [EvaluationRoute.stories.tsx](src/stories/routes/studio/EvaluationRoute.stories.tsx) and [DocumentsRoute.stories.tsx](src/stories/routes/studio/DocumentsRoute.stories.tsx) are canonical references.
- The story must mount the **real** route tree (`createMemoryRouter([studioRoutes], { initialEntries: [path] })`), not just the leaf component. This catches breakage in route wrappers, `useMount`, `AsyncRoute`, and feature-flag gates.
- Seed Redux via `buildMockStore` + `mergeSeeds(seed.X(...), ...)`. Use the feature factories — never inline literal fixtures. If the seed helper you need is missing, add it to [seed.ts](src/stories/seed.ts).
- Expose toggles via `argTypes` for every data dependency the route reads (e.g. `withEvaluations`, `withEvaluationReports`) so the empty AND populated states are both reachable from the Storybook controls panel.
- If the route is wrapped in `<RestrictedFeature feature="X">`, the seeded project MUST have `featureFlags: ["X"]` or the story renders blank.

### When the seed helper is missing, add it

`seed.ts` is the one place where slice-shape knowledge lives for stories. When you introduce a new slice, add a `seed.{scope}.{slice}()` helper that wraps the value in `ads.fulfilled(...)`. Stories should never reach into raw slice shape (`{ studio: { foo: { data: ... } } }`) — that knowledge belongs in `seed.ts`.

---

## Storybook-First for Non-Trivial UI Slices

When starting a new admin/studio UI slice with meaningful UX surface (list + editor + lifecycle actions), the preferred phasing is:

1. **Phase A — Storybook slice**: presentational components with mock data, wired into a handful of **scenario-driven** stories (one per user-facing lifecycle state, e.g. `DraftEditable`, `ActiveLocked`, `ClosedReadOnly`) — NOT a prop catalog with one story per component. Components live in `apps/web/src/{studio,tester,reviewer}/features/<domain>/components/`; stories in `apps/web/src/stories/<domain>/`. Hard-coded English strings are fine; i18n waits for phase B.
2. **Phase B — wire Redux + routes**: models / spi / external api / slice / thunks / selectors / middleware / register in services / page wrappers / route registration / i18n. Connects phase-A components to the API.

**Why**: lets the UX be reviewed visually before Redux plumbing, prevents rework. Presentational components stay small (one per file); stories are what consolidate them into scenes.

### Storybook Mock Services Are Factories, Not Singletons

Page wrappers that dispatch list thunks on mount (e.g. `CampaignListPage`) will overwrite seeded Redux state if the mock service returns hardcoded data — the page's `mount` handler dispatches `listX()`, the `fulfilled` reducer overwrites whatever was seeded in `withRedux({ list: [] })`, and your `Empty` story flashes 3 fixtures.

**Don't**: export a singleton mock service with fixed return values.

**Do**: export a factory that accepts per-story overrides:

```typescript
export function buildMockReviewCampaignsService(
  overrides: { campaigns?: ReviewCampaignDto[] } = {},
): IReviewCampaignsSpi {
  const campaigns = overrides.campaigns ?? defaultFixtures
  return { async getAll() { return campaigns }, /* ... */ }
}

// In the story:
servicesMock: {
  reviewCampaigns: buildMockReviewCampaignsService({ campaigns: [] }),
}
```

Each story passes both (a) the seeded state for the decorator AND (b) the matching mock return values. Symptom of getting this wrong: a story briefly renders the seeded state then switches to the mock service's default return.

---

## Completion Criteria

Before marking web work as completed:

1. `npm run biome:check` — must pass
2. `npm run typecheck` — must pass

Work is NOT complete until both commands pass with exit code 0.
