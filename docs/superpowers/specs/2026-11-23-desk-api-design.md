# Desk API: dedicated controllers on the Desk contracts

Status: approved (Alexis, 2026-11-23), for the branch
`claude/desk-api-controllers-endpoints-2d165e`.

## Intent

`packages/desk-contracts` holds the routes the Desk calls and the Zod schemas of what it sends and
reads. No endpoint of the API uses them: the Desk calls the endpoints written for Studio and the
old Desk, and the API does not import the package.

This change gives the Desk an API of its own: a `desk` module in `apps/api`, whose controllers
serve the routes of `desk-contracts` and check requests and responses with their schemas. It is the
first step of [ADR 0031](../../adr/0031-frontend-stack-for-agent-built-apps.md), section 2.13, and
it stops at a faithful copy: each Desk endpoint does what the endpoint the Desk calls today does.

## Goals

- Every route of `desk-contracts` (42 routes in 10 areas, one of them a stream) has a handler in
  `apps/api/src/domains/desk/`.
- Desk paths start with `desk/`. Nothing else in a route changes: same method, same params, same
  body, same response, the `live` segment included.
- The API parses the params, the query and the body of a Desk request with the route's schemas,
  and parses each response with the route's response schema before it leaves.
- The Desk calls only Desk endpoints once the change lands. It switches through the paths of the
  contracts, with no other change in `apps/desk`.
  Note (2026-11-23, final review): one call stays outside `desk/`. A resource card links to a
  library file at `organizations/.../resource-libraries/.../resources/.../file`
  (`apps/desk/src/lib/safe-url.ts`), a route outside the contracts. A Desk route for it is a later
  step.
- Each Desk endpoint checks the permission that the matching endpoint checks today, on the same
  resource.

## Non-goals

These parts of ADR 0031 section 2.13 wait for later changes:

- The Desk access guard (`desk.ui.read` on the project, `agent.read` on the agent with a 404).
- The agent list built from `PermissionService.listResourceIds` and a repository method.
- Reads in GET, paths without `live`, `desk/me` as a home that filters projects and invitations.
- Server-side checks of stream events, and the typed `error` event.
- The source document read through the caller's own run, feedback through the caller's own
  conversation.
- Removing the routes that only the Desk called.

Also out: any new permission, role grant or migration, any change to `/public` routes, and the
status streams of extraction runs, which the Desk does not call (it polls).

## Anti-goals

- A service or a repository changes. If a handler cannot be written without one, stop and ask.
- An existing endpoint changes its behaviour, its guards or its response.
- A Desk endpoint answers differently from the endpoint it copies, other than the two differences
  listed under "Behaviour that changes".
- `apps/desk` imports `@caseai-connect/api-contracts`, or `desk-contracts` imports anything but
  Zod.

## Constraints

- `apps/api/CLAUDE.md` applies: `@Controller()` with no prefix, context resolvers through
  `ResourceContextGuard`, `@CheckPermission`, e2e specs through real HTTP requests, factories for
  test data, `Logger` for logs.
- dependency-cruiser forbids, as an error, an import of another domain's `*.entity.ts` from
  `src/domains/desk/`, type imports included. A handler types a record from the return type of the
  service that gives it, or from the request types of `src/common/context/request.interface.ts`.
- Never run `npm install` in the worktree. The workspace dependency of `apps/api` on
  `desk-contracts` is added by hand in `package.json` and `package-lock.json`.
- The repository is public: no mention of a private repository in code, commits or the PR.

## Approaches

Three ways to reuse today's logic were considered.

1. **Extend the abstract controllers.** Sessions, messages, the reply stream, extractions and CSV
   runs keep their logic in abstract controllers that the `Live*` and `Playground*` controllers
   extend. Desk controllers would extend them too. No heavy logic is duplicated, but the Desk stays
   tied to controllers of the `agents` domain.
2. **Copy the logic.** Desk controllers are standalone and hold their own copy of the handler
   logic, about 1,300 lines for the five abstract controllers. The Desk is independent at once;
   until the old routes go, a fix lands in two places.
3. **Add the Desk paths to the `Live*` controllers.** Rejected: these are not dedicated
   controllers.

**Picked: 2, copy the logic** (Alexis, 2026-11-23), after choosing a faithful copy over the full
target of the ADR.

## Design

### The contracts

- `PROJECT_PATH` becomes `desk/organizations/:organizationId/projects/:projectId`, so every route
  under a project or an agent follows. The account, invitation, organization and project routes
  become `desk/me`, `desk/me/terms-acceptances`, `desk/me/invitations/...`,
  `desk/organizations/mine` and `desk/projects/mine`.
- The package gets a CommonJS build beside its source: a build tsconfig that emits to `dist`, the
  `build` and `dev` scripts, and a `require` entry in `exports`. The Desk keeps resolving the
  source.

### The API reads the contracts

- `apps/api` depends on `@caseai-connect/desk-contracts`. Jest maps it to its source, as it does
  for `api-contracts`.
- Everything that builds or watches `api-contracts` for the API does the same for `desk-contracts`:
  the API's dev scripts, `apps/api/Dockerfile` (filtered installs, build, copies into the runtime
  images), `infra/worktree` (`init.sh`, the `contracts` service), turbo and CI where they name the
  package.

### `src/common/schema-route/`

The generic part, which reads the `schemas` of any route that carries them.

- `@SchemaRoute(route, options)` sets, on one handler: the HTTP method and path, the status code,
  the guard chain (`JwtAuthGuard`, `UserGuard`, the input guard, `ResourceContextGuard`,
  `CheckPermissionGuard`), the response interceptor, the required contexts, the permission and the
  tracked activity. `options.permission` is required: a key with its resource, or an explicit
  value for a route open to any signed-in person. Controllers declare no guard of their own.
