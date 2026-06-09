# ADR 0007: NestJS Module Topology and Cross-Module Boundaries

* **Status**: Proposed
* **Date**: 2026-04-21
* **Deciders**: Jérémie
* **Scope**: `apps/api` (API + workers are assembled from the same codebase via `app.module.ts` / `gpu-workers-app.module.ts`)

---

## 1. Context and Problem Statement

`apps/api` currently contains 32 `*.module.ts` files. The import graph has **two epicenters**:

1. **The Projects knot**: `Agents ↔ Projects`, `Agents → Documents → Projects → Agents`, `Agents → DocumentTags → Projects → Agents`, `Documents → DocumentTags → Projects → Documents`. Every cycle that touches a feature module routes through `ProjectsModule`.
2. **The Streaming knot**: `Streaming ↔ ConversationAgentSessions`, `Streaming ↔ FormAgentSessions`, plus the dynamic `require()` cycle in `base-agent-sessions-module.helpers.ts`.

Fix those two and the rest untangles. Concrete findings:

* **Direct circular imports.** **11 `forwardRef(() => X)` declarations** across 7 modules:
    * Projects knot: `ProjectsModule ↔ AgentsModule`, `DocumentsModule ↔ ProjectsModule`, `DocumentsModule ↔ DocumentTagsModule`, `AgentsModule ↔ DocumentsModule`, `AgentsModule ↔ DocumentTagsModule`
    * Streaming knot: `AgentsModule ↔ ConversationAgentSessionsModule / ExtractionAgentSessionsModule / FormAgentSessionsModule`, `StreamingModule ↔ ConversationAgentSessionsModule`, `StreamingModule ↔ FormAgentSessionsModule`

* **An indirect cycle that the static resolver cannot follow, patched with `require()` inside `forwardRef`.** In `apps/api/src/domains/agents/base-agent-sessions/base-agent-sessions-module.helpers.ts:28-36`:

    ```ts
    // Use dynamic require inside forwardRef to avoid circular static imports:
    // helpers.ts → DocumentsModule → ProjectsModule → AgentsModule → session modules → helpers.ts
    forwardRef(() => require("../agents.module").AgentsModule),
    forwardRef(() => require("../../documents/documents.module").DocumentsModule),
    forwardRef(() => require("../../projects/projects.module").ProjectsModule),
    ```

    This is a self-diagnosed wrong seam.

* **Hub fan-in / monolith fan-out.** Counting module-level imports in `*.module.ts` files only:

    | Fan-in (imported by N modules) | Fan-out (imports N modules) |
    |---|---|
    | `AuthModule` — 12 | `AppModule` — 24 (incl. 3 duplicates) |
    | `UsersModule` — 12 | `AgentsModule` — 13 |
    | `OrganizationsModule` — 8 | `DocumentsModule` — 10 |
    | `ProjectsModule` — 7 | `EvaluationsModule` — 10 |
    | `StorageModule` — 7 | `WorkersAppModule` — 8 |

    `AuthModule` and `UsersModule` are the natural shared-layer hubs — high fan-in is correct for them. `ProjectsModule` showing up with fan-in 7 *and* sitting on every cycle is the cycle generator. `AgentsModule` / `DocumentsModule` / `EvaluationsModule` each import 10+ other modules each — they are monolithic feature modules that have absorbed siblings they don't need at runtime.

* **Import closures that pull in essentially the whole app.** Because of the cycles above, `DocumentsModule`'s transitive import closure reaches `ProjectsModule → AgentsModule → (conversation|form|extraction)AgentSessionsModule → StreamingModule → McpServersModule + McpModule + LlmModule + OrganizationsModule + UsersModule + AuthModule + StorageModule + DocumentEmbeddingsBatchModule`. Any worker that imports `DocumentsModule` drags all of that in. Today `EvaluationExtractionRunWorkersModule` imports `DocumentsModule` directly — exactly the pathology the user reported.

