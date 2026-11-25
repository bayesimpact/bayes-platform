# Schema routes

A schema route is an API endpoint that is declared once, in a contracts package, with the Zod
schemas of what it takes and what it answers. The API serves it with one decorator,
`@SchemaRoute`, which checks every request and every JSON response with those schemas.

The Desk is the first app whose endpoints are schema routes (`apps/api/src/domains/desk/`).
Evaluation is the second (`apps/api/src/domains/eval/`). The next apps of the stack of
[ADR 0031](adr/0031-frontend-stack-for-agent-built-apps.md) follow the same pattern. The ADR, section 2.13, keeps the decision. This page explains how the pattern works
and how to use it.

The code is small. Read it beside this page:

| File | What it holds |
|---|---|
| `packages/schema-route/src/define-schema-route.ts` | `defineSchemaRoute`, `defineStreamRoute` and the types of a route |
| `packages/schema-route/src/error.dto.ts` | the body of an error response |
| `apps/api/src/common/schema-route/schema-route.decorator.ts` | `@SchemaRoute` |
| `apps/api/src/common/schema-route/schema-route-input.guard.ts` | the check of the request |
| `apps/api/src/common/schema-route/schema-route-response.interceptor.ts` | the check of the response |
| `apps/api/src/common/schema-route/route-input.decorator.ts` | `@RouteInput()` |
| `apps/api/src/common/schema-route/schema-route.types.ts` | the options and the types of a handler |
| `apps/api/src/common/schema-route/schema-route.spec.ts` | the behaviour, test by test |
| `apps/api/test/schema-request.ts` | the helpers of the e2e specs |

## One route, from the contract to the handler

The contract declares the route (`packages/desk-contracts/src/extractions/extractions.routes.ts`):

```ts
executeOne: defineSchemaRoute({
  method: "post",
  path: `${runsPath}/execute`,
  params: agentParamsSchema,
  body: executeExtractionInputSchema,
  response: executeExtractionOutputSchema,
}),
```

The API serves it (`apps/api/src/domains/desk/extractions/extractions.controller.ts`):

```ts
@SchemaRoute(DeskExtractionsRoutes.executeOne, {
  permission: { key: AGENT_EXTRACTION_SESSION_CREATE_PERMISSION, on: "agent" },
  context: ["organization", "project", "agent"],
  activity: { action: "extractionAgentSession.execute" },
})
async executeOne(
  @Req() request: EndpointRequestWithAgent,
  @RouteInput() { payload }: SchemaRouteInput<typeof DeskExtractionsRoutes.executeOne>,
): Promise<SchemaRouteResponse<typeof DeskExtractionsRoutes.executeOne>> {
  // payload.documentId is a UUID here: the schema checked it.
  return { data: { runId: run.id } }
}
```

The frontend calls the same route object, and parses the answer with the same response schema.

## What the decorator sets

`@SchemaRoute` composes the decorators the other controllers already use. The example above is
the same as this, written by hand on the handler:

```ts
@SetMetadata("schema_route", DeskExtractionsRoutes.executeOne)
@UseGuards(JwtAuthGuard, UserGuard, SchemaRouteInputGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent")
@CheckPermission(AGENT_EXTRACTION_SESSION_CREATE_PERMISSION, "agent")
@Post(DeskExtractionsRoutes.executeOne.path)
@UseInterceptors(SchemaRouteResponseInterceptor)
@TrackActivity({ action: "extractionAgentSession.execute" })
```

So a schema route keeps the authorization model of [ADR 0019](adr/0019-rbac-permission-catalog.md)
and the context resolvers of `apps/api/CLAUDE.md`. It adds two things: the input guard and the
response interceptor.

## Why one decorator, and not `@Get` with `@CheckPermission`

- **The order of the guards.** The input guard must run after the sign-in and before the context
  resolvers, so that a malformed id answers 400 before any database read. In the other
  controllers the guards sit on the class. Nest runs class guards before method guards, so a guard
  added on a method would run after the context and the permission. The whole chain has to sit on
  the handler, in one `@UseGuards`, in a fixed order. The decorator writes it once.
