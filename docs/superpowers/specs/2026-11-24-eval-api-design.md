# Evaluation API: dedicated controllers on the Evaluation contracts

Status: approved (Alexis, 2026-11-24), for the branch `claude/eval-api-endpoints-81f3f3`.

## Intent

`packages/eval-contracts` holds the routes Evaluation (`apps/eval`) calls and the Zod schemas of
what it sends and reads. No endpoint of the API uses them: Evaluation calls the endpoints written
for the evaluation pages of `apps/web`, and the API does not import the package.

This change does for Evaluation what
[the Desk API](2026-11-23-desk-api-design.md) did for the Desk: an `eval` module in `apps/api`,
whose controllers serve the routes of `eval-contracts` and check requests and responses with their
schemas. It covers every feature of the app: the evaluations of a conversation agent, the
evaluations of an extraction agent, the review campaigns, and the tester and reviewer sides of a
campaign. It stops at a faithful copy: each Evaluation endpoint does what the endpoint the app
calls today does.

## Goals

- Every route of `eval-contracts`, the reply stream included, has a handler in
  `apps/api/src/domains/eval/`.
- Evaluation paths start with `eval/`. Nothing else in a route changes: same method, same params,
  same body, same response, the `review_campaign_tester` segment included.
- The API parses the params, the query and the body of an Evaluation request with the route's
  schemas, and parses each response with the route's response schema before it leaves.
- Evaluation calls only Evaluation endpoints once the change lands. It switches through the paths
  of the contracts, with no other change in `apps/eval`.
- Each Evaluation endpoint checks the permission that the matching endpoint checks today, on the
  same resource.

## Non-goals

- Moving the entities, services, repositories and workers of `domains/evaluations/` and
  `domains/review-campaigns/`. They stay where they are (Alexis, 2026-11-24: controllers only). A
  move of that code is a later change of its own.
- Removing the old endpoints. The ones only Evaluation called go in a follow-up change, as the
  live session endpoints of the Desk did. Until then a browser tab on an older build of
  Evaluation keeps working.
- An access guard on `evaluation.ui.read`, and any other part of ADR 0031 section 2.13 that the
  Desk step left for later.
- Routes the app does not call: the status streams of evaluation runs, the CSV export of a
  campaign report, the test-case routes and `addMemberRole`, which the Studio calls.
- Server-side checks of stream events.

Also out: any new permission, role grant or migration, and any change to `/public` routes.

## Anti-goals

- A service or a repository changes. If a handler cannot be written without one, stop and ask.
- An existing endpoint changes its behaviour, its guards or its response. The Studio, the MCP
  evaluation tools and the backoffice keep what they use.
- An Evaluation endpoint answers differently from the endpoint it copies, other than the two
  differences listed under "Behaviour that changes".
- `apps/eval` imports `@caseai-connect/api-contracts`, or `eval-contracts` imports anything but
  Zod.
- `src/domains/eval/` imports a file of `src/domains/desk/`, or the reverse. Each app's module is
  a closed world, as each app is.

## Constraints

- `apps/api/CLAUDE.md` and [`docs/schema-routes.md`](../../schema-routes.md) apply: `@Controller()`
  with no prefix and no guard of its own, `@SchemaRoute` on each handler, e2e specs through real
  HTTP requests, factories for test data, `Logger` for logs.
- `src/domains/eval/` imports no `*.entity.ts` of another domain, type imports included. Specs and
  factories are excepted. A handler types a record from the return type of the service that gives
  it, or from `src/common/context/request.interface.ts`.
- Never run `npm install` in the worktree. The workspace dependency of `apps/api` on
  `eval-contracts` is added by hand in `package.json` and `package-lock.json`.
- The repository is public: no mention of a private repository in code, commits or the PR.
- A change to the conversation code of Evaluation runs `check:desk-parity`. This change does not
  touch it.

## Approaches

The Desk design weighed three ways to reuse today's logic: extend the abstract controllers, copy
the logic, or add paths to the existing controllers. It picked the copy. Two questions are specific
to Evaluation.

**What `domains/eval/` holds.**