* **Workers smuggle feature code past the module system.** Both worker modules bypass the DI graph to keep the closure manageable:
    * `document-embeddings-workers.module.ts` registers `DocumentsService` and `DocumentTagsService` *as its own providers* while only importing `StorageModule`. It then registers `TypeOrmModule.forFeature(ALL_ENTITIES)` (the catch-all at `apps/api/src/common/all-entities.ts`) to make repositories resolvable.
    * `evaluation-extraction-run-workers.module.ts` imports `DocumentsModule` (dragging the full cycle) *and* registers `TypeOrmModule.forFeature(ALL_ENTITIES)`.

    The result is three separate ways of getting at entity repositories, duplicated service instances (the worker's `DocumentsService` is a different DI instance than the API's), and a shared `ALL_ENTITIES` file that has to be kept in lock-step with every new entity.

* **Cross-module writes via `entityManager` and `dataSource.getRepository`.** Feature services routinely read and mutate other modules' tables instead of calling a service on the owning module. Inventory:

    | Service | Owns | Reaches into |
    |---|---|---|
    | `ProjectsService.deleteProject` | `Project` | `Agent` (delegates ✓), `EvaluationReport`, `Evaluation`, `Document`, `ProjectMembership` |
    | `BaseAgentSessionsService.deleteAgentSession` | `*AgentSession`, `AgentMessage` | `Document` (extraction orphan cleanup), `AgentMessageFeedback` |
    | `AgentsService.deleteAgent` | `Agent`, `AgentMembership` | — (clean, delegates to `BaseAgentSessionsService`) |
    | `AgentMembershipsService` | `AgentMembership` | `ProjectMembership`, `OrganizationMembership`, `User`, and `dataSource.getRepository(ProjectMembership)` |
    | `ProjectMembershipsService` | `ProjectMembership` | calls into `AgentMembershipsService` with a shared `EntityManager`, plus `User`, `OrganizationMembership` |
    | `WorkspaceInvitationService` (Organizations) | `Organization` | `dataSource.getRepository(User | Project | ProjectMembership)` |
    | `DocumentEmbeddingsProcessorService` | `Document`, `document_chunk` | raw SQL against `document_chunk` (owned ✓) |

* **Duplicate imports in the root module.** `apps/api/src/app.module.ts:56-65` imports `OrganizationsModule`, `ProjectsModule`, and `UsersModule` twice each. NestJS dedupes them at runtime, but the duplication points to the lack of a maintained authoritative list.

* **Modules that exist to hold a single thin service.** `DocumentTagsModule`, `AgentMessageFeedbackModule`, and `InvitationsModule` each export 1 service and carry 6–7 imports to re-establish the context their parent module already has. `InvitationsModule` is the most striking: it declares `AgentMembershipsService` and `ProjectMembershipsService` as its *own* providers — creating duplicate DI instances of services that are already provided by `AgentsModule` and `ProjectsModule`.

* **No tooling enforces any of this.** `apps/api/package.json` does not depend on `madge`, `dependency-cruiser`, or `eslint-plugin-boundaries`. Nothing fails CI when a new cycle is introduced or when a feature module imports an entity it does not own.

Net effect: the team reaches for `forwardRef`, `dataSource.getRepository`, `entityManager.delete(OtherModulesEntity, …)`, and `ALL_ENTITIES` catch-alls whenever a boundary is inconvenient. Each workaround is locally reasonable; cumulatively they are the reason importing `DocumentsModule` into a worker pulls in half the app.

## 2. Decision

### 2.1 Target Topology — five layers, strictly one-way

