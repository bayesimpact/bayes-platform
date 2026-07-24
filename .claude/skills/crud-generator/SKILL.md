---
name: crud-generator
description: Generate CRUD boilerplate (backend NestJS controller/service/module/guard/policy/factory/routes/e2e + frontend Redux slice/thunks/selectors/middleware/spi/api) from a given entity file and a list of methods.
---

Generate all CRUD-related files for a new feature based on an existing entity file and a selected list of operations.

## Invocation format

The user provides:
1. **Entity file path** — absolute or repo-relative path to the existing `.entity.ts` file (e.g. `apps/api/src/domains/widgets/widget.entity.ts`)
2. **Methods** — a comma- or space-separated list of operations to generate: `Create`, `GetAll`, `GetOne`, `Update`, `Delete`

Example invocations:
```
/crud-generator apps/api/src/domains/widgets/widget.entity.ts Create GetAll Update Delete
/crud-generator entity=apps/api/src/domains/widgets/widget.entity.ts methods=Create,Update
```

Parse the entity file path and method list from `$ARGUMENTS`.

---

## Step 1 — Parse inputs

Extract:
- `entityFilePath` — the provided entity file (e.g. `apps/api/src/domains/widgets/widget.entity.ts`)
- `methods` — the list of requested operations (default to all four if none are given: `Create`, `GetAll`, `Update`, `Delete`)
- Derive names:
  - `featureName` = folder name (e.g. `widgets`)
  - `entityName` = PascalCase singular (e.g. `Widget`)
  - `entityNamePlural` = camelCase plural (e.g. `widgets`)
  - `entityNameKebab` = kebab-case singular (e.g. `widget`)
  - `entityNameKebabPlural` = kebab-case plural (e.g. `widgets`)
  - `routePrefix` = the URL segment (e.g. `widgets`)
  - `featureDir` = directory of the entity file (e.g. `apps/api/src/domains/widgets/`)
  - `webFeatureDir` = `apps/web/src/features/{entityNameKebabPlural}/`
  - `contractsDir` = `packages/api-contracts/src/{entityNameKebabPlural}/`

---

## Step 2 — Read the entity file and reference examples

**Read these files** to understand the entity shape and codebase patterns before generating anything:

```
# Entity to scaffold from (user-provided)
{entityFilePath}

# --- BACKEND reference files (agents module) ---
apps/api/src/domains/agents/agents.controller.ts
apps/api/src/domains/agents/agents.service.ts
apps/api/src/domains/agents/agents.module.ts
apps/api/src/domains/agents/agent.entity.ts
apps/api/src/domains/agents/agent.factory.ts
apps/api/src/domains/agents/agent.guard.ts
apps/api/src/domains/agents/agent.policy.ts
apps/api/src/domains/agents/e2e-tests/create-one.spec.ts
apps/api/src/domains/agents/e2e-tests/auth.spec.ts

# --- API CONTRACTS reference files ---
packages/api-contracts/src/agents/agents.dto.ts
packages/api-contracts/src/agents/agents.routes.ts
packages/api-contracts/src/helpers.ts

# --- FRONTEND reference files (agents feature) ---
apps/web/src/features/agents/agents.models.ts
apps/web/src/features/agents/agents.spi.ts
apps/web/src/features/agents/external/agents.api.ts
apps/web/src/features/agents/agents.thunks.ts
apps/web/src/features/agents/agents.slice.ts
apps/web/src/features/agents/agents.selectors.ts
apps/web/src/features/agents/agents.middleware.ts
```

From the entity file, extract:
- All `@Column()` fields and their TypeScript types
- All `@ManyToOne` / `@OneToMany` relations and their parent IDs (e.g. `projectId`, `organizationId`)
- The scope params used in the URL (e.g. `organizationId`, `projectId` — check what `ConnectEntityBase` provides)
- Any required vs optional fields

---

## Step 3 — Plan and confirm

Before writing any files, output a summary table of **what will be created**, grouped by layer, then ask the user to confirm or adjust. For example:

```
## Files to generate

### API Contracts (packages/api-contracts/src/{entityNameKebabPlural}/)
- {entityName}.dto.ts         — DTO type (no list wrapper — GetAll returns {EntityName}Dto[] directly)
- {entityName}.routes.ts      — Route definitions (methods: {methods})

### Backend (apps/api/src/domains/{featureName}/)
- {entityNamePlural}.controller.ts   — HTTP endpoints
- {entityNamePlural}.service.ts      — Business logic
- {entityNamePlural}.module.ts       — NestJS module
- {entityNameKebab}.guard.ts         — Authorization guard
- {entityNameKebab}.policy.ts        — Resource policy
- {entityNameKebab}.factory.ts       — Test data factory
- e2e-tests/auth.spec.ts             — Auth E2E tests
- e2e-tests/create-one.spec.ts       — (if Create requested)
- e2e-tests/get-all.spec.ts          — (if GetAll requested)
- e2e-tests/get-one.spec.ts          — (if GetOne requested)
- e2e-tests/update-one.spec.ts       — (if Update requested)
- e2e-tests/delete-one.spec.ts       — (if Delete requested)

### Frontend (apps/web/src/features/{entityNameKebabPlural}/)
- {entityNamePlural}.models.ts       — TypeScript model type + Zod schema
- {entityNamePlural}.spi.ts          — IService interface
- external/{entityNamePlural}.api.ts — Axios HTTP implementation
- {entityNamePlural}.thunks.ts       — Redux async thunks
- {entityNamePlural}.slice.ts        — Redux slice
- {entityNamePlural}.selectors.ts    — Memoized selectors
- {entityNamePlural}.middleware.ts   — Listener middleware (notifications + refresh)
```

---

## Step 4 — Generate files in order

Generate the files in this order. For each file, **strictly follow the reference patterns** from Step 2.

### 4a. API Contracts — DTO

File: `packages/api-contracts/src/{entityNameKebabPlural}/{entityNameKebab}.dto.ts`

Pattern: `packages/api-contracts/src/agents/agents.dto.ts`

- Define the `{EntityName}Dto` type with all entity fields using primitive types (use `TimeType` for timestamps from `"../generic"`)
- **Do NOT** define a `List{EntityName}sResponseDto` wrapper — use `{EntityName}Dto[]` directly in the GetAll route
- Export all types

### 4b. API Contracts — Routes

File: `packages/api-contracts/src/{entityNameKebabPlural}/{entityNameKebab}.routes.ts`

Pattern: `packages/api-contracts/src/agents/agents.routes.ts`

- Import `{ RequestPayload, ResponseData, SuccessResponseDTO }` from `"../generic"` and `defineRoute` from `"../helpers"`
- Import the DTOs from the DTO file
- Build the URL base path from the parent scope params and entity name, e.g.:
  `organizations/:organizationId/projects/:projectId/{entityNameKebabPlural}`
- Export `{EntityName}sRoutes = { ... }` with only the routes matching the requested `methods`. **Route object keys MUST be exactly** (same names as the frontend SPI):
  - `Create` → key `createOne`: `defineRoute<ResponseData<{EntityName}Dto>, RequestPayload<...>>({ method: "post", path: "..." })`
  - `GetAll` → key `getAll`: `defineRoute<ResponseData<{EntityName}Dto[]>>({ method: "get", path: "..." })`
  - `GetOne` → key `getOne`: `defineRoute<ResponseData<{EntityName}Dto>>({ method: "get", path: ".../:entityNameKebabId" })`
  - `Update` → key `updateOne`: `defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<Partial<...>>>({ method: "patch", path: ".../:entityNameKebabId" })`
  - `Delete` → key `deleteOne`: `defineRoute<ResponseData<SuccessResponseDTO>>({ method: "delete", path: ".../:entityNameKebabId" })`

Do **not** invent domain-prefixed keys (`createWidget`, `listWidgets`). Use `createOne` / `getAll` / etc.

> After creating these two files, check whether `packages/api-contracts/src/index.ts` exists. If it does, add exports for the new DTO and Routes.

### 4c. Backend — Controller

File: `apps/api/src/domains/{featureName}/{entityNamePlural}.controller.ts`

Pattern: `apps/api/src/domains/agents/agents.controller.ts`