1. **Controllers only.** `eval/` is the app's API, with a folder per area of the contracts. The
   business code stays in `evaluations/` and `review-campaigns/`. The old controllers stay until a
   follow-up change removes the routes nobody else calls.
2. **All the evaluation code.** Entities, services, repositories and workers move into `eval/`
   too. This breaks the rule that an app's module imports no entity of another domain and sits
   above the feature domains, and it touches the MCP tools, the workers, the backoffice and the
   entities of `agents`, `projects` and `users`.

**Picked: 1, controllers only** (Alexis, 2026-11-24).

**Copy or move the handlers.** Most of the old evaluation endpoints have Evaluation as their only
caller, so the handlers could move in place of being copied. A copy keeps the old paths alive for
tabs on an older build and keeps this change free of deletions in the feature domains. The removal
then lands alone, easy to review. **Picked: copy now, remove next**, as for the Desk.

## Design

### The contracts

- `PROJECT_PATH` becomes `eval/organizations/:organizationId/projects/:projectId`, so every route
  under a project or an agent follows. The other routes become `eval/me`,
  `eval/me/invitations/...`, `eval/me/review-campaigns`, `eval/organizations/mine` and
  `eval/projects/mine`.
- The package gets a CommonJS build beside its source, as `desk-contracts` has: a
  `tsconfig.build.json`, the `build` and `dev` scripts, `main` and a `require` entry in `exports`.
  Evaluation keeps resolving the source.
- The comment of `defineSchemaRoute` says the API serves the route.
- Two query schemas change so the API can check them, as `docs/frontend/conventions.md` (The
  contract) asks. No call of the app changes.
  - The `page` and `limit` of the four records queries use `z.coerce.number`, which reads an empty
    text as 0. They go through a codec that refuses an empty text, as `queryNumberSchema` of
    `desk-contracts` does.
  - `columnFiltersSchema` calls `JSON.parse` in its codec, which throws on a malformed text, and
    the input guard would answer 500. The codec reports a Zod issue, so the answer is a 400. The
    shared guard does not change. (My call: the fix belongs to the schema that parses.)

### The API reads the contracts

Everything that builds, watches or resolves `desk-contracts` for the API does the same for
`eval-contracts`: the dependency in `apps/api/package.json` and `package-lock.json`, the dev
scripts of `apps/api/package.json`, the `moduleNameMapper` lines of `apps/api/jest.config.js`,
every stage of `apps/api/Dockerfile`, `infra/worktree/init.sh`, the `contracts` service of
`infra/worktree/docker-compose.yaml`, `API_PATHS` in the `Makefile`, and CI where it names the
package. A spec proves the API loads a route of the package with its schemas.

### `src/common/schema-route/`

The layer is reused as it is. One thing changes: it takes the types `AnySchemaRoute` and
`AnyStreamRoute` from `@caseai-connect/desk-contracts` today. It declares the shape of a route
itself from now on (`path`, `getPath`, `method`, `schemas`), so it depends on no app's contracts
and a route of either package fits. `test/schema-request.ts` follows. Each contracts package keeps
its own `defineSchemaRoute`, so each app stays a closed world. See "To confirm".

### The contexts

The handlers need contexts that `ResourceContextModule` does not give: `reviewCampaign`,
`agentSessionInCampaign`, `agentSessionReviewCampaign`, `evaluationConversationDataset`,
`evaluationConversationRun`, `evaluationExtractionDataset`, `evaluationExtractionDatasetDocument`
and `evaluationExtractionRun`. Their resolvers already live in `src/common/context/resolvers/`. A
context module in `src/common/context/` registers their entities and exports them, so the
Evaluation module registers no entity of another domain. `ResourceContextModule` keeps what the
Desk uses. The guard takes each resolver as optional, so a resolver the module forgets fails at
the first request, never at start: the auth specs cover each context. The resolver of
`evaluationExtractionDatasetDocument` reads a repository of the evaluations domain, which that
domain's module exports.

The reviewer routes, and the tester's feedback and session deletion, use
`agentSessionInCampaign`: it reads the campaign from the session and ignores `:reviewCampaignId`.
On these routes an unknown campaign id with a valid session does not answer 404, today and after.

### `src/domains/eval/`