```
┌──────────────────────────── composition ───────────────────────────┐
│  AppModule   WorkersAppModule                                      │
├──────────────────────────── cross-domain ──────────────────────────┤
│  MeModule   ProjectsAnalyticsModule   AgentsAnalyticsModule         │
│  InvitationsModule (controller-only aggregator)                     │
├──────────────────────────── domain features ───────────────────────┤
│  OrganizationsModule   ProjectsModule   AgentsModule                │
│  DocumentsModule   EvaluationsModule   McpServersModule             │
│  ActivitiesModule                                                   │
├──────────────────────────── shared (core) ─────────────────────────┤
│  AuthModule   UsersModule                                           │
│  common/* (guards, resolvers, policies, interceptors)               │
├──────────────────────────── infrastructure ────────────────────────┤
│  StorageModule   LlmModule   McpModule                              │
│  DocumentEmbeddingsBatchModule   EvaluationExtractionRunBatchModule │
│  BullBoardAdminModule   DiagnosticsModule   WorkersHealthModule     │
└────────────────────────────────────────────────────────────────────┘
```

**Dependency rule**: a module may only import from strictly lower layers (plus itself). No sibling-to-sibling imports within the *domain features* layer except through the two escape hatches in §2.3.

**What each layer owns**

* **Infrastructure**: wraps an external system (BullMQ queue, GCS bucket, LLM provider, MCP client, bull-board, HTTP health). Zero domain knowledge. No domain entities.
* **Shared / core**: `AuthModule` (strategies, invitation sender), `UsersModule` (the `User` entity), and the contents of `common/` (guards, context resolvers, policies, filters, request-scoped middleware). These are used by every feature and depend only on infrastructure.
* **Domain features**: one module per *bounded context*, owning its entities, services, controllers, and the context resolvers that load its resources. Cross-context collaboration happens only through exported services, not through entity imports.
* **Cross-domain read-models**: modules whose job is to *query* across multiple domains for a specific use case (analytics, `/me`). They **import** feature modules; feature modules never import them.
* **Composition**: `AppModule` and `WorkersAppModule`. Their only job is to pick which feature/read-model modules the binary needs.

### 2.2 Module ownership — one folder, one bounded context, one module

Rewrite of the current 32 modules into 19, grouped by owning context:

| Target module | Owns (entities) | Folds in |
|---|---|---|
| `OrganizationsModule` | `Organization`, `OrganizationMembership` | `workspace-invitation` + `organization-account-provisioning` stay here but stop touching `User`/`Project` tables directly |
| `UsersModule` | `User` | — |
| `ProjectsModule` | `Project`, `ProjectMembership`, `FeatureFlag` | — |
| `AgentsModule` | `Agent`, `AgentMembership`, `AgentMessage`, `AgentMessageFeedback`, `ConversationAgentSession`, `ExtractionAgentSession`, `FormAgentSession` | `ConversationAgentSessionsModule`, `ExtractionAgentSessionsModule`, `FormAgentSessionsModule`, `StreamingModule`, `AgentMessageFeedbackModule`, `base-agent-sessions/*` helpers |
| `DocumentsModule` | `Document`, `DocumentTag` | `DocumentTagsModule` |
| `EvaluationsModule` | `Evaluation`, `EvaluationReport`, `EvaluationExtractionDataset*`, `EvaluationExtractionRun*` | — (already an umbrella; just stop importing `DocumentsModule`) |
| `McpServersModule` | `McpServer`, `AgentMcpServer` | — |
| `ActivitiesModule` | `Activity` | — |
| `AuthModule` | — (no entities) | — |
| `StorageModule` | — | — |
| `LlmModule` | — | — |
| `McpModule` | — | — |
| `DocumentEmbeddingsBatchModule` | — | — |
| `EvaluationExtractionRunBatchModule` | — | — |
| `MeModule` | — (read-only cross-domain) | — |
| `ProjectsAnalyticsModule` | — (read-only cross-domain) | — |
| `AgentsAnalyticsModule` | — (read-only cross-domain) | — |
| `DiagnosticsModule`, `WorkersHealthModule`, `BullBoardAdminModule` | — | — |
| `InvitationsModule` | — (controller aggregator; no providers of its own) | — |

Worker modules (`DocumentEmbeddingsWorkersModule`, `EvaluationExtractionRunWorkersModule`) stay, but become **pure infrastructure consumers** (see §2.4).

### 2.3 Two sanctioned ways to collaborate across feature modules