- **The schemas come from the route.** The other endpoints check a body with
  `@UsePipes(new ZodValidationPipe(schema))`, one schema at a time, and check neither the params,
  nor the query, nor the response. Here the route carries its schemas, so a route and its checks
  cannot drift apart.
- **A permission cannot be forgotten.** A handler with no `@CheckPermission` compiles and runs.
  `options.permission` is required, and an open route says so with `"signed-in"`.

The cost: a schema route does not read like the other controllers, and a search for
`@CheckPermission(` does not find it. Search for `permission: { key:`.

## How a request goes through

| Step | What runs | What a refusal answers |
|---|---|---|
| 1 | `JwtAuthGuard`, then `UserGuard` | 401 |
| 2 | The input guard parses the params, the query and the body with the route's schemas | 400, with `issues` |
| 3 | `ResourceContextGuard` loads the resources of `context` | what the resolvers answer for the other controllers, such as a 404 for an unknown project |
| 4 | `CheckPermissionGuard` checks `permission` | 403 |
| 5 | The handler | its own errors |
| 6 | The response interceptor parses the answer with the response schema | 500, logged |

Steps 3 and 4 run only when the route has a `context` and a scoped permission.

### The input guard

- It parses `request.params`, `request.query` and the body. A route that reads no body takes an
  absent body as an empty one.
- The schemas of the contracts are strict (`z.strictObject`): a key the schema does not declare
  is refused, in the query too.
- It stores the parsed values for `@RouteInput()`. It leaves `request.params` as Express gave
  them, since the context resolvers read them.
- A refusal answers 400 with Nest's body plus the issues. Each path starts with `params`, `query`
  or `body`:

```json
{
  "statusCode": 400,
  "message": "Invalid request",
  "error": "Bad Request",
  "issues": [{ "path": ["params", "agentId"], "code": "invalid_format", "message": "Invalid UUID" }]
}
```

### The response interceptor

- It parses what the handler returns with `route.schemas.response`, the `{ data }` envelope
  included.
- A key the schema does not declare is removed. A frontend never receives a field it did not
  declare.
- A mismatch is a bug of the API: the interceptor logs the route and the paths of the issues, with
  no value, and answers 500. Fix the mapper, or the schema when the data is right.

## The options

`@SchemaRoute(route, options)`:

| Option | Value | Notes |
|---|---|---|
| `permission` | `{ key, on }` or `"signed-in"` | Required. `key` is a permission of the catalog, `on` the resource it is checked on (`"project"`, `"agent"`...). `"signed-in"` is a route open to any signed-in person, such as `desk/me`. |
| `context` | a list of resources, in resolution order | Required with a scoped permission. `["organization", "project", "agent"]`, plus `"agentSession"`, `"document"` or `"agentCsvExtractionRun"` when the path names one. |
| `activity` | `{ action, entityFrom? }` | The same options as `@TrackActivity`. |
| `status` | an HTTP status | Defaults to Nest's: 201 for a POST, 200 otherwise. |

The decorator refuses a wrong combination when the API starts, so the mistake cannot ship:

- a scoped permission with no `context`: the permission guard would find no resource;
- `"signed-in"` with a `context`: resources would load with no permission check;
- an `activity`, or a `status` other than 200, on a stream route.

## Writing a handler

- The controller is `@Controller()`, with no prefix and no guard of its own. A guard on the class
  would run before the chain of the decorator.
- `@RouteInput() input: SchemaRouteInput<typeof route>` gives `{ params, query, payload }`, parsed
  and typed from the route. `payload` is `undefined` when the route reads no body.
- The signed-in person and the resources the resolvers loaded still come from `@Req()`, with the
  types of `src/common/context/request.interface.ts`.
- The handler returns `Promise<SchemaRouteResponse<typeof route>>`: the `{ data }` that the
  response schema takes as input. The typecheck then proves the record fits the contract. Never
  cast to silence it: map the record.
- The handler keeps only the checks a schema cannot express, such as "this run is the caller's".
  It drops the ones the schema already makes, such as "the id is present".
- A nullable column needs care. A schema field that is `.optional()` refuses `null`: map `null` to
  `undefined`, or declare the field `.nullable()` in the contract.

## Streams