`EvalModule`, registered in `app.module.ts`, with a folder per area of the contracts. The two large
areas have a sub-folder per feature:

```
eval/
  eval.module.ts
  routes.spec.ts
  account/              EvalAccountRoutes
  invitations/          EvalMyInvitationsRoutes
  organizations/        EvalOrganizationsRoutes
  projects/             EvalProjectsRoutes
  agents/               EvalAgentsRoutes
  documents/            EvalDocumentsRoutes
  conversations/        EvalConversationsRoutes: a tester's conversation and its reply stream
  evaluations/
    conversation/       EvalConversationDatasetsRoutes, EvalConversationRunsRoutes
    extraction/         EvalExtractionDatasetsRoutes, EvalExtractionRunsRoutes
  review-campaigns/
    campaigns/          EvalReviewCampaignsRoutes, EvalCampaignInvitationsRoutes
    reviewer/           EvalReviewerRoutes
    tester/             EvalTesterRoutes
```

- Files drop the `eval-` prefix, since the folder says it. Classes keep an `Eval` prefix
  (`EvalConversationRunsController`), which tells them apart from the controllers of the feature
  domains.
- Handlers copy the logic of the endpoints the app calls today. The tester's conversation copies
  the abstract `AgentMessagesController` and `StreamingController` with the session type fixed to
  `review_campaign_tester`, as the Desk copied them with `live`. Mappers private to a controller
  file are copied. Helpers that a feature domain exports are imported.
- A handler returns the input type of its route's response schema, so the typecheck proves the
  mapped record fits the Evaluation DTO.
- Permissions, per route, are those of today's endpoints:

  | Routes | Check |
  |---|---|
  | account, my invitations, `organizations/mine`, `projects/mine`, `me/review-campaigns` | signed in |
  | agents of a project, documents | `project.read` on the project. A document that is not public also takes `document.read`, in the handler |
  | versions of an agent | `agent.settings.read` on the agent |
  | models of a project | `project.read` on the project |
  | conversation datasets and their records | `EVALUATION_CONVERSATION_DATASET_*` (read, create, update, delete) on the project |
  | conversation runs | `EVALUATION_CONVERSATION_RUN_*` on the project |
  | extraction datasets, their files and records | `EVALUATION_EXTRACTION_DATASET_*` on the project |
  | extraction runs | `EVALUATION_EXTRACTION_RUN_*` on the project |
  | campaigns: list, read, create, update, delete, revoke a membership | `PROJECT_REVIEW_CAMPAIGN_*` on the project |
  | campaign invitations | `PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION` on the project |
  | campaign report | `REVIEW_CAMPAIGN_REPORT_READ_PERMISSION` on the campaign |
  | campaign context for a participant | `REVIEW_CAMPAIGN_READ_PERMISSION` on the campaign |
  | reviewer: sessions, a session, its MCP App HTML, create and update a review | `REVIEW_CAMPAIGN_REVIEWER_SESSION_READ_PERMISSION`, `REVIEW_CAMPAIGN_REVIEWER_REVIEW_*` on the campaign |
  | tester: sessions, start and delete a session, feedback, survey | `REVIEW_CAMPAIGN_TESTER_SESSION_*`, `REVIEW_CAMPAIGN_TESTER_FEEDBACK_*`, `REVIEW_CAMPAIGN_TESTER_SURVEY_*` on the campaign |
  | tester's conversation: messages, MCP App HTML, attachment URL | `REVIEW_CAMPAIGN_TESTER_SESSION_READ_PERMISSION` on the campaign |
  | tester's conversation: presign an attachment, reply stream | `REVIEW_CAMPAIGN_TESTER_SESSION_CREATE_PERMISSION` on the campaign |
  | message feedback | `PROJECT_AGENT_MESSAGE_FEEDBACK_CREATE_PERMISSION` on the project |

  The builder reads each key and each context list from the handler it copies, never from this
  table.
- Status codes and tracked activities are those of today's endpoints.
- Feature modules export the providers the module needs that they do not export yet. Module files
  are the only files of other domains that change.
- dependency-cruiser lists `eval` beside `desk` in the two rules on read-model modules. Its rule
  on another domain's `*.entity.ts` already covers every folder of `src/domains/`.

