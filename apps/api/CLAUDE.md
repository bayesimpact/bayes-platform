# API Rules (NestJS — apps/api & packages/api-contracts)

## NestJS Dependency Injection

### Import Type Rule

When NestJS requires runtime access to classes for DI (services, controllers, guards, etc.), you MUST use regular imports, not type-only imports.

**Rule**: If you get a NestJS DI error about a class being undefined at runtime, it means you used `import type` instead of `import`.

```typescript
// ❌ Wrong - will cause DI error
import type { UsersService } from "@/users/users.service"

// ✅ Correct
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UsersService } from "@/users/users.service"
```

**When to use regular imports**: Services, custom repositories and `TransactionService` injected through the constructor or `@Inject()`; Controllers, Guards, Interceptors, Pipes.

**When type-only imports are OK**: DTOs, interfaces, types, return types — anything not used for DI.

---

## DTO Organization

### Domain-Based DTO Location

**Rule**: All DTOs for a domain MUST be consolidated into a single file: `packages/api-contracts/src/{domain}/{domain}.dto.ts`.

- **DO NOT** create separate files per DTO (e.g., `create-project.dto.ts`)
- All DTOs exported from `packages/api-contracts/src/index.ts`
- Controllers and routes import DTOs from `@caseai-connect/api-contracts`

**Example**:

1. Create `packages/api-contracts/src/projects/projects.dto.ts`:
```typescript
export type ProjectDto = { id: string; name: string; organizationId: string; createdAt: number; updatedAt: number }
export type CreateProjectRequestDto = { name: string; organizationId: string }
export type CreateProjectResponseDto = { id: string; name: string; organizationId: string }
export type ListProjectsResponseDto = { projects: ProjectDto[] }
export type UpdateProjectRequestDto = { name: string }
export type UpdateProjectResponseDto = { id: string; name: string; organizationId: string }
```

2. Export from `packages/api-contracts/src/index.ts`:
```typescript
export type { CreateProjectRequestDto, CreateProjectResponseDto, ... } from "./projects/projects.dto"
```

---

## Public API contract

The routes under `PUBLIC_PATH_PREFIX` (`/public/...`) are a frozen contract with external integrators. Read `docs/public-api-contract.md` before touching `packages/api-contracts/src/public-chat/`, the public chat controller, guards, CORS or the public help pages. No change without a maintainer's written go and the `public-contract-approved` label.

## Controller Guidelines

### Route Definition Strategy (`defineRoute`)

All NestJS controllers MUST use the `defineRoute` strategy for type-safe route definitions.

#### Route key naming (CRUD)

Standard CRUD keys on `*Routes` objects MUST be exactly:

| Operation | Route key | HTTP |
|-----------|-----------|------|
| List collection | `getAll` | GET |
| Get single resource | `getOne` | GET |
| Create | `createOne` | POST |
| Update | `updateOne` | PATCH |
| Delete | `deleteOne` | DELETE |

Do **not** use domain-prefixed CRUD keys (`listOrganizations`, `createOrganization`). Non-CRUD routes may use descriptive keys (`getMe`, `acceptTerms`). Pattern: `agents.routes.ts`, `projects.routes.ts`.

#### Step 1: Create a Routes File (`*.routes.ts`)

```typescript
// List / get-one / delete
export const MyRoutes = {
  getAll: defineRoute<ResponseData<MyDto[]>>({
    method: "get",
    path: "my/path", // No leading slash - normalized automatically
  }),
  getOne: defineRoute<ResponseData<MyDto>>({
    method: "get",
    path: "my/path/:myId",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "my/path/:myId",
  }),
}

// Create / update
export const MyRoutes = {
  createOne: defineRoute<ResponseData<MyDto>, RequestPayload<Pick<MyDto, "name">>>({
    method: "post",
    path: "my/path",
  }),
  updateOne: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<UpdateMyRequestDto>
  >({
    method: "patch",
    path: "my/path/:myId",
  }),
}
```

#### Step 2: Use Routes in Controller

```typescript
@Controller() // No prefix - paths come from route definitions; Nest adds the global `api` prefix (src/config/api-prefix.ts)
export class MyController {
  @Get(MyRoutes.getAll.path)
  async list(): Promise<typeof MyRoutes.getAll.response> {
    return { data: { /* ... */ } } // Always wrap in { data: ... }
  }
}
```