A route declared with `defineStreamRoute` is served by the same decorator. It answers 200 with
server-sent events, on a POST when the route says so. The input guard and the guard chain are the
same. The events are not checked on the server yet: the frontend parses each one with the route's
`event` schema. A stream records no activity through the decorator.

## Tests

E2e specs call the routes over HTTP, as `apps/api/CLAUDE.md` asks, with two helpers of
`apps/api/test/schema-request.ts`:

- `testSchemaRequester(app)({ route, pathParams, query, body, token })` calls a route. It never
  writes a path: the route gives it. `body` is sent as given, with its `{ payload }` envelope.
- `expectSchemaResponse(route, response, status)` checks the status, and that the body is exactly
  what the response schema keeps. A field the contract does not declare fails the test.

For a stream, call supertest at `route.getPath(params)`.

Each folder of an app's module has an `auth.spec.ts` for all its routes: no token (401), a
malformed id (400), an unknown resource (404), each role. `src/domains/desk/routes.spec.ts` checks
that every route of the Desk contracts starts with `/desk/` and has a handler.
`src/domains/eval/routes.spec.ts` does the same for the Evaluation contracts and `/eval/`.

## Using it for another app

The layer in `src/common/schema-route/` is generic. An app that gets endpoints of its own needs:

1. **A contracts package** that depends on `@caseai-connect/schema-route` and re-exports it, as
   `packages/desk-contracts` and `packages/eval-contracts` do, so the app imports the helper and
   the error body from its own contracts. The package holds one `defineSchemaRoute`, and the layer
   in `src/common/schema-route/` takes `AnySchemaRoute` and `AnyStreamRoute` from it, so a route of
   any contracts package type-checks. The layer imports no contracts package.
2. **A CommonJS build that the API requires.** Do what was done for the Desk contracts: a
   `tsconfig.build.json` and the `build` and `dev` scripts, `main` and a `require` entry in
   `exports`, the dependency in `apps/api/package.json` and `package-lock.json`, the
   `moduleNameMapper` lines of `apps/api/jest.config.js`, every stage of `apps/api/Dockerfile`,
   `infra/worktree/init.sh` and the `contracts` service of `infra/worktree/docker-compose.yaml`,
   and `API_PATHS` in the `Makefile`.
3. **A path prefix and a module named after the app**: `desk/` and `src/domains/desk/` for the
   Desk, `eval/` and `src/domains/eval/` for Evaluation. The module imports
   `ResourceContextModule` (`src/common/context/`) for the context resolvers, and registers no
   entity of another domain. An app that needs the resolvers of evaluations and review campaigns
   also imports `EvaluationContextModule`, a second context module in the same folder.
4. **A spec like `src/domains/desk/routes.spec.ts` or `src/domains/eval/routes.spec.ts`**, so a
   route with no handler fails a test.
5. **Its documents**: the app's `AGENTS.md`, `docs/frontend/conventions.md` (Endpoints) and
   `apps/api/CLAUDE.md`.

An existing endpoint declared with `defineRoute` in `packages/api-contracts` stays as it is. It has
no schemas for the decorator to read.

## Limits today

- The events of a stream are not checked on the server.
- When the response check fails, the handler already ran: the action is done, the answer is a 500,
  and no activity is recorded.
- A Desk handler holds a copy of the logic of an abstract controller of the `agents` domain, which
  now serves the playground. Nothing links the two: a change to one goes to the other.
- A handler of the tester's conversation in Evaluation holds a copy of the same abstract
  controllers. A change to one of them now goes to the Desk handler and to the Evaluation handler
  too.
- The old endpoints that only Evaluation called are gone, so most Evaluation handlers are the only
  handlers of what they serve. Copies remain where the source still serves another app: the
  handlers of the shared areas (`me`, `invitations`, `organizations`, `projects`, `agents`,
  `documents`, the feedback on a message), the list of conversation datasets and
  `revokeMembership` of a campaign, which the Studio calls on the old routes. Nothing links a copy
  to its source, so a change to one goes to the other.
- In a worktree environment, run `bayes wt up` after a change to a contracts package or to
  `packages/schema-route`. After a
  rebase, check that the API runs (`/api/me` answers 401) and run `bayes wt restart api` when it
  does not.