### Behaviour that changes

1. The route's schemas are the input check, and every refusal answers 400 before any database
   read. This covers an id that is not a UUID, a key the schema does not declare, and each place
   where an Evaluation schema is stricter than today's handler. The plan lists those places area
   by area as the handlers are read. The client of Evaluation already parses each request with
   the same schemas before it sends it, so no call of the app changes its answer.
2. A response holds only the fields Evaluation declares.

A handler keeps the checks a schema cannot express (the session belongs to the campaign, the run
is in a state that allows the action) with today's status codes, and drops the ones the schema now
guarantees. The contracts are not loosened.

### Tests

- Each folder that holds a controller has `e2e-tests/`: an `auth.spec.ts` for all its routes (no
  token, a malformed id, an unknown resource, each role), and one functional spec per action,
  adapted from the specs of the endpoint it copies, with `testSchemaRequester` and
  `expectSchemaResponse`.
- `src/domains/eval/routes.spec.ts` reads every `*Routes` export of the contracts and checks that
  each route starts with `/eval/` and has a handler.
- The existing specs stay as they are.
- `apps/eval`: `npm run check -w @caseai-connect/eval` passes with the new paths. Handlers,
  factories and stories read the paths from the routes. A spec that writes a path by hand is
  moved to the route, as one Desk spec was.

### Documents

- ADR 0031, section 2.13: a dated note for this step, with what it covers and what waits.
- `docs/schema-routes.md`: Evaluation is the second app, the layer owns the shape of a route, and
  "Using it for another app" matches what was done.
- The root `CLAUDE.md` (project structure, an Evaluation application section) and
  `apps/api/CLAUDE.md` (the Evaluation module beside the Desk module).
- `apps/eval/AGENTS.md` and `docs/frontend/conventions.md` (Endpoints): Evaluation calls its own
  endpoints and the API imports its contracts. See "To confirm".
- `docs/rbac-permission-matrix.md` does not change: no key or grant changes.
- The changelog entry follows `docs/changelog.md`, through `/end-feature`.

### Order of work

One commit per step, each leaving the API and Evaluation in step, so each area's paths switch with
its controllers. Until the last step, the areas not yet served keep today's paths through legacy
twins in the contracts, removed at the end: `LEGACY_PROJECT_PATH` and `LEGACY_AGENT_PATH`, as the
Desk plan had, and one for the campaign path, which steps 4, 5 and 6 share.

1. The contracts' build, the API's wiring, the route shape in `schema-route`, the context module,
   and `EvalModule` with account, invitations, organizations, projects, agents and documents.
2. Evaluations of a conversation agent: datasets with their records, and runs.
3. Evaluations of an extraction agent: datasets with their files and records, and runs.
4. Review campaigns: campaigns, memberships, invitations, the report, `me/review-campaigns`.
5. The reviewer side.
6. The tester side, with the tester's conversation and its reply stream.
7. `routes.spec.ts`, the documents, and a check of the whole app in a worktree environment. This
   worktree's name is too long for an environment, so the check runs in a short-named worktree on
   the same branch.

## Left to the builder

- File names inside each folder, and how a large area is split into controllers.
- The exact list of providers each feature module exports, and the name and shape of the context
  module.
- Where a helper exported by a feature domain returns a type the Evaluation schema refuses, the
  handler maps the record itself.
- How a handler types a request that carries a campaign or an evaluation resource: the types of
  `src/common/context/request.interface.ts` first.

## Decided with Alexis (2026-11-24)

1. **The route helper.** `docs/schema-routes.md` planned to move `defineSchemaRoute` to a package
   of its own once a second app needs it. This design does less: the API layer declares the shape
   of a route, and each contracts package keeps its copy of the helper. Reason: a shared package
   means one more build to wire everywhere, and the contracts of an app would import something
   other than Zod. The cost is two copies of a small file that must keep the same shape, which
   the typecheck of the API proves on every handler.
2. **One PR**, with one commit per step above, as for the Desk.
3. **`docs/frontend/conventions.md` and `apps/eval/AGENTS.md`**, which change only with a human's
   go, are updated in this PR.