**Controller Rules**:
- `@Controller()` with no prefix
- Use `Routes.routeName.path` in method decorators
- Use `typeof Routes.routeName.response` for return type
- Always wrap responses in `{ data: ... }` to match `ResponseData<T>`
- POST/PUT/PATCH request bodies are wrapped in `{ payload: ... }` to match `RequestPayload<T>`
- Controller method names may be descriptive; route **keys** stay `getAll` / `createOne` / etc.

#### Step 3: Export Routes

In `packages/api-contracts/src/api-routes/index.ts`:
```typescript
import { MyRoutes } from "../my/my.routes"
export default { MyRoutes, ... }
```

In `packages/api-contracts/src/index.ts`:
```typescript
export { default as ApiRoutes } from "./api-routes/index"
export { MyRoutes } from "./my/my.routes"
```

### Context Resolver Architecture (Required)

Controllers and guards MUST follow the context resolver pattern for resource loading:

- Use `ResourceContextGuard` to resolve request context (`organization`, `project`, `projectMembership`, `agent`, etc.)
- Declare required context at controller or method level with `@RequireContext(...)`
- Add route-specific context with `@AddContext(...)` when only some handlers need extra resources
- Keep domain guards (e.g. `ProjectsGuard`) focused on **policy evaluation only** — no DB resource loading
- Do **not** use cascading resource-loading guards like `UserGuard -> OrganizationGuard -> ProjectsGuard`

**Module wiring**:
- Register `ResourceContextGuard` in module providers
- Register each resolver used by the module (`OrganizationContextResolver`, `ProjectContextResolver`, etc.)

```typescript
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ProjectsGuard)
@RequireContext("organization", "project")
@Controller()
export class ExampleController {
  @Delete("organizations/:organizationId/projects/:projectId/memberships/:membershipId")
  @AddContext("projectMembership")
  @CheckPolicy((policy) => policy.canDelete())
  async remove(@Req() request: EndpointRequestWithProjectMembership) {
    return { data: { success: true } }
  }
}
```

---

## Testing Requirements

### E2E Tests for Controllers

**Rule**: Controller behavior MUST be tested via e2e tests that make real HTTP requests. Do NOT test controllers by calling methods directly.

**File Organization**:
```
apps/api/src/domains/{domain}/
  e2e-tests/
    auth.spec.ts              # Authorization tests for ALL routes in this domain
    create-{resource}.spec.ts
    list-{resources}.spec.ts
    delete-{resource}.spec.ts
    update-{resource}.spec.ts
```

Versioned public API domains keep one `e2e-tests/` per served contract instead: `public-chat/v1/e2e-tests/` and `public-chat/legacy/e2e-tests/` (see `docs/public-api-contract.md`).

**Two categories**:
1. **Auth spec** (`auth.spec.ts`) — Tests authorization for every route: no token, not a member, wrong role, allowed roles. Uses `createContextForRole(role)`.
2. **Functional specs** (one file per action) — Happy path and business logic only. Assumes owner. Uses `createContext()`.

**E2E test structure**:
```typescript
describe("Domain - actionName", () => {
  // 1. INFRASTRUCTURE VARIABLES
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: ReturnType<Awaited<ReturnType<typeof setupTransactionalTestDatabase>>["getAllRepositories"]>

  // 2. MUTABLE STATE
  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

  // 3. LIFECYCLE HOOKS
  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [DomainModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    app.close()
  })

  // 4. CONTEXT HELPER
  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!
    return { organization, project }
  }

  // 5. SUBJECT
  const subject = async () =>
    request({
      route: DomainRoutes.someAction,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  // 6. TESTS
  it("should do the expected thing", async () => {
    await createContext()
    const response = await subject()
    expectResponse(response, 200)
  })
})
```

**Key patterns**:
- `createContext()` — sets up data, returns entities, assigns mutable state
- `createContextForRole(role)` — for auth specs
- `subject()` — wraps HTTP request using `DomainRoutes.actionName`
- `expectResponse(response, statusCode, errorMessage?)` — status + optional error assertion
- Response data via `response.body.data`
- DB side-effects via `repositories.{entity}Repository.findOne(...)`

### Service Tests

Every service MUST have a corresponding `*.service.spec.ts`. Use `setupTransactionalTestDatabase` from `@/common/test/test-transaction-manager`.

### Always Use Factory Functions for Test Data

**Rule**: ALWAYS use fishery factory functions to create test data. Never use `new EntityName()` or manual object literals.

```typescript
// ❌ Wrong
const user = new User()
user.id = randomUUID()
// ...

// ✅ Correct
const user = userFactory.build({ email: "test@example.com" })
const membership = userMembershipFactory.owner().transient({ user, organization }).build()
const project = projectFactory.transient({ organization: org }).build()
```