Exactly two patterns are allowed; anything else is a violation.

1. **Import the other module and call its exported service.** The callee owns its own transactions. Use this when the cross-module operation does not need to be atomic with the caller's work, or when the two operations can be composed with separate transactions.

2. **Import the other module and call an exported service that accepts a shared `EntityManager`.** Use this when the two operations *must* be in a single transaction. The owning module exposes a narrow `doXInManager(manager, …)` method; the caller opens the transaction.

    Example signature pattern already in use (formalize it):
    ```ts
    // In AgentsService (exported from AgentsModule)
    interface AgentsService {
      deleteAgentsByProject(entityManager: EntityManager, projectId: string): Promise<void>
    }
    ```

Not allowed:
* Importing another module's entity class in a service and calling `entityManager.delete(OtherEntity, …)` or `dataSource.getRepository(OtherEntity)` (current code does this in 5 services).
* Re-registering another module's service in your own `providers: [...]` list (`InvitationsModule` does this).
* Using `TypeOrmModule.forFeature(ALL_ENTITIES)` to sidestep the module system (both worker modules do this).

### 2.4 Worker modules — infrastructure-only consumers

A worker module must:
* Import only infrastructure modules (`StorageModule`, `LlmModule`, queue modules) **and** the single domain module whose work it processes.
* Never register `ALL_ENTITIES`. Only the `TypeOrmModule.forFeature([…])` entities its own processor owns; everything else comes through injected services.
* Never re-declare a feature service as its own provider.

Concretely:
* `DocumentEmbeddingsWorkersModule` imports `StorageModule` + `DocumentsModule` (after `DocumentsModule` stops transitively importing `ProjectsModule` — see §2.5). It registers only the embedding-specific entities (`Document`, and the raw `document_chunk` access it already owns). It removes `DocumentsService` / `DocumentTagsService` from its provider list and uses the injected instances from `DocumentsModule`.
* `EvaluationExtractionRunWorkersModule` imports `StorageModule` + `LlmModule` + `EvaluationsModule` + `DocumentsModule`. Drops `ALL_ENTITIES`.

### 2.5 The deleteProject worked example

The current implementation (`apps/api/src/domains/projects/projects.service.ts:71-92`) is a hybrid: it delegates to `AgentsService.deleteAgent` but reaches directly into `Evaluation`, `EvaluationReport`, `Document`, `ProjectMembership`. The new rule: **pick one policy and apply it uniformly**. Our choice is **delegation with a shared `EntityManager`**:

```ts
// ProjectsService.deleteProject
await this.dataSource.transaction(async (manager) => {
  await this.agentsService.deleteAgentsByProject(manager, project.id)
  await this.evaluationsService.deleteEvaluationsByProject(manager, project.id)
  await this.documentsService.deleteDocumentsByProject(manager, project.id)
  await this.projectMembershipsService.deleteAllForProject(manager, project.id)
  await manager.delete(Project, { id: project.id })
})
```

Why delegation over DB-level `onDelete: "CASCADE"`: deletion has side effects (GCS file cleanup for `Document`, BullMQ job cancellation for in-flight extraction runs, Langfuse trace cleanup for evaluation reports). Pure cascade loses those. Why delegation over domain events (`ProjectDeleted`): we need transactional guarantees — if file cleanup fails, the project must still exist — and an event bus decouples that at the cost of at-least-once retries, which we don't need here.

This pattern also resolves the `BaseAgentSessionsService` → `Document` reach: on extraction-session deletion, call `documentsService.deleteDocumentsByExtractionSession(manager, sessionId)` instead of `manager.delete(Document, {id: documentId})`.

### 2.6 Rules for creating a new module

A new `*.module.ts` must be justified by **all** of:

1. **Bounded context, not entity.** It represents a thing users and the domain talk about (an Agent, a Project). Sub-entities that have no lifecycle independent of their parent (`AgentMembership`, `AgentMessageFeedback`, `DocumentTag`, `ProjectMembership`, `FeatureFlag`) stay inside the parent module. The fact that an entity exists is not a reason for a module to exist.
2. **One-sentence description, no "and".** "It owns agents." ✓ "It owns agents and their sessions." ✗ — if the second "and" is needed, the candidate is really an internal submodule folder of the first one.
3. **No cycle on creation.** If wiring it requires `forwardRef`, the seam is wrong. Merge back into the module it needs or extract the shared dependency one layer lower.
4. **Coupling test.** If module A regularly reaches into module B's tables, either B belongs inside A, or B needs a richer service API — never a third path.
5. **Cohesion test.** Ask "would this module and its caller always change together?" If yes, it's the same module.

### 2.7 Tooling (enforcement)

Add three CI-enforced checks. Each has a concrete failure condition, not just a report.

1. **`madge --circular --extensions ts apps/api/src`** — fail CI on any cycle. Target is zero. Add to `apps/api/package.json` script as `check:cycles`, run in `turbo lint`.
2. **`dependency-cruiser`** with rules that encode §2.1 layers (infrastructure / shared / domain features / cross-domain / composition) and a rule forbidding domain-to-sibling-domain imports except of `*.module.ts` files. Config committed at `apps/api/.dependency-cruiser.cjs`. Run in `turbo lint`.
3. **`eslint-plugin-boundaries`** rule `no-import`: forbid importing `@/domains/X/*.entity` from a file outside `@/domains/X/**`, except in (a) `common/all-entities.ts`, (b) relation type imports in entity files (allowed because TypeORM needs the class reference), and (c) `*.factory.ts` test factories. This is the rule that would have caught every layering violation in §1.

No rule is aspirational: each should land with an auto-generated baseline of current violations so CI turns green immediately, and the baseline shrinks to zero through the migration below.

## 3. Alternatives Considered

* **Leave the module graph, fix only `deleteProject`.** Rejected. The `deleteProject` smell is a symptom — the disease is the absence of a consistent cross-module collaboration rule. A point fix leaves the next layering violation to be written next week.

* **Adopt DB-level `onDelete: "CASCADE"` everywhere and delete the cross-module service calls.** Rejected for deletions that have external side effects (GCS, BullMQ, Langfuse). Considered and kept for pure parent-child joins (`AgentMessage → AgentMessageFeedback`, `EvaluationExtractionRun → Record`) where no side effect exists.