- Import `{EntityName}sRoutes` from `"@caseai-connect/api-contracts"`
- `@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, {EntityName}Guard)` at class level
- `@RequireContext("organization", "project")` at class level (adjust scopes based on entity's parent relations)
- Only generate `@Post`, `@Get`, `@Patch`, `@Delete` methods for requested operations
- For entity-scoped operations (Update, Delete, GetOne): add `@AddContext("{entityNameKebab}")` and use `EndpointRequestWith{EntityName}`
- Include a private `to{EntityName}Dto(entity: {EntityName}): {EntityName}Dto` mapping function at the bottom

### 4d. Backend — Service

File: `apps/api/src/domains/{featureName}/{entityNamePlural}.service.ts`

Pattern: `apps/api/src/domains/agents/agents.service.ts`

- `@Injectable()` class with `@InjectRepository({EntityName})` in constructor
- Initialize a `ConnectRepository<{EntityName}>` in the constructor
- Generate only the service methods corresponding to requested operations:
  - `Create`: `create{EntityName}({ connectScope, fields })` — validate if needed, call `createAndSave`
  - `GetAll`: `list{EntityName}s(connectScope)` — call `getMany`, optionally sort
  - `GetOne`: `find{EntityName}ById({ connectScope, {entityNameKebab}Id })` — call `getOneById`
  - `Update`: `update{EntityName}({ connectScope, required, fieldsToUpdate })` — find, validate, `Object.assign`, `saveOne`
  - `Delete`: `delete{EntityName}({ connectScope, {entityNameKebab}Id })` — find, `deleteOneById`
- Throw `NotFoundException` when entity not found, `UnprocessableEntityException` for validation failures

### 4e. Backend — Module

File: `apps/api/src/domains/{featureName}/{entityNamePlural}.module.ts`

Pattern: `apps/api/src/domains/agents/agents.module.ts`

- `TypeOrmModule.forFeature([{EntityName}, ...related entities needed for scoping])` — always include `Project`, `UserMembership`, `ProjectMembership` if entity is project-scoped
- Include: `OrganizationsModule`, `ProjectsModule`, `UsersModule`, `AuthModule`
- Providers: `[{EntityName}sService, {EntityName}Guard, ResourceContextGuard, OrganizationContextResolver, ProjectContextResolver]`
- Add `{EntityName}ContextResolver` to providers if GetOne/Update/Delete are requested (needed for `@AddContext`)
- Controllers: `[{EntityName}sController]`
- Exports: `[{EntityName}sService]`

> **Note:** After creating the module file, remind the user to import this module into the parent feature module or `app.module.ts`.

### 4f. Backend — Guard

File: `apps/api/src/domains/{featureName}/{entityNameKebab}.guard.ts`

Pattern: `apps/api/src/domains/agents/agent.guard.ts`

- Mirrors the agents guard exactly, substituting entity names
- Only needed if Update, Delete, or GetOne are requested (entity-level authorization)
- If only Create and GetAll are requested, the guard still handles class-level policy

### 4g. Backend — Policy

File: `apps/api/src/domains/{featureName}/{entityNameKebab}.policy.ts`

Pattern: `apps/api/src/domains/agents/agent.policy.ts`

```typescript
import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { {EntityName} } from "./{entityNameKebab}.entity"

export class {EntityName}Policy extends ProjectScopedPolicy<{EntityName}> {}
```

Unless the entity requires custom access control logic.

### 4h. Backend — Factory

File: `apps/api/src/domains/{featureName}/{entityNameKebab}.factory.ts`

Pattern: `apps/api/src/domains/agents/agent.factory.ts`

- Import `{ Factory }` from `"fishery"` and `RequiredScopeTransientParams`
- `type {EntityName}TransientParams = RequiredScopeTransientParams`
- `class {EntityName}Factory extends Factory<{EntityName}, {EntityName}TransientParams>`
- In the factory definition: require `organization` and `project` transient params, provide sensible defaults for all entity columns using `sequence`, export as `{entityNameCamel}Factory`

### 4i. Backend — E2E Tests

For each requested method, create a file in `apps/api/src/domains/{featureName}/e2e-tests/`:

Patterns:
- `apps/api/src/domains/agents/e2e-tests/create-one.spec.ts` (for Create)
- `apps/api/src/domains/agents/e2e-tests/auth.spec.ts` (for auth.spec.ts)

**`auth.spec.ts`** — Always generate this file. Cover all requested routes with:
- Missing/null access token → 401
- Missing/null organizationId → 400
- Missing/null projectId → 404
- Non-member user → 401
- `member` role (if entity is restricted to admin/owner) → 403
- For entity-scoped routes: entity belonging to different project → 404

**`create-one.spec.ts`** (if Create):
- Happy path: creates entity, returns 201, persists to DB
- Validation failures if any (e.g. name too short → 422)

**`get-all.spec.ts`** (if GetAll):
- Happy path: returns list with correct structure
- Empty list when no entities

**`get-one.spec.ts`** (if GetOne):
- Happy path: returns single entity by ID
- Non-existent ID → 404

**`update-one.spec.ts`** (if Update):
- Happy path: updates entity, returns `{ success: true }`
- Partial update only changes specified fields

**`delete-one.spec.ts`** (if Delete):
- Happy path: deletes entity, returns `{ success: true }`, verifies DB removal
- Non-existent ID → 404

---

### 4j. Backend — `EndpointRequestWith{EntityName}` interface

File: `apps/api/src/common/context/request.interface.ts` (**edit existing file**)

**Always required** when GetOne, Update, or Delete are requested. Add:

1. An import at the top of the file:
```typescript
import type { {EntityName} } from "@/domains/{featureName}/{entityNameKebab}.entity"
```

2. A new interface extending `EndpointRequestWithProject`:
```typescript
export interface EndpointRequestWith{EntityName} extends EndpointRequestWithProject {
  {entityNameCamel}: {EntityName}
}
```

---

### 4k. Backend — `{EntityName}ContextResolver`

File: `apps/api/src/common/context/resolvers/{entityNameKebab}-context.resolver.ts` (**new file**)

**Always required** when GetOne, Update, or Delete are requested. Pattern: `apps/api/src/common/context/resolvers/document-context.resolver.ts`

```typescript
import { Injectable, NotFoundException } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { {EntityName}sService } from "@/domains/{featureName}/{entityNamePlural}.service"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type { EndpointRequestWith{EntityName} } from "../request.interface"
import { getRequiredConnectScope } from "../request-context.helpers"

@Injectable()
export class {EntityName}ContextResolver implements ContextResolver {
  readonly resource = "{entityNameCamel}" as const

  constructor(private readonly {entityNamePlural}Service: {EntityName}sService) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { {entityNameCamel}Id?: string }
    }
    const {entityNameCamel}Id = requestWithParams.params?.{entityNameCamel}Id

    if (!{entityNameCamel}Id || {entityNameCamel}Id === ":{entityNameCamel}Id") throw new NotFoundException()

    const requestWith{EntityName} = request as EndpointRequestWith{EntityName}
    const {entityNameCamel} =
      (await this.{entityNamePlural}Service.find{EntityName}ById({
        connectScope: getRequiredConnectScope(requestWith{EntityName}),
        {entityNameCamel}Id,
      })) ?? undefined
    if (!{entityNameCamel}) throw new NotFoundException()

    requestWith{EntityName}.{entityNameCamel} = {entityNameCamel}
  }
}
```

---

### 4l. Backend — `ContextResource` union entry + `RESOLUTION_ORDER`

**Always required** when GetOne, Update, or Delete are requested.

#### Edit 1: `apps/api/src/common/context/require-context.decorator.ts`

Add `"{entityNameCamel}"` to the `ContextResource` union type:

```typescript
export type ContextResource =
  | "organization"
  | "project"
  | "projectMembership"
  | "agent"
  | "agentSession"
  | "document"
  | "{entityNameCamel}"   // ← add this line in alphabetical order
  | "evaluation"
  | "evaluationReport"
```

#### Edit 2: `apps/api/src/common/context/resource-context.guard.ts`

Two changes are required in this file:

1. Add `"{entityNameCamel}"` to `RESOLUTION_ORDER` (in the correct position — after `"document"`, before `"evaluation"`):

```typescript
const RESOLUTION_ORDER: ContextResource[] = [
  "organization",
  "project",
  "projectMembership",
  "agent",
  "agentSession",
  "document",
  "{entityNameCamel}",  // ← add this line
  "evaluation",
]
```

2. Add an `@Optional()` constructor parameter and register the resolver in the map:

```typescript
constructor(
  private reflector: Reflector,
  // ... existing resolvers ...
  @Optional() documentContextResolver?: DocumentContextResolver,
  @Optional() {entityNameCamel}ContextResolver?: {EntityName}ContextResolver,  // ← add
  @Optional() evaluationContextResolver?: EvaluationContextResolver,
) {
  // ... existing entries ...
  if ({entityNameCamel}ContextResolver) {
    resolverEntries.push([{entityNameCamel}ContextResolver.resource, {entityNameCamel}ContextResolver])
  }
  // ...
}
```

> **Why this matters**: `ResourceContextGuard` only resolves resources that appear in `RESOLUTION_ORDER`. Omitting the entry here means `request.{entityNameCamel}` will always be `undefined`, causing `doesResourceBelongToProject()` in the policy to return `false` and all entity-scoped routes to 403.

---

### 4m. Frontend — Models

File: `apps/web/src/features/{entityNameKebabPlural}/{entityNamePlural}.models.ts`

Pattern: `apps/web/src/features/agents/agents.models.ts`

- Export a `type {EntityName} = { ... }` mirroring the DTO fields, using frontend-friendly types (import shared types from `"@caseai-connect/api-contracts"` when needed, use `TimeType` for timestamps)
- Export a `{entityNameCamel}Schema = z.object({ ... }).strict()` Zod schema for the core fields

### 4n. Frontend — SPI

File: `apps/web/src/features/{entityNameKebabPlural}/{entityNamePlural}.spi.ts`

Pattern: `apps/web/src/features/agents/agents.spi.ts`

- Export `interface I{EntityName}sSpi` with only the methods matching requested operations. **Method names MUST match `*Routes` keys**:
  - `getAll(params): Promise<{EntityName}[]>` (if GetAll)
  - `getOne(params): Promise<{EntityName}>` (if GetOne)
  - `createOne(params, payload): Promise<{EntityName}>` (if Create)
  - `updateOne(params, payload): Promise<void>` (if Update)
  - `deleteOne(params): Promise<void>` (if Delete)
- `params` always includes `organizationId: string`, `projectId: string`, and `{entityNameKebab}Id: string` when the route targets a specific entity

### 4o. Frontend — API Implementation

File: `apps/web/src/features/{entityNameKebabPlural}/external/{entityNamePlural}.api.ts`

Pattern: `apps/web/src/features/agents/external/agents.api.ts`

- Import `{EntityName}sRoutes` from `"@caseai-connect/api-contracts"` and `getAxiosInstance` from `"@/external/axios"`
- Export a default object `satisfies I{EntityName}sSpi` with only the methods matching requested operations
- For each method:
  - Use `{EntityName}sRoutes.{method}.getPath(params)` where `{method}` is `getAll` / `getOne` / `createOne` / `updateOne` / `deleteOne`
  - Map `fromDto(dto: {EntityName}Dto): {EntityName}` for responses
  - Map `toCreateDto` / `toUpdateDto` for request payloads
- Include `fromDto`, `toCreateDto`, `toUpdateDto` helper functions at the bottom

### 4p. Frontend — Thunks

File: `apps/web/src/features/{entityNameKebabPlural}/{entityNamePlural}.thunks.ts`

Pattern: `apps/web/src/features/agents/agents.thunks.ts`

- `type ThunkConfig = { state: RootState; extra: ThunkExtraArg }`
- Generate only thunks for requested operations:
  - `list{EntityName}s = createAsyncThunk<{EntityName}[], void, ThunkConfig>("{entityNamePlural}/list", ...)`
  - `get{EntityName} = createAsyncThunk<{EntityName}, { {entityNameKebab}Id: string }, ThunkConfig>(...)`
  - `create{EntityName} = createAsyncThunk<{EntityName}, { fields: ...; onSuccess?: ... }, ThunkConfig>(...)`
  - `update{EntityName} = createAsyncThunk<void, { {entityNameKebab}Id: string; fields: Partial<...> }, ThunkConfig>(...)`
  - `delete{EntityName} = createAsyncThunk<void, { {entityNameKebab}Id: string; onSuccess?: ... }, ThunkConfig>(...)`
- Use `getCurrentIds({ state: getState(), wantedIds: ["organizationId", "projectId"] })` to get scope params
- Access the SPI via `services.{entityNamePlural}` (camelCase plural)

### 4q. Frontend — Slice

File: `apps/web/src/features/{entityNameKebabPlural}/{entityNamePlural}.slice.ts`

Pattern: `apps/web/src/features/agents/agents.slice.ts`

- State shape: `{ data: AsyncData<Record<ParentId, {EntityName}[]>> }` keyed by parent scope (e.g. `projectId`), or `AsyncData<{EntityName}[]>` if top-level
- Handle `list{EntityName}s.pending/fulfilled/rejected` in `extraReducers`
- Export `{entityNamePlural}Actions`, `{entityNamePlural}SliceReducer`, `{entityNamePlural}InitialState`

### 4r. Frontend — Selectors

File: `apps/web/src/features/{entityNameKebabPlural}/{entityNamePlural}.selectors.ts`

Pattern: `apps/web/src/features/agents/agents.selectors.ts`

- `select{EntityName}sStatus`, `select{EntityName}sError`, `select{EntityName}sData` — raw state selectors
- `select{EntityName}sFromProjectId(projectId?)` — memoized with `createSelector`, returns `AsyncData<{EntityName}[]>`
- `selectCurrent{EntityName}sData` — uses current project ID selector
- If GetOne is applicable: `selectCurrent{EntityName}Id` from state + `select{EntityName}Data` combining list + current ID

### 4s. Frontend — Middleware

File: `apps/web/src/features/{entityNameKebabPlural}/{entityNamePlural}.middleware.ts`

Pattern: `apps/web/src/features/agents/agents.middleware.ts`

- Import `createListenerMiddleware, isAnyOf` from `"@reduxjs/toolkit"`
- Listener 1: Re-fetch list when current project changes (predicate on `selectCurrentProjectId`)
- Listener 2: Re-fetch list on any mutating thunk fulfilled (`isAnyOf(...)` matcher)
- For each mutating thunk (Create/Update/Delete): add fulfilled + rejected listeners that dispatch `notificationsActions.show({ title: "...", type: "success"|"error" })`
- For Create/Delete fulfilled: call `action.meta.arg.onSuccess?.(...)`
- Export as `{entityNamePlural}Middleware`

---

## Step 5 — Post-generation checklist

After writing all files, output this checklist for the user:

```
## Post-generation steps (manual)

### API Contracts
- [ ] Add exports to packages/api-contracts/src/index.ts:
      export * from "./{entityNameKebabPlural}/{entityNameKebab}.dto"
      export * from "./{entityNameKebabPlural}/{entityNameKebab}.routes"

### Backend
- [ ] Import {EntityName}sModule in apps/api/src/app.module.ts (or parent domain module)
- [ ] Create a TypeORM migration for the new entity if the schema changed
- [ ] Register {entityNameKebab}ContextResolver in context resolvers if GetOne/Update/Delete are used

### Frontend
- [ ] Add to apps/web/src/store/index.ts:
      - Import {entityNamePlural}SliceReducer and {entityNamePlural}Middleware
      - Add `{entityNamePlural}: {entityNamePlural}SliceReducer` to the reducer map (alphabetical order)
      - Add `{entityNamePlural}Middleware.middleware` to the `.prepend(...)` call (alphabetical order)
- [ ] Add to apps/web/src/store/types.ts:
      - `import type { {entityNamePlural}SliceReducer } from "@/features/{entityNameKebabPlural}/{entityNamePlural}.slice"`
      - Add `{entityNamePlural}: ReturnType<typeof {entityNamePlural}SliceReducer>` to the `RootState` type (alphabetical order)
- [ ] Register the API implementation in apps/web/src/external/axios.services.ts:
      {entityNamePlural}: {entityNamePlural}Api
- [ ] Update apps/web/src/di/services.ts:
      - Add `import type { I{EntityName}sSpi } from "@/features/{entityNameKebabPlural}/{entityNamePlural}.spi"`
      - Add `{entityNamePlural}: I{EntityName}sSpi` to the `Services` type (alphabetical order)
- [ ] Add {EntityName}[] to services type in the ThunkExtraArg if needed
- [ ] Add locales/{entityNameKebab}.en.json and locales/{entityNameKebab}.fr.json if i18n is used
```

---

## Conventions to follow strictly

- **Biome import comment**: when importing a NestJS DI provider that is not a type (e.g. services), add `// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI` above the import
- **No default exports** on backend files; use named exports
- **Named export** convention: `export const {entityNamePlural}Factory`, `export class {EntityName}sService`
- **Singular** for entity/guard/policy/factory; **plural** for controller/service/module
- **ConnectRepository** pattern: always `new ConnectRepository(repository, "{entityNamePlural}")` in service constructor
- **`satisfies`** keyword for the frontend API object: `} satisfies I{EntityName}sSpi`
- **Zod strict** schemas: always call `.strict()` on the schema
- Never use `any` — use proper TypeScript types throughout
- Do not generate files for methods not in the requested list