**Available factories**: `userFactory`, `organizationFactory`, `projectFactory`, `userMembershipFactory`, `agentFactory`, `agentSessionFactory`

### Use Organization Factory Helpers

Use `createOrganizationWithOwner(repositories, params?)` instead of manually creating and saving entities:

```typescript
// ✅ Correct
const { user, organization } = await createOrganizationWithOwner(mainRepositories, {
  user: { email: "member@example.com" },
})

// ❌ Wrong - manually saving user + org + membership
```

---

## Persistence: custom repositories

A service never imports TypeORM. Persistence goes through an `@Injectable()` `{Entity}Repository` provider whose public methods are named for the operation (`createProject`, `findSummariesByProject`, `softDelete`). Follow the `custom-repository` skill. The rationale is in [ADR 0020](../../docs/adr/0020-custom-repositories.md).

- Forbidden in a service: `import ... from "typeorm"` or `@nestjs/typeorm`, `@InjectRepository`, `Repository<T>`, `find` / `save` / `create` / `In()`, query builders, `new ConnectRepository(...)`.
- The repository injects `TransactionService` (value import with the biome-ignore comment) and calls `transactionService.getManager().getRepository(Entity)` inside each method, never in the constructor. It does not take an `EntityManager` parameter and does not open its own transaction.
- Public repository methods take and return plain values, records, or the entity. No TypeORM type appears in a signature.
- Raw SQL goes through `getManager().query()` inside the repository so it joins the ambient transaction.
- Register the repository in the domain module `providers`, and in `exports` when another module injects it. Leave `TypeOrmModule.forFeature` as it is.
- Work that must commit or roll back together is wrapped in `transactionService.run()` in the service. Every repository method called inside that callback shares the transaction. Do not thread an optional `manager` argument through service methods.

Many existing services still inject `Repository<T>` or pass a `manager` argument. They are legacy. Do not copy them.

Reference repositories: `domains/agents/agent.repository.ts`, `domains/projects/project.repository.ts`, `domains/rbac/platform-role.repository.ts` (raw SQL), `domains/evaluations/extraction/datasets/evaluation-extraction-dataset-document.repository.ts` (connect scope).

### Connect scope

For an entity scoped by `organizationId` / `projectId`, the repository wraps `repo()` in `ConnectRepository`. The service passes `connectScope: RequiredConnectScope` into the named method and never rebuilds the scope in a `where` clause.

```typescript
export class DocumentsService {
  constructor(private readonly documentRepository: DocumentRepository) {}

  async listDocuments(connectScope: RequiredConnectScope): Promise<Document[]> {
    return this.documentRepository.getMany(connectScope)
  }
}
```

### Caller-supplied ids

An id of a connect-scoped row that arrives on the request (`parentId`, `tagsToAdd`, a target, a link) is loaded with the caller's `connectScope`. A lookup by id alone is not an existence check. An internal service calling that lookup is still the caller's scope.

- The custom repository takes `connectScope` and loads the row through `ConnectRepository` (`organizationId` and `projectId`).
- Every requested id is found in that scope. A missing id fails the call.
- Missing, another project of the same organization, and another organization share one result: 404, with one message. The response does not reveal that the row exists elsewhere.
- A parent id cannot be the row itself or a descendant of that row.

```typescript
// ❌ Another project's tag matches
findByIds(ids: string[]): Promise<DocumentTag[]> {
  return this.repo().findBy({ id: In(ids) })
}

// ✅ Caller's organization and project
findByIds(connectScope: RequiredConnectScope, ids: string[]): Promise<DocumentTag[]> {
  return this.connectRepo().find(connectScope, { where: { id: In(ids) } })
}
```

---

## Authorization: RBAC permission catalog

Access is one permission string, granted on roles, checked on the route, and used to list what the caller can see. Follow the `rbac` skill. The rationale is in [ADR 0019](../../docs/adr/0019-rbac-permission-catalog.md). ADR 0004 and ADR 0013 are superseded: no role enum checks in services, no org-wide `project.read`.

A new capability touches all of these in one change:

1. Declare the string once in `packages/api-contracts/src/rbac/permissions.ts`. Add it to `GlobalPermission` when it has no resource id.
2. Import it in `apps/api/src/domains/rbac/rbac.constants.ts`, grant it in `ORGANIZATION_ROLE_PERMISSIONS` / `PROJECT_ROLE_PERMISSIONS` / `AGENT_ROLE_PERMISSIONS`, and describe it in `PERMISSION_DESCRIPTIONS`. Add it to `READ_PERMISSION_RESOURCE_TYPE_MAP` when it is used for listing, and to `RESOURCE_TYPE_PERMISSIONS_MAP` when a parent membership should pass it down to a child resource.
3. Update the matching table in `docs/rbac-permission-matrix.md` and run the `check-permission-matrix` skill.
4. Ship a data migration that inserts the `role_permission` rows, modelled on `src/migrations/1790269217250-analytics-read-permissions.ts` (`up` inserts with `ON CONFLICT DO NOTHING`, `down` deletes). `migration:generate` cannot emit it because there is no schema diff. The running app never re-reads the constants: tests and `seed:rbac` go through `RbacService`, production only knows the migration.
5. Protect the route with `@CheckPermission(permission)` for a global check, or `@CheckPermission(permission, "organization" | "project" | "agent")` for a scoped one, with `CheckPermissionGuard` after `JwtAuthGuard` and `UserGuard`. Keep the context resolver or domain guard that puts the resource id on the request. The permission guard only answers whether the permission holds.
6. A service that lists resources calls `PermissionService.listResourceIds(userId, permission)` or `listResourcePermissions(userId, permission)`, then loads those ids through its custom repository. Pass the key you mean: `backoffice.organization.read` is never rewritten to `organization.read`.

Feature services do not query `user_membership` or `role_permission`, and do not compare `membership.role` against a list of allowed roles. Existing `@CheckPolicy` policies stay where they are. A new check uses `@CheckPermission`.

**If unsure which role should hold a permission, ASK THE USER before implementing.**

---

## TypeORM Database Migrations

### NEVER Enable `synchronize`

`synchronize` MUST always be `false`. It can cause **data loss** by dropping columns. It is correctly set in `apps/api/src/config/typeorm.ts` — never change it.

### Migration Workflow

1. Modify entity files (`*.entity.ts`).
2. Make sure the local DB is up to date: `npm run migration:run`. The generator diffs entity metadata against the **live DB**, so any unapplied source migrations will otherwise show up as spurious drift in the generated file.
3. Generate the migration: `npm run migration:generate`. Output lands at `src/migrations/pending/<timestamp>-dontsave-mig.ts` (both the `pending/` directory and files containing `dontsave` are gitignored, which is intentional — this is the staging area).
4. **Rename and move** the file:
   - Move out of `pending/` into `src/migrations/`.
   - Rename to `<timestamp>-<kebab-case-slug>.ts` (e.g. `1776930037268-review-campaigns-foundation.ts`).
   - Rename the class inside (`DontsaveMigXXX` → `YourSluggedNameXXX`) and its `name` property to match.
5. Review `up()` and `down()` — confirm there's no unrelated drift.
6. Apply: `npm run migration:run`. Revert to double-check `down()`: `npm run migration:revert` (only on a local / disposable DB).

**Available commands**: `migration:generate`, `migration:create`, `migration:run`, `migration:revert`, `migration:show`

### FORBIDDEN: Manual Migration Creation

NEVER manually create migration files unless the user explicitly requests it. Always use `migration:generate`.

Default behavior for schema changes:
- Required: `npm run migration:generate`
- Forbidden by default: `migration:create` and hand-written migration SQL
- Exception: only when the user explicitly asks for a manual migration, or for the `role_permission` data migration of an RBAC grant (see "Authorization: RBAC permission catalog"), which has no schema diff to generate from

### Migration Best Practices

- One migration per feature
- Descriptive names
- Always implement `down()`
- Never edit existing migrations that have run in production

---

## TypeORM Entity Guidelines

### Column Naming: snake_case

All database column names MUST be snake_case:

```typescript
// ✅ Correct
@Column({ type: "uuid", name: "organization_id" })
organizationId!: string

@CreateDateColumn({ name: "created_at" })
createdAt!: Date

// ❌ Wrong - will create camelCase column in DB
@Column({ type: "uuid" })
organizationId!: string
```

### Foreign Key Relationships

Pass EITHER the foreign key ID OR the entity object, NOT both. Do this inside the custom repository, not a service:

```typescript
// ✅ Correct
const project = this.repo().create({ name: "My Project", organizationId })

// ❌ Wrong - redundant
const project = this.repo().create({ name: "My Project", organizationId, organization })
```

Prefer passing the foreign key ID for consistency.

### Register New Entities in `ALL_ENTITIES`