- The input guard parses params, query and body with the route's schemas before any resolver runs.
  An absent body counts as an empty one. A failure answers 400 with Nest's body plus
  `issues: [{ path, code, message }]`. Handlers read the parsed values through a parameter
  decorator, typed from the route.
- The response interceptor parses the handler's answer with the route's response schema. Unknown
  keys are stripped. A mismatch is logged with its issue paths and answered with a 500.
- A stream route gets the same input guard and guard chain. Its events are not checked.

### `src/domains/desk/`

- `DeskModule`, registered in `app.module.ts`, with one controller per area of the contracts:
  account, invitations, organizations, projects, agents, agent sessions, conversations (with the
  reply stream), documents, memories, extractions, CSV extractions.
- Handlers copy the logic of the endpoints the Desk calls today, with the session type fixed to
  `live`. Branches that only serve the playground (choosing a settings revision, trace URLs) are
  left out. Mappers private to a controller file are copied; helpers that a feature domain already
  exports are imported.
- A handler returns the input type of its route's response schema, so the typecheck proves the
  mapped record fits the Desk DTO.
- Permissions, per route, are those of today's endpoints:

  | Routes | Check |
  |---|---|
  | account, invitations, `organizations/mine`, `projects/mine` | signed in |
  | agents of a project, documents | `project.read` on the project; a document that is not public also takes `document.read`, in the handler |
  | conversation history, messages, MCP App HTML, attachment URL | `agent.conversation.session.read` on the agent |
  | create a conversation, presign an attachment, reply stream | `agent.conversation.session.create` on the agent |
  | delete a conversation | `agent.conversation.session.delete` on the agent |
  | message feedback | the project's message feedback create key |
  | memories | `agent.read` on the agent |
  | extraction runs and their documents | `agent.extraction.session.read`, `.create`, `.delete` on the agent, as the live routes |
  | CSV runs | `csv_extraction_run.read`, `.create`, `.update`, `.delete` on the agent, as the live routes |

- Status codes and tracked activities are those of today's endpoints.
- The module registers no entity of another domain. Context resolvers come from a module in
  `src/common/context/` that registers their entities and exports the guard and the resolvers.
  Feature modules export the providers the Desk needs that they do not export yet. Module files
  are the only files of other domains that change.
- dependency-cruiser lists `desk` beside `me` and `analytics` in the rules on read-model modules.

### Behaviour that changes

1. The route's schemas are the input check, and every refusal answers 400 before any database
   read, as ADR 0031 section 2.13 decides. This covers an id that is not a UUID and a key the
   schema does not declare, and also the places where a Desk schema is stricter than today's
   handler: `page` and `limit` are required on CSV records, the body of a CSV execution is
   required, an empty message to the reply stream answers 400 where it answers 403, a refused MIME
   type or an oversized extraction document answers 400 where it answers 422, and feedback has no
   default rating or content. The Desk's client already parses each request with the same schemas
   before it sends it, so no call of the Desk changes its answer.
2. A response holds only the fields the Desk declares.

A handler keeps the checks a schema cannot express (the session is `live`, the document is the
caller's upload, the run is open to the caller) with today's status codes, and drops the ones the
schema now guarantees. The contracts are not loosened.

### Tests

- Each area has `e2e-tests/` in its folder: an `auth.spec.ts` for all its routes (no token, no
  role, each role, as the auth specs of the live routes do), and one functional spec per action,
  adapted from the specs of the endpoint it copies.
- `schema-route` has specs of its own: a malformed id, an unknown body key, a stripped response
  field, a response the schema rejects.
- The existing specs stay as they are.
- `apps/desk`: `npm run check -w @caseai-connect/desk` passes with the new paths. No handler,
  factory or story changes, since they read the paths from the routes.

### Documents

- ADR 0031, section 2.13: a dated note for this step, with what it covers and what waits.
- `docs/frontend/conventions.md` (The contract, Endpoints, the recipe of an endpoint),
  `apps/desk/AGENTS.md` (Contracts, Endpoints), the root `CLAUDE.md` (project structure, Desk
  application) and `apps/api/CLAUDE.md` (a section on schema routes and the Desk module) say that
  the Desk calls its own endpoints and that the API imports the contracts.
- `docs/rbac-permission-matrix.md` does not change: no key or grant changes.
- The changelog entry follows `docs/changelog.md`, through `/end-feature`.

### Order of work

One commit per step, each leaving the API and the Desk in step, so each area's paths switch with
its controllers:

1. The contracts' build, the API's wiring, `schema-route`, `DeskModule` with account, invitations,
   organizations, projects and agents.
2. Conversations: the history, the conversation routes, the reply stream, documents, memories.
3. Extractions: the run histories, extraction runs and their documents, CSV runs.
4. Documents, and a check of the whole Desk in the worktree environment.

## Left to the builder

- File names inside `src/domains/desk/` and `src/common/schema-route/`, and how a large area is
  split into controllers.
- How the e2e requester takes a route of `desk-contracts` (adapting the requester, or adding the
  phantom `request` and `response` of ADR 0031 section 2.12 to `defineSchemaRoute`).
- The exact list of providers each feature module exports, and the shape of the context module.
- Where a helper exported by a feature domain returns a type the Desk schema refuses, the handler
  maps the record itself.
- Whether the old `PROJECT_PATH` stays beside the new one while areas switch one commit at a time.
- How a handler types a request that carries a session: aliases in
  `src/common/context/request.interface.ts`, which is not a domain file, are one way.

## Decided with Alexis (2026-11-23)

- The change ships as one PR, with one commit per step above.
- `docs/frontend/conventions.md` and `apps/desk/AGENTS.md`, which change only with a human's go,
  are updated in this PR.