* **Event bus (`ProjectDeleted`, `AgentDeleted`, etc.) for cross-domain cascades.** Serious alternative, not rejected outright. Publishing `project.deleted` from `ProjectsService` and letting `AgentsService` / `DocumentsService` / `EvaluationsService` listen structurally eliminates the Projects knot (cycles 1, 2, 3, 6 in §1) in one move — which is arguably a bigger payoff than delegation gets. Trade-offs:

    * **Against events**: the call graph is no longer greppable — `ProjectsService.deleteProject` no longer has a visible list of what it deletes; you have to enumerate handlers. Transactional guarantees require either (a) synchronous handlers that accept a shared `EntityManager` (at which point it's delegation with extra indirection), or (b) an outbox pattern with at-least-once retries, which is plumbing we don't currently need. The membership-propagation code (`ProjectMembershipsService ↔ AgentMembershipsService`) is load-bearing authz — we want it explicit in the call graph, not wired via emitted strings.
    * **For events**: kills 4 of 7 cycles in a single PR with minimal code churn. Every future cross-domain cascade is one event-handler away.

    **Decision**: delegation with shared `EntityManager` (§2.3, §2.5) for authz-sensitive and file-cleanup-sensitive cascades. Events remain on the table for *purely informational* cross-domain signals (analytics ingestion, audit logging, cache invalidation) where at-least-once is acceptable and the call graph doesn't need to be greppable. Introduce `@nestjs/event-emitter` when the first such use case appears; don't add it speculatively.

* **One giant `DomainModule` that owns every entity.** Rejected — it would make the current problem (everything pulls in everything) explicit instead of fixing it. The point is to pay the cost of boundaries and get the benefit of narrow import closures.

* **Mark `AuthModule` as `@Global()` to remove its fan-in-12.** Rejected. Hides the import graph instead of fixing it, and makes it harder to reason about what a test or a worker actually boots.

* **Keep `ALL_ENTITIES` for workers.** Rejected. It's the structural equivalent of `import *` and makes the worker boot path depend on every entity in the app.

## 4. Consequences

* **Positive**:
    * Worker import closures shrink: `DocumentEmbeddingsWorkersModule` goes from "half the app" to `StorageModule + DocumentsModule + bullmq`. This is the fix for the pathology in §1.
    * `forwardRef` count drops from 11 to 0. New cycles become CI failures.
    * `deleteProject`-style fan-out is written the same way everywhere — easier to review, easier to test in a single transaction.
    * Adding a new entity no longer requires editing `all-entities.ts`.
* **Negative**:
    * Migration costs real time — roughly one module per week, ordered by §5 to minimize risk.
    * Some services grow new `doXInManager(manager, …)` overloads; internal API surface expands slightly.
    * Analytics modules now sit one layer above feature modules, which means introducing a new analytics view costs an extra import. Accepted — it's the right direction for read-only cross-domain queries.

## 5. Implementation Notes — migration order

Done smallest-risk first, each step independently shippable.

1. **Tooling baseline.** Add `madge` and `dependency-cruiser` with baselines of current violations. Turn them on in CI at baseline-enforcement mode. *(Risk: low. Unblocks the rest.)* **Shipped.** See `apps/api/.madgerc`, `apps/api/.dependency-cruiser.cjs`, `apps/api/.dependency-cruiser-known-violations.json`, `apps/api/baselines/madge-circular.json`, `apps/api/scripts/check-circular.mjs`. Baseline at 4 cycles / 168 other violations; `npm run check:boundaries` fails on new violations, passes on known.
2. **Deduplicate `app.module.ts`.** Remove the duplicate `OrganizationsModule`, `ProjectsModule`, `UsersModule` imports. *(Risk: none.)*
3. **Delete `InvitationsModule` re-registrations.** Remove `AgentMembershipsService` and `ProjectMembershipsService` from its `providers` list; import `AgentsModule` and `ProjectsModule` instead. *(Risk: low. Unit tests catch behavior change.)*
4. **Fold `DocumentTagsModule` into `DocumentsModule`.** Breaks the `Documents ↔ DocumentTags` cycle. Keep controller/service files in `domains/documents/tags/`, just remove the `*.module.ts` boundary. *(Risk: low.)*
5. **Fold `AgentMessageFeedbackModule` into `AgentsModule`.** Same pattern. *(Risk: low.)*
6. **Extract `DocumentsCoreModule` for worker consumers.** Create a minimal module that exports `DocumentsService` + the `Document` repository *only*, with **no** imports of `ProjectsModule` / `OrganizationsModule` / `AuthModule`. `DocumentsModule` keeps its current shape and imports the core. `EvaluationExtractionRunWorkersModule` and `DocumentEmbeddingsWorkersModule` import only `DocumentsCoreModule`. This fixes the "worker pulls half the app" pathology *now*, before the deeper topology work lands — and unblocks worker PRs that need `DocumentsService` without the cycle. *(Risk: low. One new module, import swap in two workers.)*
7. **Introduce the `doXInManager` service boundary for `deleteProject`.** Add `agentsService.deleteAgentsByProject`, `documentsService.deleteDocumentsByProject`, `evaluationsService.deleteEvaluationsByProject`, `projectMembershipsService.deleteAllForProject`, each accepting an `EntityManager`. Rewrite `ProjectsService.deleteProject` to call them exclusively. Remove the direct `manager.delete(Evaluation | EvaluationReport | Document | ProjectMembership, …)` calls. *(Risk: medium. Requires an e2e test that verifies cascading deletion, including file cleanup.)*
8. **Same treatment for `BaseAgentSessionsService`.** Replace the `manager.delete(Document, …)` for extraction sessions with a `DocumentsService.deleteOrphanExtractionDocument(manager, documentId)` call. *(Risk: medium.)*
9. **Fold agent-session submodules into `AgentsModule`.** Move `ConversationAgentSessionsModule`, `ExtractionAgentSessionsModule`, `FormAgentSessionsModule`, `StreamingModule`, and `base-agent-sessions-module.helpers.ts` into the agents module as internal submodules or loose files. This deletes 6 `forwardRef`s and the `require()` escape hatch in one step. *(Risk: high — this is the biggest file move and touches routing. Do it behind a feature-flagged PR; rely on the e2e auth specs and session specs.)*
10. **Audit `forwardRef` for dead edges.** Steps 4–9 invalidate most of the `forwardRef(() => X)` calls — once a cycle is gone, the lazy-import is no longer needed. Walk each remaining `forwardRef` in `agents.module.ts`, `documents.module.ts`, `document-tags.module.ts`, and the session/streaming modules. For each, check whether any provider actually injects from the target module (not just imports the class). Delete any that don't. Expect to remove most of them. *(Risk: low. Dropping a `forwardRef` that's still needed produces a loud DI error at boot, not a silent bug.)*
11. **Break `AgentsModule ↔ ProjectsModule`.** The `ProjectMembershipsService` ↔ `AgentMembershipsService` coupling is the core remaining cycle. Resolve by moving the cross-membership propagation (`createAdminAgentMembershipsForUserInProject`, `deleteAgentMembershipsForUserInProject`) either (a) to `AgentsModule` entirely and exposing a hook, or (b) into a new cross-domain service in a higher layer (`MembershipsSyncService` under `common/` or in a new small module). Pick (a) unless it forces `AgentsModule` to import projects data — in which case (b). *(Risk: high. Membership propagation is the trickiest authz code; cover with the auth.spec suites before touching.)*
12. **Break `DocumentsModule ↔ ProjectsModule`.** After step 11 and the new `doXInManager` pattern, `DocumentsModule` no longer needs to call into `ProjectsService`. The remaining import is the `ProjectContextResolver` — move resolvers to a shared `common/context` registration that any module can pull without pulling `ProjectsModule`. *(Risk: medium.)*
13. **Remove `ALL_ENTITIES` from worker modules.** After steps 6–12, each worker module imports only `DocumentsCoreModule` (or its own domain's core) plus the entities owned by its own processor. Delete `ALL_ENTITIES` once no one references it. *(Risk: medium. Worker boot is the failure mode; cover with a workers-boot integration test that starts `WorkersAppModule` and resolves every provider.)*
14. **Move analytics modules up a layer.** `ProjectsAnalyticsModule` and `AgentsAnalyticsModule` today directly `forFeature` 7–8 entities from other modules. Rewrite each to import `AgentsModule`, `ProjectsModule`, `OrganizationsModule` and call their services (adding narrow read methods where needed). *(Risk: medium. Biggest behavior-equivalence test surface.)*
15. **Enforce tooling at zero.** Flip `madge` / `dependency-cruiser` from baseline-enforcement to strict. Any new cycle or layering violation fails CI.

Steps 1–6 can ship in a week with near-zero risk (step 6 is the highest-leverage of the early ones — unblocks workers independently of the rest). Steps 7–8 in a second week. Steps 9–13 are the core architectural work; budget 3–4 weeks with dedicated review. Steps 14–15 close it out.

## 6. Open Questions

* Where should the membership-propagation logic live (step 11 option a vs. b)? Needs a short spike before step 11 lands.
* Do we want to rename `Project` → `Workspace` per ADR 0004 before or after this work? Doing it after is cheaper because the module boundaries will be clearer. Proposed order: this ADR first, rename second.
* Should `common/` become a proper `SharedModule` (registered in both `AppModule` and `WorkersAppModule`) instead of a loose directory of providers? Proposed yes, as part of step 12.