The main datasource (`src/config/typeorm.ts`) picks up entities via a glob (`**/*.entity.ts`), so production + `migration:generate` work automatically. But the **test DB setup** uses an explicit list: `src/common/all-entities.ts` → `ALL_ENTITIES`.

When adding a new entity, add both the import and the array entry. Otherwise tests that touch a related entity will fail with:

```
TypeORMError: Entity metadata for X#someRelation was not found.
Check if you specified a correct entity object and if it's connected in the connection options.
```

Also update:
- `src/common/test/test-all-repositories.ts` — add the new repository to both the `AllRepositories` type and `buildAllRepositories()` so e2e tests can read/write via `repositories.<entity>Repository`.
- `src/common/test/test-database.ts` — `clearTestDatabase` has a hand-maintained list of `DELETE FROM "<table>"` calls in FK-respecting order. The new table's DELETE must come **before** any parent it FK-references, or tests fail in `beforeEach`/`afterEach` with `update or delete on table "<parent>" violates foreign key constraint "FK_..." on table "<child>"`.

---

## Boundary Check Baselines

`apps/api/Makefile` → `npm run check:boundaries` runs two checks, each with a committed baseline:

| Check | Script | Baseline file |
|---|---|---|
| madge circular imports | `npm run check:circular` | `apps/api/baselines/madge-circular.json` |
| dependency-cruiser rules | `npm run check:deps` | `apps/api/.dependency-cruiser-known-violations.json` |

Adding bidirectional TypeORM relations (`@OneToMany` ↔ `@ManyToOne` pairs across two entities) creates new circular imports — the codebase's convention is to absorb them into the baseline rather than rewriting the pattern:

```bash
cd apps/api
npm run check:circular:baseline   # rewrites baselines/madge-circular.json
npm run check:deps:baseline       # rewrites .dependency-cruiser-known-violations.json
npm run check:boundaries          # verify clean
```

Commit both baseline files alongside the entity change.

---

## Test Commands

- **Full suite**: `npm run test:parallel` (from `apps/api`). Provisions per-worker DBs (`connect_test_w1`..`w6`), isolates each worker's transactional state, cleans up after. Do NOT use plain `npm run test` for the full suite — it runs `--runInBand` against a single DB and leaks state across suites, producing flaky failures.
- **Single file iteration**: `npx jest --colors --runInBand --forceExit <path>`. `--forceExit` is required — leaked async handles otherwise hang the runner. Don't pipe Jest output through `| tail` etc.; it can block the runner indefinitely.
- **Per-worker DB bootstrap is off-limits**: `src/scripts/dbs4tests-create.ts` and adjacent worker-DB scripts are user-owned infrastructure. If `test:parallel` fails with a `permission denied for schema public` or similar bootstrap error, **stop and report** — don't patch the script.

---

## Logging

Use the NestJS `Logger` from `@nestjs/common`, never `console.log` / `console.error`. The production app uses a `StructuredLogger` that emits JSON for Cloud Logging; `console.*` bypasses it and produces unstructured output.

```typescript
// ✅ Correct
import { Logger } from "@nestjs/common"
private readonly logger = new Logger(MyService.name)
this.logger.log("starting", { jobId })
this.logger.error("failed", error.stack)

// ❌ Wrong
console.log("starting", jobId)
```

Exception: files that run before NestJS bootstrap (e.g. `open-telemetry-init.ts`) where the structured logger isn't yet available — `console.error` is OK there with a comment explaining why.

---

## Security & Dependencies

Never use npm `overrides` in `package.json` to work around transitive-dependency CVEs. `npm install` after adding overrides regenerates the lockfile for the current platform only, dropping cross-platform optional native binaries (e.g. `@rollup/rollup-linux-x64-gnu`) and breaking CI/Linux builds. Add an entry to `.trivyignore.yaml` instead with a 30–60 day expiry (use the `/trivy-ignore` skill). `npm audit fix` (without `--force`) is OK for direct, non-breaking fixes.

---

## Completion Criteria

Before marking API work as completed:

1. `npm run biome:check` — must pass
2. `npm run typecheck` — must pass
3. `npm run test` — all tests must pass
4. `npm run check:boundaries` (from `apps/api`) — must pass (regenerate baselines if new TypeORM relation cycles were introduced, see "Boundary Check Baselines" above)
5. When `rbac.constants.ts` or `permissions.ts` changed, the `check-permission-matrix` skill reports no mismatch

Work is NOT complete until all applicable commands exit with code 0.
